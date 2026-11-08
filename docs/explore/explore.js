/* Explore: the dictionary in numbers, minimal pairs, and a web of related words.
   Reads window.DICT_DATA (the dictionary, ../data/dictionary.js) and window.EXPLORE (explore-data.js, written
   by build/build_explore.py: the figures, the minimal pairs with their network layout, and each entry's links).
   Pages: #/numbers, #/pairs[/<word>], #/web[/<entry id> | /topic/<code>]. */
'use strict';
(() => {
  const D = window.DICT_DATA, X = window.EXPLORE, E = D.entries, LANG = D.language || 'Kullilli';
  const VL = D.langCode || '';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  let main = $('#main');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const enc = encodeURIComponent;
  const fmt = n => Number(n).toLocaleString('en');
  const pct = (n, of) => `${Math.round(100 * n / of)}%`;
  const plain = s => String(s ?? '').replace(/\|[a-z]+\{([^}]*)\}/g, '$1');
  const vern = (s, cls = 'v') => `<span class="${cls}" lang="${VL}" translate="no">${esc(s)}</span>`;
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const built = new Date(X.built + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#built').textContent = `Figures and links worked out on ${built}.`;

  // ---- entries ---------------------------------------------------------------------------------------------
  const CLASS = Object.fromEntries(X.stats.classes.map(([name, , k]) => [k, name]));
  const GL = E.map(c => {
    const g = [...new Set((c.senses || []).flatMap(s => s.gl || []).map(plain))];
    if (!g.length && c.see && c.see[0] && c.see[0][3]) g.push(plain(c.see[0][3]));      // a variant: the main word's gloss
    return g;
  });
  const gloss = (i, max = 26) => {
    const s = GL[i].join(', ') || (CLASS[E[i].cls] || '').toLowerCase();
    return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
  };
  const hm = i => (E[i].hm ? `<sup>${esc(E[i].hm)}</sup>` : '');
  const dictHref = i => `../#/entry/${enc(E[i].id)}`;
  const byId = new Map(E.map((c, i) => [c.id, i]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // topics (FLEx semantic domains, e.g. "1.6.1.2 Bird"); a topic includes its smaller topics
  const TOPIC = new Map(X.stats.topics.map(([code, name, n, depth]) => [code, { code, name, n, depth }]));
  const codesOf = i => [...new Set((E[i].sd || []).map(d => d.split(' ')[0]))];
  const inTopic = (i, code) => codesOf(i).some(k => k === code || k.startsWith(code + '.'));
  const parentOf = code => {
    const p = code.split('.');
    for (let k = p.length - 1; k > 0; k--) { const c = p.slice(0, k).join('.'); if (TOPIC.has(c)) return c; }
    return null;
  };
  const childrenOf = code => [...TOPIC.keys()].filter(c => parentOf(c) === code);

  // ---- sound ----------------------------------------------------------------------------------------------
  const SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9.5v5h4l5 4v-13l-5 4H3z"/>' +
    '<path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const playBtn = (i, cls = '') => (E[i].audio
    ? `<button type="button" class="play ${cls}" data-audio="${esc(E[i].audio)}" aria-label="Listen to ${esc(E[i].hw)}" title="Listen">${SPK}</button>`
    : '');
  const player = new Audio();
  let playing = null;
  const stopPlay = () => { if (playing) playing.classList.remove('playing'); playing = null; };
  player.addEventListener('ended', stopPlay);
  player.addEventListener('error', stopPlay);
  document.addEventListener('click', e => {
    const b = e.target.closest('.play');
    if (!b) return;
    const again = playing === b;
    player.pause(); stopPlay();
    if (again) return;
    player.src = '../audio/' + enc(b.dataset.audio);
    player.play().then(() => { playing = b; b.classList.add('playing'); }).catch(stopPlay);
  });

  // ---- tooltip for anything with data-tip (bars, grid cells); the same text is on the page or in aria-label --
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);
  const showTip = el => {
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(r.left + r.width / 2, w / 2 + 6), innerWidth - w / 2 - 6) + scrollX + 'px';
    tip.style.top = r.top + scrollY + 'px';
  };
  document.addEventListener('pointerover', e => showTip(e.target.closest('[data-tip]')));
  document.addEventListener('focusin', e => showTip(e.target.closest('[data-tip]')));
  document.addEventListener('focusout', () => showTip(null));
  addEventListener('scroll', () => showTip(null), { passive: true });

  // ---- finding a word: Kullilli (start of the word) or English (start of a gloss word) ----------------------
  function search(q, pool) {
    q = norm(q).trim();
    if (!q) return [];
    const out = [];
    for (const i of pool) {
      const h = norm(E[i].hw).replace(/^-/, '');
      let s = h === q ? 0 : h.startsWith(q) ? 1 : -1;
      if (s < 0) {
        const g = GL[i].map(norm);
        s = g.includes(q) ? 2 : g.some(x => x.split(/[^a-z0-9]+/).some(w => w.startsWith(q))) ? 3 : -1;
      }
      if (s >= 0) out.push([s, E[i].sk || h, i]);
    }
    return out.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1)).slice(0, 10).map(x => x[2]);
  }
  function finder(el, pool, pick, label) {
    el.innerHTML = `<label class="find"><span class="sr-only">${esc(label)}</span>` +
      `<input type="search" placeholder="${esc(label)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>` +
      '<ul class="find-res" hidden></ul>';
    const inp = $('input', el), ul = $('ul', el);
    inp.addEventListener('input', () => {
      const r = search(inp.value, pool);
      ul.hidden = !inp.value.trim();
      ul.innerHTML = r.length ? r.map(i => `<li><button type="button" data-i="${i}">${vern(E[i].hw)}${hm(i)} ` +
        `<span class="g">${esc(gloss(i, 48))}</span></button></li>`).join('') : '<li class="none">No match</li>';
    });
    ul.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      ul.hidden = true; inp.value = '';
      pick(+b.dataset.i);
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const b = $('button', ul); if (b) { e.preventDefault(); b.click(); } }
      if (e.key === 'Escape') ul.hidden = true;
    });
  }

  // ---- In numbers -----------------------------------------------------------------------------------------
  const barRows = (rows, max) => rows.map(r =>
    `<span class="bar-row" style="--d:${r.depth || 0}"><span class="bar-label">${r.label}</span>` +
    `<span class="bar-track"><span class="bar" style="--w:${(r.n / max).toFixed(4)}"></span>` +
    `<span class="bar-val">${fmt(r.n)}${r.of ? ` <small>${pct(r.n, r.of)}</small>` : ''}</span></span></span>`).join('');
  const section = (title, body, id) => `<section class="ex-sec"${id ? ` id="${id}"` : ''}><h2>${title}</h2>${body}</section>`;
  function niceTicks(max) {
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => max / s <= 5) || 1000;
    const out = [];
    for (let v = 0; v <= max; v += step) out.push(v);
    return out;
  }

  function numbersView() {
    const S = X.stats;
    const tiles = [[S.entries, 'entries'], [S.audio, 'with a recording'], [S.examples, 'with example sentences'],
      [S.sentences, 'example sentences'], [S.topics.length, 'topics']];
    const tops = S.topics.filter(t => t[3] === 0), maxTop = Math.max(...tops.map(t => t[2]));
    const topicHTML = tops.map(([code, name, n]) => {
      const kids = S.topics.filter(k => k[0].startsWith(code + '.'));
      return `<details class="tgroup"><summary>${barRows([{ label: esc(name), n }], maxTop)}</summary><div class="tkids">` +
        barRows(kids.map(([c, nm, k, depth]) => ({ label: `<a href="../#/topic/${enc(c)}">${esc(nm)}</a>`, n: k, depth })), maxTop) +
        `<p class="tmore"><a href="../#/topic/${enc(code)}">${esc(name)} in the dictionary</a> · ` +
        `<a href="#/web/topic/${enc(code)}">as a word web</a></p></div></details>`;
    }).join('');

    // word length: one column per length, from the shortest to the longest
    const len = new Map(S.lengths), lo = Math.min(...len.keys()), hi = Math.max(...len.keys());
    const lens = Array.from({ length: hi - lo + 1 }, (_, k) => [lo + k, len.get(lo + k) || 0]);
    const maxL = Math.max(...lens.map(l => l[1])), ticks = niceTicks(maxL), top = ticks[ticks.length - 1] < maxL ? maxL : ticks[ticks.length - 1];
    const lengthHTML = `<div class="cols-wrap" aria-hidden="true"><div class="cols">` +
      ticks.map(t => `<span class="gridline" style="bottom:${100 * t / top}%"><span>${fmt(t)}</span></span>`).join('') +
      lens.map(([k, n]) => `<span class="col" tabindex="0" data-tip="${k} sounds: ${fmt(n)} words" style="--h:${n / top}">` +
        (n === maxL ? `<span class="col-cap">${fmt(n)}</span>` : '') + '<span class="col-bar"></span></span>').join('') +
      `</div><div class="col-x">${lens.map(([k]) => `<span>${k}</span>`).join('')}</div>` +
      '<p class="axis-name">Number of sounds in the word</p></div>' +
      `<table class="sr-only"><caption>Words by number of sounds</caption><tr><th>Sounds</th><th>Words</th></tr>` +
      lens.map(([k, n]) => `<tr><td>${k}</td><td>${n}</td></tr>`).join('') + '</table>';

    // sounds: how common each one is, anywhere in a word and at the start
    const maxAll = Math.max(...S.sounds.map(s => s[1])), maxFirst = Math.max(...S.sounds.map(s => s[2]));
    const cell = (n, max, of) => `<span class="bar-track"><span class="bar" style="--w:${(n / max).toFixed(4)}"></span>` +
      `<span class="bar-val">${pct(n, of)}</span></span>`;
    const soundHTML = '<div class="tbl-scroll"><table class="sound-tbl"><thead><tr><th scope="col">Sound</th>' +
      '<th scope="col">Share of all the sounds in words</th><th scope="col">Words that start with it</th></tr></thead><tbody>' +
      S.sounds.map(([u, all, first]) => `<tr><th scope="row">${vern(u)}</th><td>${cell(all, maxAll, S.soundTotal)}</td>` +
        `<td>${first ? cell(first, maxFirst, S.words) : '<span class="muted">none</span>'}</td></tr>`).join('') +
      '</tbody></table></div>';

    main.innerHTML = `<h1 class="ex-title">${esc(LANG)} in numbers</h1>` +
      `<p class="lede">What is in the dictionary, counted. These figures are worked out each time the site is updated (last on ${esc(built)}).</p>` +
      `<div class="tiles">${tiles.map(([n, l]) => `<div class="tile"><span class="tile-v">${fmt(n)}</span><span class="tile-l">${l}</span></div>`).join('')}</div>` +
      section('Kinds of word', '<p>Entries by word class. Suffixes are endings like <span class="v">-ngu</span>; “Other” includes numbers and little words that don’t fit elsewhere.</p>' +
        `<div class="bars">${barRows(S.classes.map(([label, n]) => ({ label: esc(label), n, of: S.entries })), S.classes[0][1])}</div>`) +
      section('Topics', `<p>Entries by topic. A topic counts the words in its smaller topics too, and a word can be in more than one topic. ` +
        `Open a topic to see its parts. ${fmt(S.noTopic)} entries don’t have a topic yet.</p><div class="bars">${topicHTML}</div>`) +
      section('Word length', `<p>How many sounds the ${fmt(S.words)} whole words have (not counting affixes and phrases). ` +
        `Letter pairs like <span class="v">dh</span> and <span class="v">ng</span> count as one sound.</p>${lengthHTML}`) +
      section('Sounds', '<p>How common each sound is in the same words, and how many words begin with it.</p>' + soundHTML);
  }

  // ---- Sound pairs ----------------------------------------------------------------------------------------
  const P = X.pairs;
  const UNITS = (D.keyboard || []).flat();
  const PW = P.words.map(([t, ids]) => ({ t: t.split('.'), name: t.replace(/\./g, ''), ids }));
  const nodeOf = new Map(PW.map((w, n) => [w.name, n]));
  const PE = P.edges.map(([a, b, k]) => {
    let x = PW[a].t[k], y = PW[b].t[k];
    if (UNITS.indexOf(x) > UNITS.indexOf(y)) [x, y] = [y, x];
    return { a, b, k, x, y, key: x + '|' + y };
  });
  const byKey = new Map(), adj = PW.map(() => []);
  PE.forEach((e, m) => {
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(m);
    adj[e.a].push(m); adj[e.b].push(m);
  });
  const pairPool = [...new Set(PW.flatMap(w => w.ids))];
  const nodeOfEntry = new Map(PW.flatMap((w, n) => w.ids.map(i => [i, n])));
  const pairState = { word: null, key: null };
  let net = null;

  const wordGloss = n => [...new Set(PW[n].ids.flatMap(i => GL[i]))].join('; ');
  const wordAudio = n => PW[n].ids.find(i => E[i].audio);
  const marked = (n, k) => PW[n].t.map((u, j) => (j === k ? `<b class="diff">${esc(u)}</b>` : esc(u))).join('');
  const pairWord = (n, k) => {
    const a = wordAudio(n);
    return `<span class="pw">${a != null ? playBtn(a, 'inline') : ''}<a href="#/pairs/${enc(PW[n].name)}" class="v" lang="${VL}" translate="no">${marked(n, k)}</a>` +
      ` <span class="g">${esc(wordGloss(n))}</span></span>`;
  };

  function pairsView(sel, fresh) {
    if (fresh) {
      const U = UNITS.filter(u => PE.some(e => e.x === u || e.y === u));
      const max = Math.max(...[...byKey.values()].map(l => l.length));
      const cellHTML = (x, y) => {
        const n = (byKey.get(x + '|' + y) || []).length;
        if (!n) return '<td></td>';
        const p = 0.12 + 0.88 * Math.sqrt(n / max);
        const what = `${x} and ${y}: ${n} pair${n === 1 ? '' : 's'}`;
        return `<td><button type="button" class="cg${p > 0.55 ? ' dark' : ''}" data-key="${esc(x + '|' + y)}" style="--p:${p.toFixed(3)}" ` +
          `data-tip="${esc(what)}" aria-label="${esc(what)}">${n}</button></td>`;
      };
      const grid = '<div class="tbl-scroll"><table class="cgrid"><thead><tr><td></td>' +
        U.slice(0, -1).map(u => `<th scope="col">${vern(u)}</th>`).join('') + '</tr></thead><tbody>' +
        U.slice(1).map((ry, r) => `<tr><th scope="row">${vern(ry)}</th>` + U.slice(0, r + 1).map(cx => cellHTML(cx, ry)).join('') +
          '<td></td>'.repeat(U.length - 2 - r) + '</tr>').join('') + '</tbody></table></div>';
      const [first, middle, last] = P.where;
      main.innerHTML = '<h1 class="ex-title">Sound pairs</h1>' +
        `<p class="lede">Minimal pairs are two words that differ in just one sound, like English <i>pin</i> and <i>bin</i>. ` +
        `They show which differences in sound change the meaning of a word. The dictionary has ${fmt(PE.length)} of them among ` +
        `${fmt(PW.length)} words: ${fmt(first)} differ in the first sound, ${fmt(middle)} in the middle and ${fmt(last)} in the last. ` +
        'They are found from the spellings in the dictionary, so a few may be spelling differences rather than different sounds.</p>' +
        section('The network of pairs', '<p>Each dot is a word, and a line joins two words that make a minimal pair. ' +
          'Words that are linked through a chain of pairs sit together. Choose a word to see its pairs; zoom in to read the words ' +
          '(drag to move around; pinch, or use the buttons).</p>' +
          '<div class="find-wrap" id="pair-find"></div>' +
          '<div class="net-wrap"><svg class="net" role="img" aria-label="Network of minimal pairs; choose a word above to list its pairs"></svg>' +
          '<div class="net-tools"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button>' +
          '<button type="button" data-z="fit">Whole network</button></div></div>' +
          '<div id="pair-word" class="pair-word" aria-live="polite"></div>') +
        section('Which sounds make the difference', '<p>Each square counts the pairs that differ in those two sounds; the darker, the more pairs. ' +
          'Choose a square to see its pairs.</p>' + grid + '<div id="contrast" class="contrast" aria-live="polite"></div>');
      pairState.key = null;
      net = makeNet($('.net'));
      finder($('#pair-find'), pairPool, i => { location.hash = '#/pairs/' + enc(PW[nodeOfEntry.get(i)].name); }, 'Find a word in the network');
      main.addEventListener('click', pairsClick);
    }
    const n = nodeOf.has(sel) ? nodeOf.get(sel) : null;
    if (fresh || n !== pairState.word) selectWord(n, !fresh);
  }

  function pairsClick(e) {
    if (!$('.cgrid', main)) return;
    const c = e.target.closest('.cg');
    if (c) { showContrast(pairState.key === c.dataset.key ? null : c.dataset.key); return; }
    const z = e.target.closest('[data-z]');
    if (z) net.zoom(z.dataset.z);
  }

  function showContrast(key) {
    pairState.key = key;
    $$('.cg', main).forEach(b => b.classList.toggle('on', b.dataset.key === key));
    const box = $('#contrast');
    if (!key) { box.innerHTML = ''; net.highlight(null); return; }
    const [x, y] = key.split('|'), list = byKey.get(key);
    box.innerHTML = `<h3>${vern(x)} and ${vern(y)}: ${list.length} pair${list.length === 1 ? '' : 's'}</h3><ul class="pair-list">` +
      list.map(m => PE[m]).sort((p, q) => (PW[p.a].name < PW[q.a].name ? -1 : 1))
        .map(p => `<li>${pairWord(p.a, p.k)}<span class="vs" aria-hidden="true">·</span>${pairWord(p.b, p.k)}</li>`).join('') +
      '</ul><p class="hint">These pairs are also picked out in the network above.</p>';
    net.highlight(new Set(list), null);
    if (pairState.word != null) { pairState.word = null; $('#pair-word').innerHTML = ''; }
  }

  function selectWord(n, scroll) {
    pairState.word = n;
    const box = $('#pair-word');
    if (n == null) { box.innerHTML = '<p class="hint">Choose a word in the network, or find one above.</p>'; net.highlight(null); return; }
    if (pairState.key) { pairState.key = null; $$('.cg', main).forEach(b => b.classList.remove('on')); $('#contrast').innerHTML = ''; }
    const ms = adj[n], first = PW[n].ids[0], a = wordAudio(n);
    box.innerHTML = `<h3>${a != null ? playBtn(a) : ''}${vern(PW[n].name)} <span class="g">${esc(wordGloss(n))}</span></h3>` +
      `<p class="links"><a href="${dictHref(first)}">Open in the dictionary</a> · <a href="#/web/${enc(E[first].id)}">Word web</a></p>` +
      `<p>${ms.length} minimal pair${ms.length === 1 ? '' : 's'}:</p><ul class="pair-list">` +
      ms.map(m => PE[m]).map(p => {
        const o = p.a === n ? p.b : p.a;
        return `<li><span class="swap">${vern(PW[n].t[p.k])} → ${vern(PW[o].t[p.k])}</span>${pairWord(o, p.k)}</li>`;
      }).join('') + '</ul>';
    net.highlight(new Set(ms), n);
    if (scroll) $('.net-wrap').scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
  }

  // the network: drawn once, at the positions worked out by the build; zoom and drag move the view
  function makeNet(svg) {
    svg.setAttribute('viewBox', `0 0 ${P.w} ${P.h}`);
    const lines = PE.map(e => { const [x1, y1] = P.xy[e.a], [x2, y2] = P.xy[e.b]; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join('');
    const dots = PW.map((w, n) => `<g class="pn" data-n="${n}" transform="translate(${P.xy[n][0]} ${P.xy[n][1]})">` +
      `<circle r="4"/><text dy="-0.75em">${esc(w.name)}</text></g>`).join('');
    svg.innerHTML = `<g class="ne">${lines}</g><g class="nn" lang="${VL}" translate="no">${dots}</g>`;
    const L = $$('line', svg), N = $$('.pn', svg);
    let vb = { x: 0, y: 0, w: P.w, h: P.h };
    const set = () => {
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      const m = svg.getScreenCTM(), k = m ? 1 / m.a : 1;          // user units per screen pixel
      svg.style.setProperty('--k', k);
      svg.classList.toggle('labels', k < 1.1);
    };
    const toUser = (cx, cy) => { const p = new DOMPoint(cx, cy).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
    const zoomAt = (f, ux, uy) => {
      const w = Math.min(Math.max(vb.w / f, 120), P.w * 1.3);
      f = vb.w / w;
      vb = { x: ux - (ux - vb.x) / f, y: uy - (uy - vb.y) / f, w, h: vb.h / f };
      set();
    };
    const fit = () => { vb = { x: -20, y: -20, w: P.w + 40, h: P.h + 40 }; set(); };
    const show = (ns) => {                                           // fit the view around some words
      const xs = ns.map(n => P.xy[n][0]), ys = ns.map(n => P.xy[n][1]);
      const r = svg.getBoundingClientRect(), asp = r.height / r.width || 0.6;
      let w = Math.max(Math.max(...xs) - Math.min(...xs) + 160, 360), h = Math.max(Math.max(...ys) - Math.min(...ys) + 120, 200);
      if (h / w > asp) w = h / asp; else h = w * asp;
      vb = { x: (Math.max(...xs) + Math.min(...xs) - w) / 2, y: (Math.max(...ys) + Math.min(...ys) - h) / 2, w, h };
      set();
    };
    // drag to move, pinch or ctrl/⌘ + wheel to zoom (a plain wheel scrolls the page)
    const ptrs = new Map();
    let moved = 0, pinch = null;
    svg.addEventListener('pointerdown', e => {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* not a real pointer */ }
    });
    svg.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const [px, py] = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const [ux, uy] = toUser((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        zoomAt(d / pinch, ux, uy); pinch = d; moved += 10;
        return;
      }
      const k = 1 / svg.getScreenCTM().a;
      vb.x -= (e.clientX - px) * k; vb.y -= (e.clientY - py) * k;
      moved += Math.abs(e.clientX - px) + Math.abs(e.clientY - py);
      set();
    });
    const up = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (e.type === 'pointerup' && moved < 6) {                    // a tap, not a drag: choose the nearest word
        const [ux, uy] = toUser(e.clientX, e.clientY), k = 1 / svg.getScreenCTM().a;
        let best = null, bd = (18 * k) ** 2;
        P.xy.forEach(([x, y], n) => { const d = (x - ux) ** 2 + (y - uy) ** 2; if (d < bd) { bd = d; best = n; } });
        if (best != null) location.hash = '#/pairs/' + enc(PW[best].name);
      }
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [ux, uy] = toUser(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.01), ux, uy);
    }, { passive: false });
    addEventListener('resize', set);
    fit();
    return {
      zoom(how) {
        if (how === 'fit') return fit();
        zoomAt(how === 'in' ? 1.5 : 1 / 1.5, vb.x + vb.w / 2, vb.y + vb.h / 2);
      },
      highlight(ms, n) {                                            // ms: the pairs (edge numbers) to pick out
        svg.classList.toggle('focus', !!ms);
        const on = new Set();
        L.forEach((l, m) => { const h = !!ms && ms.has(m); l.classList.toggle('hi', h); if (h) { on.add(PE[m].a); on.add(PE[m].b); } });
        N.forEach((g, k) => { g.classList.toggle('hi', on.has(k) || k === n); g.classList.toggle('sel', k === n); });
        if (ms && n != null) show([n, ...on]);
        else if (ms && ms.size) show([...on]);
      },
    };
  }

  // ---- Word web -------------------------------------------------------------------------------------------
  // relation kinds from the build: x the dictionary's own links, s same meaning, o opposite, b/n broader/narrower,
  // P/W has as a part / is part of; plus T for topics.  Three colours: dictionary, meaning, kinds and parts.
  const GROUP = { x: 'dict', s: 'mean', o: 'mean', b: 'kind', n: 'kind', P: 'kind', W: 'kind', T: 'topic' };
  const ORDER = 'xsobnPW';
  const HEAD = { s: 'Same meaning', o: 'Opposite meaning', b: 'Broader meaning', n: 'Narrower meaning',
    P: 'Has as a part', W: 'Part of', x: 'In the dictionary' };
  const FILTERS = [['dict', 'In the dictionary', 'x'], ['mean', 'Same or opposite meaning', 's'],
    ['kind', 'Kinds and parts', 'b'], ['topic', 'Topics', 'T']];
  // how many words fit around the centre depends on the screen (phones show fewer); the list beside has them all
  const web = { on: { dict: true, mean: true, kind: true, topic: true }, nodes: new Map(), target: null };
  const LINKS = X.links;
  const nLinks = i => LINKS[i].length;
  const keyLine = t => `<svg class="key" viewBox="0 0 28 10" aria-hidden="true"><line class="e e-${t}" x1="2" y1="5" x2="26" y2="5"/></svg>`;
  let measure = null;
  const textWidth = (s, font) => {
    measure = measure || document.createElement('canvas').getContext('2d');
    measure.font = font;
    return measure.measureText(s).width;
  };
  const V_FONT = getComputedStyle(document.documentElement).getPropertyValue('--v-font') || 'Georgia, serif';
  const UI_FONT = getComputedStyle(document.documentElement).getPropertyValue('--ui-font') || 'system-ui, sans-serif';

  function webView(parts, fresh) {
    if (fresh) {
      main.innerHTML = '<h1 class="ex-title">Word web</h1>' +
        '<p class="lede">Choose a word to see the words related to it. Choose any word or topic in the web to move to it.</p>' +
        '<div class="web-bar"><div class="find-wrap" id="web-find"></div><button type="button" class="btn" data-random>Another word</button></div>' +
        '<fieldset class="rel-filters"><legend class="sr-only">Links to show</legend>' +
        FILTERS.map(([g, label, t]) => `<label><input type="checkbox" data-g="${g}"${web.on[g] ? ' checked' : ''}>${keyLine(t)}${label}</label>`).join('') +
        '</fieldset>' +
        '<div class="web-layout"><div class="web-graph"><svg class="web-svg" role="img" aria-label="Web of related words; the same words are listed beside it">' +
        '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
        '<path d="M0 1 L9 5 L0 9 z" class="arr"/></marker></defs><g class="edges"></g><g class="nodes"></g></svg>' +
        '<p class="hint">Links from English meanings come from WordNet, a database of English. They join the English glosses, ' +
        'so they can be wrong where an English word has more than one meaning. Arrows point to the broader meaning.</p></div>' +
        '<aside class="web-side" aria-live="polite"></aside></div>';
      finder($('#web-find'), E.map((_, i) => i), i => { location.hash = '#/web/' + enc(E[i].id); }, `Find a word (${LANG} or English)`);
      main.addEventListener('change', e => {
        const c = e.target.closest('[data-g]');
        if (c) { web.on[c.dataset.g] = c.checked; draw(web.target, false); }
      });
      main.addEventListener('click', e => { if (e.target.closest('[data-random]')) location.hash = '#/web/' + enc(E[randomWord()].id); });
      web.nodes = new Map();
    }
    let target;
    if (parts[0] === 'topic' && TOPIC.has(parts[1])) target = { topic: parts[1] };
    else if (byId.has(parts.join('/'))) target = { i: byId.get(parts.join('/')) };
    else { history.replaceState(null, '', '#/web/' + enc(E[randomWord()].id)); return route(); }
    web.target = target;
    draw(target, !fresh);
  }

  function randomWord() {
    const good = E.map((_, i) => i).filter(i => LINKS[i].filter(l => l[1] !== 'x').length >= 4);
    return good[Math.floor(Math.random() * good.length)];
  }

  // the words and edges to draw.  Edge kinds are turned around so that b means "a is a kind of b" (arrow at b)
  // and P means "b is part of a".
  function edge(a, b, t, label, minor) {
    if (t === 'n') return { a: 'e' + b, b: 'e' + a, t: 'b', minor };
    if (t === 'W') return { a: 'e' + b, b: 'e' + a, t: 'P', minor };
    return { a: 'e' + a, b: 'e' + b, t, label, minor };
  }
  const shownLinks = i => LINKS[i].filter(([, t]) => web.on[GROUP[t]])
    .sort((p, q) => ORDER.indexOf(p[1]) - ORDER.indexOf(q[1]) || nLinks(q[0]) - nLinks(p[0]));

  function modelWord(i, cap) {
    const nodes = [{ key: 'e' + i, i, center: true }], edges = [];
    shownLinks(i).slice(0, cap).forEach(([j, t, label]) => { nodes.push({ key: 'e' + j, i: j, t }); edges.push(edge(i, j, t, label)); });
    if (web.on.topic) codesOf(i).filter(c => TOPIC.has(c)).forEach(c => { nodes.push({ key: 'T' + c, code: c }); edges.push({ a: 'e' + i, b: 'T' + c, t: 'T' }); });
    linkAmong(nodes, edges);
    return { nodes, edges, cap };
  }

  function modelTopic(code, cap) {
    const nodes = [{ key: 'T' + code, code, center: true }], edges = [];
    const kids = childrenOf(code), par = parentOf(code);
    if (par) { nodes.push({ key: 'T' + par, code: par }); edges.push({ a: 'T' + code, b: 'T' + par, t: 'T' }); }
    const direct = E.map((_, i) => i).filter(i => codesOf(i).includes(code)), isDirect = new Set(direct);
    const sub = E.map((_, i) => i).filter(i => !isDirect.has(i) && inTopic(i, code));
    const pick = [...direct.sort((p, q) => nLinks(q) - nLinks(p)), ...sub.sort((p, q) => nLinks(q) - nLinks(p))].slice(0, Math.max(4, cap - kids.length - (par ? 1 : 0)));
    const home = i => kids.find(c => inTopic(i, c));                // a word in a smaller topic hangs from that topic
    pick.filter(i => !home(i)).forEach(i => { nodes.push({ key: 'e' + i, i }); edges.push({ a: 'e' + i, b: 'T' + code, t: 'T' }); });
    kids.forEach(c => {                                             // each smaller topic, with its words beside it
      nodes.push({ key: 'T' + c, code: c }); edges.push({ a: 'T' + code, b: 'T' + c, t: 'T' });
      pick.filter(i => home(i) === c).forEach(i => { nodes.push({ key: 'e' + i, i }); edges.push({ a: 'e' + i, b: 'T' + c, t: 'T' }); });
    });
    linkAmong(nodes, edges);
    return { nodes, edges, direct, sub, cap: pick.length };
  }

  // links between the words around the centre: at most two per word, and none that only repeat what the ring
  // already shows (two words that both mean the same as the centre also mean the same as each other)
  function linkAmong(nodes, edges) {
    const here = new Map(nodes.filter(n => n.i != null).map(n => [n.i, n]));
    const has = new Set(edges.map(e => [e.a, e.b].sort().join(' '))), count = new Map(), cand = [];
    nodes.forEach(n => {
      if (n.i == null || n.center) return;
      LINKS[n.i].forEach(([j, t, label]) => {
        const m = here.get(j);
        if (j <= n.i || !m || m.center || !web.on[GROUP[t]] || (t === 's' && n.t === 's' && m.t === 's')) return;
        cand.push([n, m, t, label]);
      });
    });
    cand.sort((p, q) => ORDER.indexOf(p[2]) - ORDER.indexOf(q[2]));
    const add = k => count.set(k, (count.get(k) || 0) + 1);
    cand.forEach(([n, m, t, label]) => {
      if ((count.get(n.key) || 0) >= 2 || (count.get(m.key) || 0) >= 2) return;
      const e = edge(n.i, m.i, t, label, true), k = [e.a, e.b].sort().join(' ');
      if (has.has(k)) return;
      has.add(k); edges.push(e); add(n.key); add(m.key);
    });
  }

  // the picture: the words in a ring around the centre, grouped by kind of link, then eased so that linked words
  // sit a little closer and no two labels overlap.  Words already on screen start where they were.
  function layout(model, centreKey, W, H) {
    const N = model.nodes, idx = new Map(N.map((n, k) => [n.key, k]));
    const shift = web.nodes.get(centreKey) || [0, 0];
    N.forEach(n => {
      if (n.i != null) {
        n.label = E[n.i].hw; n.sub = gloss(n.i);
        n.w = Math.max(textWidth(n.label, `600 ${n.center ? 19 : 15}px ${V_FONT}`), textWidth(n.sub, `12px ${UI_FONT}`)) + 8;
        n.h = n.center ? 54 : 48; n.oy = n.center ? 17 : 14;      // the label hangs below the dot
      } else {
        n.label = TOPIC.get(n.code).name;
        n.w = textWidth(n.label, `600 13px ${UI_FONT}`) + 28; n.h = 30; n.oy = 0;
      }
    });
    const ring = N.filter(n => !n.center);
    const need = ring.reduce((s, n) => s + n.w * 0.75 + 30, 0) / (2 * Math.PI * 1.2);   // ring size the labels need
    const fill = Math.min(1, ring.length / 8);                     // eight or more words use the whole box
    const RX = Math.min(W / 2 - 75, Math.max(150, need * 1.45, (W / 2 - 75) * fill)),
      RY = Math.min(H / 2 - 48, Math.max(110, need, (H / 2 - 48) * fill)), R = RY;
    N.forEach(n => {
      const old = web.nodes.get(n.key);
      if (n.center) { n.x = 0; n.y = 0; } else if (old) { n.x = old[0] - shift[0]; n.y = old[1] - shift[1]; } else {
        const a = 2 * Math.PI * ring.indexOf(n) / ring.length - Math.PI / 2;
        n.x = Math.cos(a) * RX; n.y = Math.sin(a) * RY;
      }
      const a = Math.atan2(n.y, n.x);
      n.r0 = Math.hypot(Math.cos(a) * RX, Math.sin(a) * RY);       // its place on the ring
    });
    const ed = model.edges.map(e => [idx.get(e.a), idx.get(e.b), e.minor]);
    const ITER = 160;
    for (let it = 0; it < ITER; it++) {
      const temp = 18 * (1 - it / ITER) + 0.5, fx = new Float64Array(N.length), fy = new Float64Array(N.length);
      ed.forEach(([p, q, minor]) => {
        const a = N[p], b = N[q], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const toC = a.center || b.center, rest = toC ? (a.center ? b : a).r0 : R * 0.7;
        const f = (d - rest) * (toC ? 0.12 : minor ? 0.015 : 0.05);
        fx[p] += dx / d * f; fy[p] += dy / d * f; fx[q] -= dx / d * f; fy[q] -= dy / d * f;
      });
      N.forEach((n, k) => {                                          // keep to the ring
        if (n.center) return;
        const d = Math.hypot(n.x, n.y) || 1, f = (n.r0 - d) * 0.05;
        fx[k] += n.x / d * f; fy[k] += n.y / d * f;
        const m = Math.hypot(fx[k], fy[k]);
        if (m > temp) { fx[k] *= temp / m; fy[k] *= temp / m; }
        n.x += fx[k]; n.y += fy[k];
      });
      for (let p = 0; p < N.length; p++) {                           // labels must not overlap (the centre stays put)
        for (let q = p + 1; q < N.length; q++) {
          const a = N[p], b = N[q], dx = (b.x - a.x) || 0.01, dy = (b.y + b.oy) - (a.y + a.oy);
          const ox = (a.w + b.w) / 2 + 12 - Math.abs(dx), oy = (a.h + b.h) / 2 + 4 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          const ka = a.center ? 0 : b.center ? 1 : 0.5, kb = 1 - ka;
          if (ox < oy * 1.5) { const m = Math.sign(dx) * ox; a.x -= m * ka; b.x += m * kb; } else { const m = Math.sign(dy || 1) * oy; a.y -= m * ka; b.y += m * kb; }
        }
      }
    }
    const box = N.reduce((b, n) => [Math.min(b[0], n.x - n.w / 2), Math.min(b[1], n.y + n.oy - n.h / 2), Math.max(b[2], n.x + n.w / 2), Math.max(b[3], n.y + n.oy + n.h / 2)],
      [Infinity, Infinity, -Infinity, -Infinity]);
    const x0 = Math.min(box[0] - 16, -W / 2), y0 = Math.min(box[1] - 16, -H / 2 + 8);     // 1 unit = 1 pixel unless it overflows
    return { x: x0, y: y0, w: Math.max(box[2] + 16, W / 2) - x0, h: Math.max(box[3] + 16, H / 2 + 8) - y0 };
  }

  function draw(target, animate) {
    const svg = $('.web-svg'), gE = $('.edges', svg), gN = $('.nodes', svg);
    const r = svg.getBoundingClientRect(), W = Math.max(r.width, 300), H = Math.max(r.height, 300), asp = H / W;
    const rx = W / 2 - 75, ry = H / 2 - 48;                          // the ring's room, and how many words it holds
    const cap = Math.max(6, Math.min(24, Math.floor(Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry))) / 100)));
    const model = target.topic ? modelTopic(target.topic, cap) : modelWord(target.i, cap);
    const centreKey = model.nodes[0].key;
    svg.classList.remove('dim');                                   // a hover on the old picture ends with it
    const before = new Map(web.nodes), oldVB = svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
    const vb = layout(model, centreKey, W, H);                      // fill the box: widen or heighten the view
    if (vb.h / vb.w > asp) { const w = vb.h / asp; vb.x -= (w - vb.w) / 2; vb.w = w; } else { const h = vb.w * asp; vb.y -= (h - vb.h) / 2; vb.h = h; }

    const byKey = new Map(model.nodes.map(n => [n.key, n]));
    gE.innerHTML = model.edges.map(e => `<line class="e e-${e.t}${e.minor ? ' minor' : ''}" data-a="${e.a}" data-b="${e.b}"${e.t === 'b' ? ' marker-end="url(#arr)"' : ''}/>`).join('');
    gN.innerHTML = model.nodes.map(n => {
      const go = n.i != null ? `#/web/${enc(E[n.i].id)}` : `#/web/topic/${enc(n.code)}`;
      if (n.i == null) {
        return `<a class="nd topic${n.center ? ' centre' : ''}" data-key="${n.key}" href="${go}" tabindex="-1" aria-hidden="true">` +
          `<rect x="${-n.w / 2}" y="-14" width="${n.w}" height="28" rx="14"/><text y="5">${esc(n.label)}</text></a>`;
      }
      return `<a class="nd word${n.center ? ' centre' : ''}" data-key="${n.key}" href="${go}" tabindex="-1" aria-hidden="true">` +
        `<circle r="${n.center ? 9 : 6}"/><text class="w" y="${n.center ? 27 : 22}" lang="${VL}" translate="no">${esc(n.label)}</text>` +
        `<text class="s" y="${n.center ? 44 : 37}">${esc(n.sub)}</text></a>`;
    }).join('');
    const lines = $$('line', gE), els = $$('.nd', gN);
    const place = t => {                                             // t: 0 → 1 from the old picture to the new one
      const at = n => {
        const old = before.get(n.key);
        if (!old || t >= 1) return [n.x, n.y];
        return [old[0] + (n.x - old[0]) * t, old[1] + (n.y - old[1]) * t];
      };
      const pos = new Map(model.nodes.map(n => [n.key, at(n)]));
      els.forEach(el => { const [x, y] = pos.get(el.dataset.key); el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); });
      lines.forEach(l => {
        const [x1, y1] = pos.get(l.dataset.a), [x2, y2] = pos.get(l.dataset.b);
        const nb = byKey.get(l.dataset.b), d = Math.hypot(x2 - x1, y2 - y1) || 1;
        const cut = l.classList.contains('e-b') ? (nb.center ? 13 : 10) : 0;      // arrowheads stop at the dot
        l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1));
        l.setAttribute('x2', (x2 - (x2 - x1) / d * cut).toFixed(1)); l.setAttribute('y2', (y2 - (y2 - y1) / d * cut).toFixed(1));
      });
    };
    const setVB = v => svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
    // the old picture's positions are relative to the old centre; move them so the new centre's old place is 0,0
    const shift = before.get(centreKey);
    if (shift) before.forEach((p, k) => before.set(k, [p[0] - shift[0], p[1] - shift[1]]));
    if (animate && !reduced.matches && before.size) {
      const v0 = oldVB ? { x: oldVB.x - (shift ? shift[0] : 0), y: oldVB.y - (shift ? shift[1] : 0), w: oldVB.width, h: oldVB.height } : vb;
      const t0 = performance.now(), T = 450;
      els.forEach(el => { if (!before.has(el.dataset.key)) el.style.opacity = 0; });
      const step = now => {
        const t = Math.min(1, (now - t0) / T), e = 1 - (1 - t) ** 3;
        place(e);
        setVB({ x: v0.x + (vb.x - v0.x) * e, y: v0.y + (vb.y - v0.y) * e, w: v0.w + (vb.w - v0.w) * e, h: v0.h + (vb.h - v0.h) * e });
        els.forEach(el => { if (!before.has(el.dataset.key)) el.style.opacity = e; });
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else { place(1); setVB(vb); }
    web.nodes = new Map(model.nodes.map(n => [n.key, [n.x, n.y]]));
    // hovering a word picks out its links
    els.forEach(el => {
      el.addEventListener('pointerenter', () => {
        const k = el.dataset.key, near = new Set([k]);
        lines.forEach(l => { const h = l.dataset.a === k || l.dataset.b === k; l.classList.toggle('hi', h); if (h) { near.add(l.dataset.a); near.add(l.dataset.b); } });
        els.forEach(o => o.classList.toggle('hi', near.has(o.dataset.key)));
        svg.classList.add('dim');
      });
      el.addEventListener('pointerleave', () => svg.classList.remove('dim'));
    });
    side(target, model);
  }

  // the list beside the web: everything the web shows (and more), for reading and for keyboards
  function side(target, model) {
    const box = $('.web-side');
    const item = i => `<li><a href="#/web/${enc(E[i].id)}">${vern(E[i].hw)}${hm(i)}</a> <span class="g">${esc(gloss(i, 60))}</span>${playBtn(i, 'inline')}</li>`;
    const topicItem = c => `<li><a href="#/web/topic/${enc(c)}">${esc(TOPIC.get(c).name)}</a> <span class="g">${fmt(TOPIC.get(c).n)} words</span></li>`;
    if (target.topic) {
      const c = target.topic, t = TOPIC.get(c), par = parentOf(c), kids = childrenOf(c);
      box.innerHTML = `<h2 class="side-title">${esc(t.name)}</h2><p class="g">Topic · ${fmt(t.n)} words</p>` +
        `<p class="links"><a href="../#/topic/${enc(c)}">Open in the dictionary</a></p>` +
        (par ? `<h3>${keyLine('T')}Part of</h3><ul class="rel">${topicItem(par)}</ul>` : '') +
        (kids.length ? `<h3>${keyLine('T')}Smaller topics</h3><ul class="rel">${kids.map(topicItem).join('')}</ul>` : '') +
        (model.direct.length ? `<h3>Words</h3><ul class="rel">${model.direct.map(item).join('')}</ul>` : '') +
        (model.direct.length + model.sub.length > model.cap ? `<p class="hint">The web shows ${model.cap} of the ${fmt(model.direct.length + model.sub.length)} words.</p>` : '');
      document.title = `${t.name} – Word web – Explore ${LANG}`;
      return;
    }
    const i = target.i, rel = LINKS[i], groups = new Map();
    rel.forEach(([j, t, label]) => {
      const head = t === 'x' ? label : HEAD[t];
      if (!groups.has(head)) groups.set(head, { t: t === 'n' ? 'b' : t === 'W' ? 'P' : t, list: [] });
      groups.get(head).list.push(j);
    });
    const order = [...groups.entries()].sort((a, b) => ORDER.indexOf(a[1].t) - ORDER.indexOf(b[1].t));
    const codes = codesOf(i).filter(c => TOPIC.has(c));
    box.innerHTML = `<h2 class="side-title">${vern(E[i].hw)}${hm(i)}${playBtn(i)}</h2>` +
      `<p class="g">${esc(GL[i].join('; ') || CLASS[E[i].cls] || '')}${CLASS[E[i].cls] ? ` · ${esc(CLASS[E[i].cls].toLowerCase().replace(/s$/, '').replace(/ & .*/, ''))}` : ''}</p>` +
      `<p class="links"><a href="${dictHref(i)}">Open in the dictionary</a>` +
      (nodeOfEntry.has(i) ? ` · <a href="#/pairs/${enc(PW[nodeOfEntry.get(i)].name)}">Sound pairs</a>` : '') + '</p>' +
      order.map(([head, g]) => `<h3>${keyLine(g.t)}${esc(head)}${web.on[GROUP[g.t]] ? '' : ' <small>(hidden in the web)</small>'}</h3>` +
        `<ul class="rel">${g.list.map(item).join('')}</ul>`).join('') +
      (codes.length ? `<h3>${keyLine('T')}Topics</h3><ul class="rel">${codes.map(topicItem).join('')}</ul>` : '') +
      (!rel.length && !codes.length ? '<p class="hint">No links found for this word yet.</p>' : '') +
      (shownLinks(i).length > model.cap ? `<p class="hint">The web shows ${model.cap} of the ${shownLinks(i).length} linked words.</p>` : '');
    document.title = `${E[i].hw} – Word web – Explore ${LANG}`;
  }

  // ---- pages ----------------------------------------------------------------------------------------------
  let current = '';
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const view = ['numbers', 'pairs', 'web'].includes(parts[0]) ? parts[0] : 'numbers';
    $$('.tabs [data-tab]').forEach(a => {
      const on = a.dataset.tab === view;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const fresh = view !== current;
    if (fresh) { const m = main.cloneNode(false); main.replaceWith(m); main = m; }   // drop the old page's listeners
    current = view;
    if (view === 'numbers') { if (fresh) numbersView(); document.title = `${LANG} in numbers – Explore ${LANG}`; }
    else if (view === 'pairs') { pairsView(parts.slice(1).join('/'), fresh); document.title = `Sound pairs – Explore ${LANG}`; }
    else webView(parts.slice(1), fresh);
    if (fresh) scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  route();
})();
