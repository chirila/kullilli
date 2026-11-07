/* Search for the dictionary.
   Vernacular: matches headwords, citation forms, variants, inflected forms and
          original spellings, and tolerates spelling differences (rules come from
          the data file, see SPELLING in build_lift.py) plus small typos.
   English: matches glosses, definitions, scientific names and notes; ignores
          word endings and allows small typos.  Every query word must match. */
'use strict';
window.BardiSearch = (() => {
  const bare = s => String(s ?? '').toLowerCase()
    .replace(/\|[a-z]+\{([^}]*)\}/g, '$1')
    .replace(/[-=+*()?!.,;:"'\/~\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Spelling key: each language's rules are listed in the data file as [regex, replacement] pairs.
  const RULES = ((window.DICT_DATA || {}).spelling || []).map(([p, r]) => [new RegExp(p, 'g'), r]);
  function bkey(s) {
    let k = bare(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
    for (const [re, rep] of RULES) k = k.replace(re, rep);
    return k.replace(/[^a-zø]/g, '');
  }

  // Optimal string alignment distance; returns max+1 as soon as it is exceeded.
  function osa(a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: lb + 1 }, (_, j) => j);
    for (let i = 1; i <= la; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= lb; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }

  function stem(w) {
    if (w.length <= 3) return w;
    if (w.endsWith("'s")) w = w.slice(0, -2);
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (/(sses|ches|shes|xes|zes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 5) { w = w.slice(0, -3); return /([^aeiou])\1$/.test(w) ? w.slice(0, -1) : w; }
    if (w.endsWith('ed') && w.length > 4) { w = w.slice(0, -2); return /([^aeiou])\1$/.test(w) ? w.slice(0, -1) : w; }
    return w;
  }

  const tokenize = s => String(s ?? '').toLowerCase()
    .replace(/\|[a-z]+\{([^}]*)\}/g, '$1').replace(/[’‘]/g, "'")
    .split(/[^a-z0-9'-]+/)
    .flatMap(t => (t.includes('-') ? [t.replace(/-/g, ''), ...t.split('-')] : [t]))
    .map(t => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);

  const norm = s => String(s ?? '').toLowerCase().replace(/\|[a-z]+\{([^}]*)\}/g, '$1')
    .replace(/\([^)]*\)/g, ' ').replace(/^\s*to\s+/, '').replace(/["!?.]/g, '')
    .replace(/\s+/g, ' ').trim();

  const STOP = new Set(['to', 'the', 'a', 'an', 'of', 'be', 'is', 'are', 'for', 'and', 'or', 'in', 'on',
    'at', 'with', 'one', "one's", 'someone', 'something', 'oneself', 'it', 'his', 'her']);
  const NOTE = { de: 'in definition', sc: 'scientific name', nt: 'in a note', place: 'location', ex: 'in an example' };
  const splitForms = f => String(f).split(/\s*[;,~]\s*/).filter(Boolean);

  let ITEMS = [], BF = [], GL = [], VOCAB = new Map(), EXV = null, EXB = null;

  function post(vocab, text, i, w, f) {
    for (const t of tokenize(text)) {
      let v = vocab.get(t);
      if (!v) vocab.set(t, (v = { stem: stem(t), posts: new Map() }));
      const cur = v.posts.get(i);
      if (!cur || cur[0] < w) v.posts.set(i, [w, f]);
    }
  }

  function build(items) {
    ITEMS = items;
    items.forEach((it, i) => {
      const c = it.c, forms = [], seen = new Set();
      const add = (f, w, note) => {
        const t = bare(f);
        if (!t || seen.has(t)) return;
        seen.add(t);
        forms.push({ t, k: bkey(f), w, note, f });
      };
      add(c.hw, 1, '');
      if (c.lc) add(c.lc, 1, '');
      (c.va || []).forEach(([f]) => splitForms(f).forEach(x => add(x, 0.85, 'variant')));
      (c.orig || []).forEach(f => splitForms(f).forEach(x => add(x, 0.8, 'original spelling')));
      (c.infl || []).forEach(([lab, f]) => splitForms(f).forEach(x => add(x, 0.75, lab)));
      BF[i] = forms;

      const gl = [];
      (c.senses || []).forEach(s => {
        (s.gl || []).forEach(g => { post(VOCAB, g, i, 1, 'gl'); gl.push(norm(g)); });
        (s.de || []).forEach(d => post(VOCAB, d, i, 0.75, 'de'));
        (s.sc || []).forEach(d => post(VOCAB, d, i, 0.7, 'sc'));
        (s.nt || []).concat(s.lt || []).forEach(d => post(VOCAB, d, i, 0.35, 'nt'));
      });
      (c.fl || []).forEach(d => post(VOCAB, d, i, 0.6, 'gl'));
      if (c.place) post(VOCAB, c.place, i, 0.5, 'place');
      if (c.g3s) post(VOCAB, c.g3s, i, 0.5, 'gl');
      GL[i] = gl;
    });
  }

  function buildExamples() {
    EXV = new Map(); EXB = new Map();
    const SENTS = (window.DICT_DATA || {}).sentences || [];
    const addEx = (i, v, e) => {
      if (e) post(EXV, e, i, 0.3, 'ex');
      for (const w of bare(v).split(' ')) {
        for (const key of [w, '~' + bkey(w)]) {
          let set = EXB.get(key);
          if (!set) EXB.set(key, (set = new Set()));
          set.add(i);
        }
      }
    };
    ITEMS.forEach((it, i) => {
      (it.c.senses || []).forEach(s => (s.ex || []).forEach(x => addEx(i, x.v, x.e)));
      (it.c.xs || []).forEach(si => SENTS[si] && addEx(i, SENTS[si].v, SENTS[si].ft.join(' ')));
    });
  }

  const byScore = (a, b) => b.score - a.score || a.i - b.i;

  function bardi(q, withEx) {
    const qt = bare(q), qk = bkey(q);
    if (!qt) return [];
    if (withEx && !EXB) buildExamples();
    const raw = q.trim();
    const pref = raw.startsWith('=') ? 'clitic' : raw.startsWith('-') ? 'suffix' : /\S-$/.test(raw) ? 'prefix' : '';
    const allow = qk.length >= 7 ? 2 : qk.length >= 4 ? 1 : 0;
    const exHit = withEx && EXB.get(qt), exSim = withEx && EXB.get('~' + qk);
    const out = [];
    ITEMS.forEach((it, i) => {
      let best = 0, note = '';
      for (const f of BF[i]) {
        let s = 0, similar = false;
        if (f.t === qt) s = (90 + 10 * f.w) / f.w;      // exact spelling of any form beats every similar spelling
        else if (qk && f.k === qk) { s = 84; similar = true; }
        else if (f.t.startsWith(qt)) s = 70 - Math.min(f.t.length - qt.length, 30) * 0.4;
        else if (qk.length >= 2 && f.k.startsWith(qk)) { s = 56 - Math.min(f.k.length - qk.length, 30) * 0.4; similar = true; }
        else if (qt.length >= 3 && f.t.includes(qt)) s = 38;
        else if (allow && Math.abs(f.k.length - qk.length) <= allow) {
          const d = osa(f.k, qk, allow);
          if (d <= allow) { s = 52 - 12 * d; similar = true; }
        }
        s *= f.w;
        if (s > best) {
          best = s;
          note = [f.note ? `${f.note}: ${f.f}` : '', similar ? 'similar spelling' : ''].filter(Boolean).join(' · ');
        }
      }
      if (!best && exHit && exHit.has(i)) { best = 16; note = 'in an example'; }
      else if (!best && exSim && exSim.has(i)) { best = 12; note = 'in an example (similar spelling)'; }
      if (best) {
        if (pref && it.c.cls === pref) best += 20;
        out.push({ i, score: best, note });
      }
    });
    return out.sort(byScore);
  }

  function english(q, withEx) {
    let toks = tokenize(q);
    const content = toks.filter(t => !STOP.has(t));
    if (content.length) toks = content;
    if (!toks.length) return [];
    if (withEx && !EXV) buildExamples();
    const acc = new Map();
    toks.forEach((qt, qi) => {
      const qs = stem(qt), allow = qs.length >= 7 ? 2 : qs.length >= 4 ? 1 : 0;
      const hits = new Map();
      const scan = vocab => {
        for (const [raw, v] of vocab) {
          let m = 0;
          if (v.stem === qs) m = 1;
          else if (qt.length >= 3 && raw.startsWith(qt)) m = 0.65;
          else if (allow && Math.abs(v.stem.length - qs.length) <= allow && osa(v.stem, qs, allow) <= allow) m = 0.45;
          if (!m) continue;
          for (const [i, [w, f]] of v.posts) {
            const s = m * w, h = hits.get(i);
            if (!h || h.s < s) hits.set(i, { s, f, typo: m < 0.5 });
          }
        }
      };
      scan(VOCAB);
      if (withEx) scan(EXV);
      for (const [i, h] of hits) {
        const r = acc.get(i) || { sum: 0, n: 0, best: 0, f: '', typo: false };
        if (r.n !== qi) continue;              // every earlier query word must have matched too
        r.sum += h.s; r.n++;
        if (h.s > r.best) { r.best = h.s; r.f = h.f; }
        r.typo = r.typo || h.typo;
        acc.set(i, r);
      }
    });
    const qn = norm(q), out = [];
    for (const [i, r] of acc) {
      if (r.n !== toks.length) continue;
      let score = r.sum;
      const gl = GL[i];
      if (gl.length) {
        if (gl.includes(qn)) score += 1.5;
        else if (gl.some(g => g.split(/\s*[;,\/]\s*/).includes(qn))) score += 1.1;
        else if (gl.some(g => g.startsWith(qn + ' '))) score += 0.4;
        score += 0.4 / Math.min(...gl.map(g => g.split(' ').length));
      }
      const note = [NOTE[r.f] || '', r.typo ? 'similar spelling' : ''].filter(Boolean).join(' · ');
      out.push({ i, score, note });
    }
    return out.sort(byScore);
  }

  return { build, bardi, english, bare, bkey };
})();
