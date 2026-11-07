/* Learn tab, shared parts: which words can be played, topics, settings bar, end-of-round panel,
   letters and keyboard helpers, tricky words, and the game registry.  Each game is its own file in
   docs/games/ and calls DictGames.register(); the build lists those files in index.html.
   view(main, game, ctx) draws the Learn page or a game; ctx comes from app.js. */
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
  // a topic is a FLEx semantic domain code (with its subdomains), or 'tricky' for the player's tricky words
  const inTopic = (it, code) => !code || (code === 'tricky' ? Object.prototype.hasOwnProperty.call(trickyMap(), it.id)
    : (it.c.sd || []).some(d => d.startsWith(code + ' ') || d.startsWith(code + '.')));
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
    level: ctx.store.get('g.level', 'easy'),          // listen and choose: easy / hard
    answer: ctx.store.get('g.answer', 'word'),        // listen and choose: answer with the word or its meaning
  });

  /** a row of choice buttons; picking one stores it as g.<key> */
  const segHTML = (key, label, cur, choices) => `<div class="seg2" role="group" aria-label="${esc(label)}">` +
    choices.map(([v, t]) => `<button type="button" data-g="${key}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`).join('') + '</div>';

  /** settings bar: topic, recordings-only (unless audio: false), direction (withDir), and any extra choices */
  function barHTML(s, withDir, { audio = true, extra = '' } = {}) {
    const tops = topics(s);
    const nTricky = pool(Object.assign({}, s, { topic: 'tricky' })).length;
    if (s.topic && s.topic !== 'tricky' && !tops.some(t => t.code === s.topic)) s.topic = '';
    const all = pool(s, true).length;
    const opts = [`<option value="">All words (${all})</option>`].concat(
      nTricky || s.topic === 'tricky' ? [`<option value="tricky"${s.topic === 'tricky' ? ' selected' : ''}>★ My tricky words (${nTricky})</option>`] : [],
      tops.map(t =>
      `<option value="${t.code}"${t.code === s.topic ? ' selected' : ''}>${' '.repeat(t.code.split('.').length - 1)}${esc(t.name)} (${t.n})</option>`));
    const L = esc(ctx.lang);
    return '<div class="game-bar">' +
      `<label class="gsel">Topic <select data-g="topic">${opts.join('')}</select></label>` +
      (audio ? `<label class="chk2"><input type="checkbox" data-g="audio"${s.audio ? ' checked' : ''}> Only words with recordings</label>` : '') +
      (withDir ? segHTML('dir', 'Direction', s.dir, [['k2e', `${L} → English`], ['e2k', `English → ${L}`]]) : '') +
      extra + '<button type="button" class="gbtn" data-g="new">New round</button></div>';
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
      if (b.dataset.v) ctx.store.set('g.' + b.dataset.g, b.dataset.v);
      redraw();
    });
  }

  const tooFew = n => (ctx.store.get('g.topic', '') === 'tricky'
    ? `<p class="empty">You have ${n} tricky ${n === 1 ? 'word' : 'words'} that fit this game, not enough for a round. Words you get wrong in any game are added; choose another topic for now.</p>`
    : `<p class="empty">There aren't enough words for this game in this topic (${n}). Choose another topic, or untick "Only words with recordings".</p>`);

  /** end-of-round panel: message, play again, and the words played (cards link to their entries) */
  function finishHTML(msg, words) {
    ctx.setList(words.map(it => it.id));
    return `<div class="gdone"><p class="gdone-msg">${msg}</p><button type="button" class="gbtn primary" data-again>Play again</button></div>` +
      `<h3 class="section-title">Words in this round</h3><div class="grid">${words.map(it => ctx.R.cardHTML(it)).join('')}</div>`;
  }

  // ---- letter games: the language's own letters (ctx.keyboard); two-letter units like ng or dh count as one
  function letterKit() {
    const rows = ctx.keyboard, units = new Set(rows.flat());
    const multi = [...units].filter(u => u.length > 1).sort((a, b) => b.length - a.length);
    const tok = w => { const out = []; let i = 0; while (i < w.length) { const u = multi.find(m => w.startsWith(m, i)) || w[i]; out.push(u); i += u.length; } return out; };
    const plain = it => hw(it).toLowerCase();
    const fits = it => { const w = plain(it); if (!/^[a-z]+$/.test(w)) return false; const t = tok(w); return t.length >= 4 && t.length <= 6 && t.every(u => units.has(u)); };
    /** the on-screen keyboard; state = letter -> hit/near/miss; extra = buttons added to the last row */
    const keysHTML = (state, extra = '', disableUsed = false) => '<div class="hd-keys">' + rows.map((row, ri) => '<div class="hd-krow">' +
      row.map(u => `<button type="button" class="hk ${state[u] || ''}" data-k="${esc(u)}"${disableUsed && state[u] ? ' disabled' : ''}>${esc(u)}</button>`).join('') +
      (ri === rows.length - 1 ? extra : '') + '</div>').join('') + '</div>';
    return { rows, units, tok, plain, fits, keysHTML };
  }
  const listenBtn = it => (it.c.audio ? `<button type="button" class="gbtn" data-listen="${esc(it.c.audio)}">Listen</button>` : '');


  // ---- tricky words: kept on this device only (localStorage). A wrong answer adds the word; two right
  //      answers in a row take it off the list.  Games report with record(item, rightOrWrong).
  const trickyMap = () => { try { return JSON.parse(ctx.store.get('tricky', '{}')) || {}; } catch (e) { return {}; } };
  function record(it, right) {
    if (!it) return;
    const t = trickyMap(), r = t[it.id];
    if (!right) t[it.id] = { miss: (r ? r.miss : 0) + 1, streak: 0, t: Date.now() };
    else if (r) { r.streak = (r.streak || 0) + 1; if (r.streak >= 2) delete t[it.id]; }
    ctx.store.set('tricky', JSON.stringify(t));
  }
  const speakerHTML = (file, cls = '') => `<button type="button" class="play ${cls}" data-audio="${esc(file)}" aria-label="Listen">` +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9.5v5h4l5 4v-13l-5 4H3z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>';

  // ---- registry and the Learn page --------------------------------------------------------
  const GAMES = [];
  const SECTIONS = ['Every day', 'Words and meanings', 'Listening', 'Spelling'];   // a game's `group` puts it in one of these
  function register(game) { GAMES.push(game); GAMES.sort((a, b) => a.order - b.order); }
  const available = () => GAMES.filter(g => g.needs !== 'keyboard' || (ctx.keyboard && ctx.keyboard.length));

  function trickyPage(main) {
    const t = trickyMap();
    const its = ctx.items.filter(it => t[it.id]).sort((a, b) => t[b.id].miss - t[a.id].miss);
    ctx.setList(its.map(it => it.id));
    main.innerHTML = '<a class="gback" href="#/learn">‹ All games</a><h2 class="gtitle">★ My tricky words</h2>' +
      '<p class="gintro">Words you got wrong in the games, most-missed first. Choose <strong>★ My tricky words</strong> as the topic ' +
      'in any game to practise them; a word comes off the list after you get it right twice in a row. ' +
      'The list is kept on this device only.</p>' +
      (its.length ? `<div class="grid">${its.map(it => ctx.R.cardHTML(it, `missed ${t[it.id].miss}×`)).join('')}</div>` +
        '<p><button type="button" class="gbtn" data-clear-tricky>Clear the list</button></p>'
        : '<p class="empty">No tricky words yet. Words you get wrong in the games will appear here.</p>');
    main.querySelector('[data-clear-tricky]')?.addEventListener('click', () => {
      if (confirm('Clear your tricky words?')) { ctx.store.set('tricky', '{}'); trickyPage(main); }
    });
  }

  function view(main, game, context) {
    ctx = context;
    if (game === 'tricky') { trickyPage(main); return; }
    const games = available();
    const g = games.find(x => x.id === game);
    if (!g) {
      ctx.setList([]);
      const n = Object.keys(trickyMap()).length;
      main.innerHTML = `<h2 class="gtitle">Learn ${esc(ctx.lang)}</h2><p class="gintro">Games with words from the dictionary. ` +
        'Choose a topic in each game, and listen to the words as you match them.</p>' +
        (n ? `<a class="tricky-band" href="#/learn/tricky"><strong>★ ${n} tricky ${n === 1 ? 'word' : 'words'}</strong>` +
          '<span>See them, or choose “My tricky words” as the topic in any game to practise.</span></a>' : '') +
        SECTIONS.concat(['More games']).map(sec => {
          const here = games.filter(x => (SECTIONS.includes(x.group) ? x.group : 'More games') === sec);
          return here.length ? `<h3 class="section-title">${esc(sec)}</h3><div class="learn-grid">` + here.map(x =>
            `<a class="learn-tile" href="#/learn/${x.id}"><span class="lt-title">${esc(x.title)}</span>` +
            `<span class="lt-desc">${esc(x.desc)}</span></a>`).join('') + '</div>' : '';
        }).join('');
      return;
    }
    main.innerHTML = '<a class="gback" href="#/learn">‹ All games</a><div class="game"></div>';
    ctx.setList([]);
    g.run(main.querySelector('.game'), ctx);
  }

  /** topic groups for the sorting games: specific FLEx domains (two levels deep or more, e.g. Bird, Body, Food)
      with at least `min` playable words.  top = the top-level number, so groups from different tops never overlap. */
  function domainGroups(s, min) {
    const base = pool(Object.assign({}, s, { topic: '' }), true), names = new Map();
    base.forEach(it => (it.c.sd || []).forEach(d => { const m = /^([\d.]+)\s+(.*)$/.exec(d); if (m && m[1].includes('.')) names.set(m[1], m[2]); }));
    return [...names].map(([code, name]) => ({ code, name, top: code.split('.')[0], items: base.filter(it => inTopic(it, code)) }))
      .filter(g => g.items.length >= min);
  }
  const tops = it => new Set((it.c.sd || []).map(d => d.split(/[.\s]/)[0]));

  const kit = { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML,
    letterKit, listenBtn, record, speakerHTML, inTopic, domainGroups, tops, CLASSES, get ctx() { return ctx; } };
  return { register, view, kit };
})();
