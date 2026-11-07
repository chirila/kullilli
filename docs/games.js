/* Learning games for the Learn tab: memory pairs, match-up (drag and drop or tap), word in the middle.
   view(main, game, ctx) draws a game into the page; ctx comes from app.js
   (items, language name, render helpers, settings store, audio player, entry list for prev/next). */
'use strict';
window.DictGames = (() => {
  let ctx;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hw = it => it.c.lc || it.c.hw;

  // ---- which words can be played --------------------------------------------------------
  // Content words with a short, certain gloss; no affixes, pronoun labels, place names or variant spellings.
  const CLASSES = new Set(['noun', 'verb', 'adjective', 'adverb', 'interjection', 'other']);
  const glossCache = new Map();
  function gloss(it) {
    if (glossCache.has(it)) return glossCache.get(it);
    let g = (it.c.senses || []).flatMap(s => s.gl || [])[0] || '';
    if (/[?|\d]|unknown/i.test(g)) g = '';
    g = g.trim();
    if (g.length > 24) g = g.replace(/\s*\([^)]*\)/g, '').trim();     // "set (sun)" keeps its brackets if it fits
    if (g.length > 24) g = g.split(/\s*[;,]\s*/)[0];
    if (g.length > 24) g = '';
    glossCache.set(it, g);
    return g;
  }
  const inTopic = (it, code) => !code || (it.c.sd || []).some(d => d.startsWith(code + ' ') || d.startsWith(code + '.'));
  const pool = (s, anyTopic) => ctx.items.filter(it => !it.parent && !it.c.see && CLASSES.has(it.c.cls) && gloss(it)
    && (!s.audio || it.c.audio) && (anyTopic || inTopic(it, s.topic)));

  /** n words with different glosses and headwords */
  function pick(list, n) {
    const out = [], seenG = new Set(), seenW = new Set();
    for (const it of shuffle(list)) {
      const g = gloss(it).toLowerCase(), w = hw(it).toLowerCase();
      if (seenG.has(g) || seenW.has(w)) continue;
      seenG.add(g); seenW.add(w); out.push(it);
      if (out.length === n) break;
    }
    return out;
  }

  // FLEx semantic domains as topics (a domain includes its subdomains); only those with enough words
  function topics(s) {
    const base = pool(s, true), names = new Map();
    base.forEach(it => (it.c.sd || []).forEach(d => { const m = /^([\d.]+)\s+(.*)$/.exec(d); if (m) names.set(m[1], m[2]); }));
    const num = code => code.split('.').map(Number);
    return [...names].map(([code, name]) => ({ code, name, n: base.filter(it => inTopic(it, code)).length }))
      .filter(t => t.n >= 6)
      .sort((a, b) => { const x = num(a.code), y = num(b.code); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1); } return 0; });
  }

  // ---- settings (remembered) ------------------------------------------------------------
  const settings = () => ({
    topic: ctx.store.get('g.topic', ''),
    audio: ctx.store.get('g.audio', '1') === '1',
    dir: ctx.store.get('g.dir', 'k2e'),
  });

  function barHTML(s, withDir) {
    const tops = topics(s);
    if (s.topic && !tops.some(t => t.code === s.topic)) s.topic = '';
    const all = pool(s, true).length;
    const opts = [`<option value="">All words (${all})</option>`].concat(tops.map(t =>
      `<option value="${t.code}"${t.code === s.topic ? ' selected' : ''}>${' '.repeat(t.code.split('.').length - 1)}${esc(t.name)} (${t.n})</option>`));
    const L = esc(ctx.lang);
    return '<div class="game-bar">' +
      `<label class="gsel">Topic <select data-g="topic">${opts.join('')}</select></label>` +
      `<label class="chk2"><input type="checkbox" data-g="audio"${s.audio ? ' checked' : ''}> Only words with recordings</label>` +
      (withDir ? `<div class="seg2" role="group" aria-label="Direction">` +
        `<button type="button" data-g="dir" data-v="k2e" aria-pressed="${s.dir === 'k2e'}">${L} → English</button>` +
        `<button type="button" data-g="dir" data-v="e2k" aria-pressed="${s.dir === 'e2k'}">English → ${L}</button></div>` : '') +
      '<button type="button" class="gbtn" data-g="new">New round</button></div>';
  }

  function wireBar(root, redraw) {
    root.querySelector('.game-bar').addEventListener('change', e => {
      const k = e.target.dataset.g;
      if (k === 'topic') ctx.store.set('g.topic', e.target.value);
      if (k === 'audio') ctx.store.set('g.audio', e.target.checked ? '1' : '0');
      redraw();
    });
    root.querySelector('.game-bar').addEventListener('click', e => {
      const b = e.target.closest('button[data-g]');
      if (!b) return;
      if (b.dataset.g === 'dir') ctx.store.set('g.dir', b.dataset.v);
      redraw();
    });
  }

  const tooFew = n => `<p class="empty">There aren't enough words for this game in this topic (${n}). Choose another topic, or untick "Only words with recordings".</p>`;

  /** end-of-round panel: message, play again, and the words played (cards link to their entries) */
  function finishHTML(msg, words) {
    ctx.setList(words.map(it => it.id));
    return `<div class="gdone"><p class="gdone-msg">${msg}</p><button type="button" class="gbtn primary" data-again>Play again</button></div>` +
      `<h3 class="section-title">Words in this round</h3><div class="grid">${words.map(it => ctx.R.cardHTML(it)).join('')}</div>`;
  }

  // ---- 1. memory pairs ----------------------------------------------------------------
  function memory(root) {
    const s = settings();
    root.innerHTML = '<h2 class="gtitle">Memory pairs</h2><p class="gintro">Turn over two cards at a time and find each ' +
      `${esc(ctx.lang)} word and its English meaning.</p>` + barHTML(s, false) + '<div class="gplay"></div>';
    wireBar(root, () => memory(root));
    const play = root.querySelector('.gplay');
    const words = pick(pool(s), 6);
    if (words.length < 4) { play.innerHTML = tooFew(words.length); return; }
    const cards = shuffle(words.flatMap(it => [{ it, side: 'k' }, { it, side: 'e' }]));
    play.innerHTML = '<p class="gstat" aria-live="polite">Moves: 0</p><div class="mem-grid">' + cards.map((cd, i) =>
      `<button type="button" class="mcard ${cd.side}" data-i="${i}" aria-label="Card ${i + 1}, face down">` +
      `<span class="mface${cd.side === 'k' ? ' v' : ''}">${esc(cd.side === 'k' ? hw(cd.it) : gloss(cd.it))}</span></button>`).join('') + '</div>';
    let open = [], moves = 0, found = 0, busy = false;
    const el = i => play.querySelector(`.mcard[data-i="${i}"]`);
    const show = (i, on) => { const b = el(i), cd = cards[i]; b.classList.toggle('up', on);
      b.setAttribute('aria-label', on ? (cd.side === 'k' ? hw(cd.it) : gloss(cd.it)) : `Card ${i + 1}, face down`); };
    play.querySelector('.mem-grid').addEventListener('click', e => {
      const b = e.target.closest('.mcard');
      if (!b || busy || b.classList.contains('up')) return;
      const i = +b.dataset.i;
      show(i, true);
      open.push(i);
      if (open.length < 2) return;
      moves++;
      const [a, c] = open;
      open = [];
      play.querySelector('.gstat').textContent = `Moves: ${moves}`;
      if (cards[a].it === cards[c].it) {
        el(a).classList.add('got'); el(c).classList.add('got');
        if (cards[a].it.c.audio) ctx.playFile(cards[a].it.c.audio);
        if (++found === words.length) {
          setTimeout(() => { play.innerHTML = finishHTML(`You found all ${words.length} pairs in ${moves} moves.`, words); }, 900);
        }
      } else {
        busy = true;
        setTimeout(() => { show(a, false); show(c, false); busy = false; }, 1000);
      }
    });
    play.addEventListener('click', e => { if (e.target.closest('[data-again]')) memory(root); });
  }

  // ---- 2. match-up: drag one side onto the other, or tap one then the other ---------------------
  function match(root) {
    const s = settings();
    const L = esc(ctx.lang);
    root.innerHTML = '<h2 class="gtitle">Match up</h2><p class="gintro">' +
      (s.dir === 'k2e' ? `Drag each ${L} word onto its English meaning.` : `Drag each English meaning onto its ${L} word.`) +
      ' On a phone you can also tap one, then the other.</p>' + barHTML(s, true) + '<div class="gplay"></div>';
    wireBar(root, () => match(root));
    const play = root.querySelector('.gplay');
    const words = pick(pool(s), 6);
    if (words.length < 3) { play.innerHTML = tooFew(words.length); return; }
    const item = (it, side) => `<button type="button" class="mitem ${side}${side === 'k' ? ' v' : ''}" data-id="${esc(it.id)}" data-side="${side}">` +
      `${esc(side === 'k' ? hw(it) : gloss(it))}</button>`;
    const left = s.dir === 'k2e' ? 'k' : 'e', right = left === 'k' ? 'e' : 'k';
    play.innerHTML = '<p class="gstat" aria-live="polite">Matched: 0 of ' + words.length + '</p><div class="match-cols">' +
      `<div class="mcol">${shuffle(words).map(it => item(it, left)).join('')}</div>` +
      `<div class="mcol">${shuffle(words).map(it => item(it, right)).join('')}</div></div>`;

    let sel = null, done = 0, mistakes = 0;
    const byId = id => words.find(it => it.id === id);
    function tryPair(a, b) {
      if (!a || !b || a === b || a.dataset.side === b.dataset.side) return false;
      if (a.dataset.id === b.dataset.id) {
        [a, b].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; });
        const it = byId(a.dataset.id);
        if (it.c.audio) ctx.playFile(it.c.audio);
        play.querySelector('.gstat').textContent = `Matched: ${++done} of ${words.length}`;
        if (done === words.length) {
          setTimeout(() => { play.innerHTML = finishHTML(`All ${words.length} matched` +
            (mistakes ? `, with ${mistakes} ${mistakes === 1 ? 'try' : 'tries'} that didn't fit.` : ' first time!'), words); }, 900);
        }
      } else {
        mistakes++;
        [a, b].forEach(x => { x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad'); });
      }
      return true;
    }
    function select(b) {
      if (sel === b) { b.classList.remove('sel'); sel = null; return; }
      if (sel && sel.dataset.side !== b.dataset.side) { const a = sel; sel = null; a.classList.remove('sel'); tryPair(a, b); return; }
      if (sel) sel.classList.remove('sel');
      sel = b; b.classList.add('sel');
    }

    // pointer events cover mouse, touch and pen; a short press without moving counts as a tap
    let drag = null;
    play.addEventListener('pointerdown', e => {
      const b = e.target.closest('.mitem');
      if (!b || b.disabled || e.button > 0) return;
      drag = { b, x: e.clientX, y: e.clientY, ghost: null };
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* moves still reach the board */ }
    });
    play.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
        drag.ghost = drag.b.cloneNode(true);
        drag.ghost.classList.add('ghost');
        drag.ghost.style.width = drag.b.offsetWidth + 'px';
        document.body.appendChild(drag.ghost);
        drag.b.classList.add('lifted');
      }
      drag.ghost.style.left = (e.clientX - drag.b.offsetWidth / 2) + 'px';
      drag.ghost.style.top = (e.clientY - 22) + 'px';
      play.querySelectorAll('.mitem.over').forEach(x => x.classList.remove('over'));
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const t = under && under.closest('.mitem');
      if (t && !t.disabled && t.dataset.side !== drag.b.dataset.side) t.classList.add('over');
    });
    const end = e => {
      if (!drag) return;
      const { b, ghost } = drag;
      drag = null;
      play.querySelectorAll('.mitem.over').forEach(x => x.classList.remove('over'));
      b.classList.remove('lifted');
      if (!ghost) { if (e.type === 'pointerup') select(b); return; }
      ghost.remove();
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const t = under && under.closest('.mitem');
      if (t && !t.disabled) { if (sel) { sel.classList.remove('sel'); sel = null; } tryPair(b, t); }
    };
    play.addEventListener('pointerup', end);
    play.addEventListener('pointercancel', end);
    play.addEventListener('keydown', e => {                  // keyboard: Enter/Space on a word = tap
      const b = e.target.closest('.mitem');
      if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(b); }
    });
    play.addEventListener('click', e => { if (e.target.closest('[data-again]')) match(root); });
  }

  // ---- 3. word in the middle: one word in the centre, meanings in a circle round it ------------------
  function circle(root) {
    const s = settings();
    const L = esc(ctx.lang);
    root.innerHTML = '<h2 class="gtitle">Word in the middle</h2><p class="gintro">' +
      (s.dir === 'k2e' ? `Tap the English meaning of the ${L} word in the middle.` : `Tap the ${L} word for the English in the middle.`) +
      '</p>' + barHTML(s, true) + '<div class="gplay"></div>';
    wireBar(root, () => circle(root));
    const play = root.querySelector('.gplay');
    const list = pool(s);
    const qs = pick(list, 10);
    if (qs.length < 4) { play.innerHTML = tooFew(qs.length); return; }
    let q = 0, score = 0;
    const others = list.length >= 12 ? list : pool(s, true);       // small topic: take wrong answers from all words

    function ask() {
      const it = qs[q];
      const opts = shuffle([it].concat(pick(others.filter(x => gloss(x).toLowerCase() !== gloss(it).toLowerCase()
        && hw(x).toLowerCase() !== hw(it).toLowerCase()), 5)));
      const k2e = s.dir === 'k2e';
      const centre = k2e
        ? `<span class="cw-word v">${esc(hw(it))}</span>${it.c.audio ? `<button type="button" class="play" data-audio="${esc(it.c.audio)}" aria-label="Listen">` +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9.5v5h4l5 4v-13l-5 4H3z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>' : ''}`
        : `<span class="cw-word">${esc(gloss(it))}</span>`;
      const n = opts.length;
      play.innerHTML = `<p class="gstat" aria-live="polite">Question ${q + 1} of ${qs.length} · Score ${score}</p>` +
        `<div class="circle"><div class="cw">${centre}</div>` + opts.map((o, i) => {
          const a = -Math.PI / 2 + i * 2 * Math.PI / n;
          return `<button type="button" class="opt${k2e ? '' : ' v'}" data-id="${esc(o.id)}" style="left:${(50 + 36 * Math.cos(a)).toFixed(2)}%;top:${(50 + 36 * Math.sin(a)).toFixed(2)}%">` +
            `${esc(k2e ? gloss(o) : hw(o))}</button>`;
        }).join('') + '</div><div class="gnext"></div>';
      if (k2e && it.c.audio) ctx.playFile(it.c.audio);
    }
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { circle(root); return; }
      if (e.target.closest('[data-next]')) { next(); return; }
      const b = e.target.closest('.opt');
      if (!b || play.querySelector('.opt.right, .opt.wrong')) return;
      const it = qs[q];
      const right = b.dataset.id === it.id;
      b.classList.add(right ? 'right' : 'wrong');
      if (!right) play.querySelector(`.opt[data-id="${CSS.escape(it.id)}"]`).classList.add('right');
      play.querySelectorAll('.opt').forEach(x => { x.disabled = true; });
      if (right) score++;
      if (it.c.audio) ctx.playFile(it.c.audio);
      play.querySelector('.gstat').textContent = `Question ${q + 1} of ${qs.length} · Score ${score}`;
      if (right) setTimeout(next, 1100);
      else play.querySelector('.gnext').innerHTML = '<button type="button" class="gbtn primary" data-next>Next</button>';
    });
    function next() {
      if (!play.querySelector('.opt.right')) return;                  // already moved on
      q++;
      if (q < qs.length) ask();
      else play.innerHTML = finishHTML(`You got ${score} out of ${qs.length}.`, qs);
    }
    ask();
  }

  // ---- the Learn page --------------------------------------------------------------------
  const GAMES = [
    ['memory', 'Memory pairs', 'Turn over cards to find each word and its meaning.', memory],
    ['match', 'Match up', 'Drag words onto their meanings, or tap one and then the other.', match],
    ['circle', 'Word in the middle', 'Pick the right meaning from the circle round the word.', circle],
  ];

  function view(main, game, context) {
    ctx = context;
    const g = GAMES.find(x => x[0] === game);
    if (!g) {
      ctx.setList([]);
      main.innerHTML = `<h2 class="gtitle">Learn ${esc(ctx.lang)}</h2><p class="gintro">Games with words from the dictionary. ` +
        'Choose a topic in each game, and listen to the words as you match them.</p><div class="learn-grid">' +
        GAMES.map(([k, t, d]) => `<a class="learn-tile" href="#/learn/${k}"><span class="lt-title">${t}</span><span class="lt-desc">${d}</span></a>`).join('') + '</div>';
      return;
    }
    main.innerHTML = '<a class="gback" href="#/learn">‹ All games</a><div class="game"></div>';
    ctx.setList([]);
    g[3](main.querySelector('.game'));
  }

  return { view };
})();
