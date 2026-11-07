/* HTML for cards, list rows and full entries. */
'use strict';
window.BardiRender = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const enc = encodeURIComponent;
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

  // Part-of-speech labels.  Codes not listed here are shown as they are in the database.
  const POS = {
    n: 'noun', 'n.adj': 'noun / adjective', 'n, adj': 'noun / adjective',
    'n-ia': 'noun (inalienably possessed)', 'n.ia': 'noun (inalienably possessed)', nia: 'noun (inalienably possessed)',
    nc: 'compound noun', cn: 'compound noun', 'nc-ia': 'compound noun (inalienably possessed)',
    np: 'noun phrase', nd: 'derived noun', 'pl.n': 'plural noun', 'n.pl': 'plural noun',
    v: 'verb', 'v.tr': 'transitive verb', vtr: 'transitive verb', vt: 'transitive verb', 'v (tr)': 'transitive verb',
    'v.it': 'intransitive verb', vi: 'intransitive verb', 'v.i': 'intransitive verb',
    vct: 'complex verb, transitive', 'v.ct': 'complex verb, transitive', vctr: 'complex verb, transitive', 'vc.tr': 'complex verb, transitive',
    vcit: 'complex verb, intransitive', 'v.cit': 'complex verb, intransitive', vcitr: 'complex verb, intransitive', vc: 'complex verb',
    'v.ref': 'reflexive verb', vref: 'reflexive verb', 'v.refl': 'reflexive verb', vrefl: 'reflexive verb', 'v.rf': 'reflexive verb',
    vcref: 'complex verb, reflexive', vrec: 'reciprocal verb', 'v.recip': 'reciprocal verb', vcrec: 'complex verb, reciprocal',
    'v.impers': 'impersonal verb', 'v.itmpers': 'impersonal verb',
    adj: 'adjective', adv: 'adverb', 'adv.': 'adverb', 'adv.other': 'adverb', 'adv.loc': 'adverb of place',
    'adv.temp': 'adverb of time', 'adv.manner': 'adverb of manner', 'adv.extent': 'adverb of extent',
    'adv.quant': 'adverb of quantity', 'adv.dir': 'adverb of direction',
    pro: 'pronoun', pp: 'personal pronoun', pposs: 'possessive pronoun', pqst: 'interrogative', pid: 'indefinite pronoun',
    dem: 'demonstrative', interrog: 'interrogative', intq: 'interrogative',
    conj: 'conjunction', part: 'particle', quant: 'quantifier', num: 'number',
    int: 'interjection', interj: 'interjection', ij: 'interjection', excl: 'exclamation',
    phr: 'phrase', pphr: 'phrase', phrs: 'phrase',
    'v.pre': 'verb prefix', 'n.pre': 'noun prefix', 'n.suff': 'nominal suffix', 'v.suff': 'verb suffix', suff: 'suffix',
    'adj.suff': 'adjective suffix', 'adv.suff': 'adverb suffix', 'num.suff': 'number suffix',
    Cl: 'clitic', Cli: 'clitic', cli: 'clitic', 'v.cl': 'verbal clitic',
  };
  const PARA = { root: 'Verb root', preverb: 'Preverb', pv: 'Preverb', imp: 'Imperative', 'irreg forms': 'Irregular forms',
    irr: 'Irregular forms', loc: 'Locative', 'Paradigm forms:': 'Paradigm forms' };
  const LF = { loc: 'Locative', locative: 'Locative', abl: 'Ablative', ablative: 'Ablative', infinitive: 'Infinitive',
    'case frame': 'Case frame', rec: 'Reciprocal', root: 'Root', pres: 'Present', fut: 'Future' };

  const posLabel = ps => POS[ps] || ps || '';
  const hwOf = c => c.lc || c.hw;

  // ---- links between entries: exact form match (hyphens matter, so root -joo- ≠ pronoun joo)
  const formKey = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const formMap = new Map();
  let SENTS = [], ABBR = {};
  function init(items, sentences, abbr) {
    SENTS = sentences || [];
    ABBR = abbr || {};
    items.forEach(it => [it.c.hw, it.c.lc].forEach(f => {
      if (!f) return;
      const k = formKey(f), arr = formMap.get(k) || [];
      if (!arr.includes(it)) arr.push(it);
      formMap.set(k, arr);
    }));
  }
  function vlink(x) {
    if (!String(x).trim()) return esc(x);
    const hits = formMap.get(formKey(x));
    if (!hits) return `<span class="v">${esc(x)}</span>`;
    const href = hits.length === 1 ? '#/entry/' + enc(hits[0].id) : '#/search/' + enc(String(x).trim());
    return `<a class="v" href="${href}">${esc(x)}</a>`;
  }
  const vlinks = s => String(s ?? '').split(/(\s*[;,~]\s*)/).map((p, k) => (k % 2 ? esc(p) : vlink(p))).join('');
  const idLink = (id, x) => `<a class="v" href="#/entry/${enc(id)}">${esc(x)}</a>`;

  // ---- sound: a button with data-audio; app.js plays it
  const playBtn = (file, label, big) => (file
    ? `<button type="button" class="play${big ? ' big' : ''}" data-audio="${esc(file)}" aria-label="Listen to ${esc(label)}" title="Listen">` +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9.5v5h4l5 4v-13l-5 4H3z"/>' +
      '<path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>'
    : '');

  // ---- my study list: a bookmark toggle on every card, row and entry (app.js keeps the list)
  let inStudy = () => false;
  const setStudy = fn => { inStudy = fn; };
  const bookmarkSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4.2-5.5 4.2z"/></svg>';
  const studyBtn = (it, wide) => `<button type="button" class="study${wide ? ' wide' : ''}" data-study="${esc(it.id)}" aria-pressed="${inStudy(it.id)}"` +
    (wide ? ` title="Add to or remove from my study list">${bookmarkSVG}<span>My study list</span>`
      : ` aria-label="${esc(hwOf(it.c))} in my study list" title="My study list">${bookmarkSVG}`) + '</button>';

  // ---- inline markup: |tsc{..} small caps, |fv{..} Bardi word, |fi{..} italic; *x* in examples = highlighted part
  function fmt(s, links = true) {
    return String(s ?? '').split(/(\|[a-z]+\{[^}]*\})/).map(p => {
      const m = /^\|([a-z]+)\{([^}]*)\}$/.exec(p);
      if (!m) return esc(p);
      if (m[1] === 'tsc') return `<span class="sc">${esc(m[2])}</span>`;
      if (/^(fv|rv|fvi)$/.test(m[1])) return links ? vlink(m[2]) : `<span class="v">${esc(m[2])}</span>`;
      return `<i>${esc(m[2])}</i>`;
    }).join('');
  }
  const fmtEx = (s, links = true) => fmt(s, links).replace(/\*([^*<>\s][^*<>]*?)\*/g, '<mark>$1</mark>');

  // ---- grammatical labels as abbreviations: ACC, 1SG.ERG.  The full name shows on hover, or on tap
  //      (tappable = focusable; not inside cards, which are links themselves).
  const abbrHTML = (g, tappable = true) => {
    const a = ABBR[g];
    return a ? `<abbr class="gab" data-full="${esc(a[1])}" aria-label="${esc(a[1])}"${tappable ? ' tabindex="0"' : ''}>${esc(a[0])}</abbr>` : '';
  };
  // a gloss in an entry: pronoun labels spelled out, affix labels followed by their abbreviation
  const glossHTML = (g, c) => {
    const a = ABBR[g];
    if (!a || !['suffix', 'prefix', 'clitic', 'pronoun'].includes(c.cls)) return fmt(g);
    if (c.cls === 'pronoun' && /^[123]/.test(g)) return `${abbrHTML(g)} <span class="gx">${esc(a[1])}</span>`;
    return `${fmt(g)} ${abbrHTML(g)}`;
  };

  // ---- interlinear sentence: word / morphemes (linked to entries) / glosses, then translation.
  //      hlId = the entry being shown: its morphemes are highlighted.
  function igtHTML(si, hlId) {
    const s = SENTS[si];
    if (!s) return '';
    const mo = k => {
      const [f, , id] = s.m[k];
      const cls = 'mo' + (id && id === hlId ? ' hl' : '');
      return id && id !== hlId ? `<a class="${cls}" href="#/entry/${enc(id)}">${esc(f)}</a>` : `<span class="${cls}">${esc(f)}</span>`;
    };
    const gl = k => {
      const [f, g] = s.m[k];
      if (!g || g === '***') return '?';
      const label = /^[-=]/.test(f) || /^[123]\s*(sg|dl|du|pl)/i.test(g);     // affix, or pronoun label
      return (label && abbrHTML(g)) || esc(g.replace(/(\w)\s+(?=\w)/g, '$1.'));     // 'go back' -> 'go.back'
    };
    const body = s.a && s.g.length === s.w.length
      ? '<div class="igt-words">' + s.g.map((grp, wi) =>
          `<span class="iw"><span class="iw-s v">${esc(s.w[wi])}</span>` +
          `<span class="iw-m v">${grp.map(mo).join('')}</span>` +
          `<span class="iw-g">${grp.map(gl).join('-')}</span></span>`).join('') + '</div>'
      : `<div class="exv v">${esc(s.v)}</div>`;
    return '<div class="ex igt">' + body +
      s.ft.map(t => `<div class="exe">${esc(t)}</div>`).join('') +
      `<div class="igt-ref">${esc(s.t)} · ${esc(s.n)}</div>` +
      (s.ln && s.ln.length ? `<ul class="ling" aria-label="Linguist notes">${s.ln.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '') +
      '</div>';
  }
  const hasLing = c => (c.xs || []).concat((c.senses || []).flatMap(s => (s.ex || []).map(x => x.s)))
    .some(si => si != null && SENTS[si] && SENTS[si].ln && SENTS[si].ln.length);

  function summary(c) {
    const out = [];
    (c.senses || []).forEach(s => (s.gl || []).forEach(g => { if (!out.includes(g)) out.push(g); }));
    if (!out.length) (c.senses || []).some(s => s.de && out.push(s.de[0]));
    if (!out.length && c.see && c.see.length) {
      const [label, , hw, gloss] = c.see[0];
      out.push(`${label.toLowerCase()} ${hw}${gloss ? ': ' + gloss : ''}`);
    }
    return out.join('; ');
  }
  const shortPos = c => (c.cls === 'place' ? 'place name' : posLabel(c.ps));

  // ---- cards and rows ----------------------------------------------------
  // eng = an English word to lead with (the English-first wordlist): English word, then the entry as usual,
  // with its full gloss only when that says more than the English word
  function itemHTML(kind, it, note, eng) {
    const c = it.c, gl = summary(c);
    const cls = kind + (eng ? ' eng' : '') + (it.parent ? ' sub' : '') + (c.status === 'NK' ? ' nk' : '');
    const title = c.status === 'NK' ? ' title="Not known to speakers today"' : '';
    const glHTML = gl ? (c.cls === 'pronoun' && ABBR[gl] ? abbrHTML(gl, false) : fmt(gl, false)) : '<span class="muted">no gloss</span>';
    const pos = `<span class="pos">${esc(shortPos(c))}</span>`;
    return `<div class="cell${c.audio ? ' has-audio' : ''}"><a class="${cls}" href="#/entry/${enc(it.id)}" data-id="${esc(it.id)}"${title}>` +
      (eng ? `<span class="ehw">${esc(eng)}</span>` : '') +
      `<span class="hw">${esc(hwOf(c))}${c.hm ? `<sup>${esc(c.hm)}</sup>` : ''}</span>` +
      (eng ? `<span class="gl">${pos}${gl.toLowerCase() === eng.toLowerCase() ? '' : ' ' + glHTML}</span>`
        : `${pos}<span class="gl">${glHTML}</span>`) +
      (it.parent ? `<span class="under">under ${esc(hwOf(it.parent.c))}</span>` : '') +
      (note ? `<span class="note">${esc(note)}</span>` : '') + '</a>' +
      playBtn(c.audio, hwOf(c)) + studyBtn(it) + '</div>';
  }
  const cardHTML = (it, note, eng) => itemHTML('card', it, note, eng);

  function wotdHTML(it, dateLabel) {
    const c = it.c;
    const ex = (c.senses || []).flatMap(s => s.ex || []).find(x => x.v && x.e);
    return `<div class="wotd-wrap${c.audio ? ' has-audio' : ''}"><a class="wotd" href="#/entry/${enc(it.id)}" data-id="${esc(it.id)}">` +
      `<span class="wotd-word"><span class="wotd-label">Word of the day · ${esc(dateLabel)}</span>` +
      `<span class="hw">${esc(hwOf(c))}</span><span class="pos">${esc(shortPos(c))}</span>` +
      `<span class="gl">${fmt(summary(c), false)}</span></span>` +
      (ex ? `<span class="wotd-ex"><span class="exv v">${fmtEx(ex.v, false)}</span><span class="exe">${fmt(ex.e, false)}</span></span>` : '') +
      '</a>' + playBtn(c.audio, hwOf(c), true) + '</div>';
  }
  const rowHTML = (it, note, eng) => itemHTML('row', it, note, eng);

  // ---- full entry --------------------------------------------------------
  const block = (title, inner) => `<section class="blk">${title ? `<h3>${title}</h3>` : ''}${inner}</section>`;
  const dl = rows => `<dl class="forms">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${b}</dd>`).join('')}</dl>`;
  const tr = e => (e ? ` <span class="tr">‘${fmt(e)}’</span>` : '');

  function metaHTML(c) {
    const bits = [];
    const p = posLabel(c.ps);
    if (p) bits.push(`<span>${esc(p)}</span>`);
    if (c.cls === 'place') bits.push('<span class="badge place">place name</span>');
    const loan = (c.ety || []).find(([l]) => l === 'Borrowed from');
    if (loan) bits.push(`<span class="badge loan">loan${loan[1] ? ' · ' + esc(loan[1]) : ''}</span>`);
    if (c.status === 'NK') bits.push('<span class="badge nk" title="Recorded in an earlier source; not known to speakers today">not known today</span>');
    return bits.join('');
  }

  function sensesHTML(c) {
    const S = c.senses || [];
    if (!S.length) return '';
    const many = S.length > 1;
    return `<ol class="senses${many ? '' : ' single'}">` + S.map((s, k) => {
      const num = many ? (s.n || String(k + 1)) : '';
      const ps = s.ps && s.ps !== c.ps ? `<span class="s-ps">${esc(posLabel(s.ps))}</span>` : '';
      const gl = (s.gl || []).map(g => glossHTML(g, c)).join('; ');
      const body = ps + (gl ? `<span class="gl">${gl}</span>` : '') +
        (s.de || []).map(d => `<div class="de">${fmt(d)}</div>`).join('') +
        (s.sc || []).map(x => `<div class="sci">Scientific name: <i>${esc(x)}</i></div>`).join('') +
        (s.lt || []).map(x => `<div class="lit">Literally ‘${fmt(x)}’</div>`).join('') +
        (s.nt || []).map(x => `<div class="snote">${fmt(x)}</div>`).join('') +
        (s.ex || []).map(x => (x.s != null && SENTS[x.s] ? igtHTML(x.s, c.id)
          : `<div class="ex"${x.ref ? ` title="Text reference: ${esc(x.ref)}"` : ''}><div class="exv v">${fmtEx(x.v)}</div>${x.e ? `<div class="exe">${fmt(x.e)}</div>` : ''}</div>`)).join('') +
        (s.ug || []).map(x => `<div class="ex ug"><div class="ug-label">Ungrammatical</div><div class="exv v">${x.startsWith('*') ? '' : '*'}${fmt(x)}</div></div>`).join('');
      return `<li class="sense">${num ? `<span class="sn">${esc(num)}</span>` : ''}<div class="sbody">${body}</div></li>`;
    }).join('') + '</ol>';
  }

  function formRows(c) {
    const rows = [];
    (c.see || []).forEach(([label, id, hw, gloss]) => rows.push([label, idLink(id, hw) + tr(gloss)]));
    if (c.place) rows.push(['Location', esc(c.place)]);
    if (c.va) rows.push([c.va.length > 1 ? 'Variants' : 'Variant',
      c.va.map(([f, src, audio, id]) => (id ? idLink(id, f) : vlinks(f)) +
        (src ? ` <span class="src">(${esc(src)})</span>` : '') + playBtn(audio, f)).join('; ')]);
    if (c.orig) rows.push(['Original spelling', c.orig.map(f => `<span class="v">${esc(f)}</span>`).join('; ')]);
    let g3 = c.g3s;
    (c.infl || []).forEach(([lab, f]) => {
      let v = `<span class="v">${esc(f)}</span>`;
      if (g3 && lab.startsWith('3rd person singular')) { v += tr(g3); g3 = ''; }
      rows.push([lab, v]);
    });
    (c.para || []).forEach(([l, v, e]) => rows.push([PARA[l] || cap(l) || 'Paradigm', vlinks(v) + tr(e)]));
    (c.lf || []).forEach(([l, v, e]) => rows.push([LF[l] || cap(l) || 'Related form',
      (v ? (l === 'case frame' ? esc(v) : `<span class="v">${fmt(v)}</span>`) : '') + tr(e)]));
    return rows;
  }

  function relatedRows(c) {
    const groups = new Map();
    (c.xref || []).forEach(([l, f, e, id]) => {
      if (!groups.has(l)) groups.set(l, []);
      groups.get(l).push((id ? idLink(id, f) : vlinks(f)) + tr(e));
    });
    return [...groups].map(([l, arr]) => [l, arr.join('; ')]);
  }

  function moreHTML(c, open) {
    const rows = [...(c.notes || []), ...(c.ety || []), ...(c.src || [])];
    if (!rows.length) return '';
    return `<details class="more"${open ? ' open' : ''}><summary>Notes, etymology and sources</summary>` +
      dl(rows.map(([l, v]) => [l, fmt(v)])) + '</details>';
  }

  // sentences that use this entry, beyond the examples already under its meanings: 3 shown, the rest folded
  function moreExamplesHTML(c) {
    const xs = c.xs || [];
    if (!xs.length) return '';
    const shown = 3;
    const inSenses = (c.senses || []).some(s => (s.ex || []).length);
    const title = `${inSenses ? 'More examples' : 'Examples'} <span class="count">${xs.length}</span>`;
    return block(title, xs.slice(0, shown).map(si => igtHTML(si, c.id)).join('') +
      (xs.length > shown ? `<details class="more-ex"><summary>Show ${xs.length - shown} more</summary>` +
        xs.slice(shown).map(si => igtHTML(si, c.id)).join('') + '</details>' : ''));
  }
  const lingToggle = on => `<label class="ling-toggle"><input type="checkbox" data-ling${on ? ' checked' : ''}> Show linguist notes and questions</label>`;

  function bodyHTML(c, isMain) {
    let h = '';
    const sens = sensesHTML(c);
    if (sens) h += block(isMain ? ((c.senses || []).length > 1 ? 'Meanings' : 'Meaning') : '', sens);
    h += moreExamplesHTML(c);
    const forms = formRows(c);
    if (forms.length) h += block('Forms and grammar', dl(forms));
    const rel = relatedRows(c);
    if (rel.length) h += block('Related words', dl(rel));
    return h;
  }

  const subHTML = (s, open) => `<div class="subentry" data-sub="${s.n}">` +
    `<div class="sub-head"><a class="sub-hw" href="#/entry/${enc(s.id)}">${esc(hwOf(s.c))}</a>` +
    `<span class="pos">${metaHTML(s.c)}</span></div>${bodyHTML(s.c, false)}${moreHTML(s.c, open)}</div>`;

  function navBtn(x, dir) {
    const arrow = dir === 'prev' ? '‹' : '›';
    if (!x) return `<button type="button" class="nav-btn" disabled aria-label="${dir === 'prev' ? 'Previous' : 'Next'} entry">${arrow}</button>`;
    const lab = `<span class="v">${esc(hwOf(x.c))}</span>`;
    return `<button type="button" class="nav-btn" data-go="${esc(x.id)}" title="${dir === 'prev' ? 'Previous' : 'Next'}: ${esc(hwOf(x.c))} (${dir === 'prev' ? '←' : '→'})">` +
      (dir === 'prev' ? `${arrow} ${lab}` : `${lab} ${arrow}`) + '</button>';
  }

  function entryHTML(top, prev, next, open, ling) {
    const c = top.c;
    return `<div class="entry-bar">${navBtn(prev, 'prev')}${navBtn(next, 'next')}<span class="spacer"></span>` +
      `<button type="button" class="close-btn" aria-label="Close entry" title="Close (Esc)">✕</button></div>` +
      `<header class="entry-head"><div class="hw-line"><h2 class="entry-hw v" id="entry-title">${esc(hwOf(c))}${c.hm ? `<sup>${esc(c.hm)}</sup>` : ''}</h2>` +
      `${playBtn(c.audio, hwOf(c), true)}${studyBtn(top, true)}</div>` +
      `<div class="entry-meta">${metaHTML(c)}</div>${hasLing(c) ? lingToggle(ling) : ''}</header>` +
      bodyHTML(c, true) + moreHTML(c, open) +
      (top.subs.length ? `<section class="subs"><h3>Sub-entries (${top.subs.length})</h3>${top.subs.map(s => subHTML(s, open)).join('')}</section>` : '') +
      (c.dt ? `<div class="entry-foot">Last edited ${esc(c.dt)}</div>` : '');
  }

  // the abbreviation key for the About page
  const abbrListHTML = () => {
    const seen = new Map();
    Object.values(ABBR).forEach(([a, full]) => { if (!seen.has(a)) seen.set(a, full); });
    return [...seen].sort((x, y) => x[0].localeCompare(y[0], 'en', { numeric: true }))
      .map(([a, full]) => `<dt><abbr class="gab">${esc(a)}</abbr></dt><dd>${esc(full)}</dd>`).join('');
  };

  return { init, esc, enc, fmt, hwOf, posLabel, cardHTML, rowHTML, entryHTML, wotdHTML, abbrListHTML, setStudy, bookmarkSVG };
})();
