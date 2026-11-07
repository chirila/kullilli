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
  // a topic is a FLEx semantic domain code (with its subdomains), or one of the player's own lists:
  // 'study' (words they bookmarked), 'tricky' (words they got wrong), 'new' (words not yet practised)
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const LISTS = { study: () => ctx.study.map(), tricky: () => trickyMap(), new: () => practisedMap() };
  const inList = (it, code, m) => (code === 'new' ? !has(m, it.id) : has(m, it.id));
  const inTopic = (it, code) => !code || (LISTS[code] ? inList(it, code, LISTS[code]())
    : (it.c.sd || []).some(d => d.startsWith(code + ' ') || d.startsWith(code + '.')));
  function pool(s, anyTopic) {
    const code = anyTopic ? '' : s.topic, m = LISTS[code] && LISTS[code]();
    return ctx.items.filter(it => !it.parent && !it.c.see && CLASSES.has(it.c.cls) && gloss(it)
      && (!s.audio || it.c.audio) && (m ? inList(it, code, m) : inTopic(it, code)));
  }

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
    const n = code => pool(Object.assign({}, s, { topic: code })).length;
    if (s.topic && !LISTS[s.topic] && !tops.some(t => t.code === s.topic)) s.topic = '';
    const nTricky = n('tricky');
    const own = [['study', `My study list (${n('study')})`]]
      .concat(nTricky || s.topic === 'tricky' ? [['tricky', `★ My tricky words (${nTricky})`]] : [], [['new', `Not practised yet (${n('new')})`]]);
    const opts = [`<option value="">All words (${pool(s, true).length})</option>`].concat(
      own.map(([v, t]) => `<option value="${v}"${s.topic === v ? ' selected' : ''}>${esc(t)}</option>`),
      tops.map(t =>
      `<option value="${t.code}"${t.code === s.topic ? ' selected' : ''}>${' '.repeat(t.code.split('.').length - 1)}${esc(t.name)} (${t.n})</option>`));
    const L = esc(ctx.lang);
    return '<div class="game-bar">' +
      `<label class="gsel">Topic <select data-g="topic">${opts.join('')}</select></label>` +
      (audio ? `<label class="chk2"><input type="checkbox" data-g="audio"${s.audio ? ' checked' : ''}> Only words with recordings</label>` : '') +
      autoplayHTML() +
      (withDir ? segHTML('dir', 'Direction', s.dir, [['k2e', `${L} → English`], ['e2k', `English → ${L}`]]) : '') +
      extra + '<button type="button" class="gbtn" data-g="new">New round</button></div>';
  }

  /** settings bar: every control with data-g is stored as g.<name>; changing one starts a new round,
      except "Play sounds automatically", which just takes effect. Focus stays on the control that changed. */
  function wireBar(root, redraw) {
    const bar = root.querySelector('.game-bar');
    const again = sel => { redraw(); const el = root.querySelector(sel); if (el && lastInput === 'key') el.focus(); };
    bar.addEventListener('change', e => {
      const k = e.target.dataset.g;
      if (!k) return;
      ctx.store.set('g.' + k, e.target.type === 'checkbox' ? (e.target.checked ? '1' : '0') : e.target.value);
      if (k !== 'autoplay') again(`.game-bar [data-g="${k}"]`);
    });
    bar.addEventListener('click', e => {
      const b = e.target.closest('button[data-g]');
      if (!b) return;
      if (b.dataset.v) ctx.store.set('g.' + b.dataset.g, b.dataset.v);
      again(b.dataset.v ? `.game-bar [data-g="${b.dataset.g}"][data-v="${b.dataset.v}"]` : `.game-bar [data-g="${b.dataset.g}"]`);
    });
  }

  const tooFew = n => {
    const t = ctx.store.get('g.topic', ''), w = `${n} ${n === 1 ? 'word' : 'words'}`;
    if (t === 'tricky') return `<p class="empty">You have ${n} tricky ${n === 1 ? 'word' : 'words'} that fit this game, not enough for a round. Words you get wrong in any game are added; choose another topic for now.</p>`;
    if (t === 'study') return `<p class="empty">Your study list has ${w} that fit this game, not enough for a round. Add words with the bookmark button ` +
      `on any word card or entry (<a href="#/learn/study">see your list</a>), untick "Only words with recordings", or choose another topic.</p>`;
    if (t === 'new') return `<p class="empty">Only ${w} you haven't practised yet fit this game. Choose another topic, or untick "Only words with recordings".</p>`;
    return `<p class="empty">There aren't enough words for this game in this topic (${n}). Choose another topic, or untick "Only words with recordings".</p>`;
  };

  /** end-of-round panel: message, play again, and the words played (cards link to their entries) */
  function finishHTML(msg, words) {
    practise(words);
    ctx.setList(words.map(it => it.id));
    return `<div class="gdone"><p class="gdone-msg">${msg}</p><button type="button" class="gbtn primary" data-again>Play again</button></div>` +
      `<h3 class="section-title">Words in this round</h3><div class="grid">${words.map(it => ctx.R.cardHTML(it)).join('')}</div>`;
  }

  const KEYSAY = { hit: ', in the word', near: ', in the word, somewhere else', miss: ', not in the word' };
  // ---- letter games: the language's own letters (ctx.keyboard); two-letter units like ng or dh count as one
  function letterKit() {
    const rows = ctx.keyboard, units = new Set(rows.flat());
    const multi = [...units].filter(u => u.length > 1).sort((a, b) => b.length - a.length);
    const tok = w => { const out = []; let i = 0; while (i < w.length) { const u = multi.find(m => w.startsWith(m, i)) || w[i]; out.push(u); i += u.length; } return out; };
    const plain = it => hw(it).toLowerCase();
    const fits = it => { const w = plain(it); if (!/^[a-z]+$/.test(w)) return false; const t = tok(w); return t.length >= 4 && t.length <= 6 && t.every(u => units.has(u)); };
    /** the on-screen keyboard; state = letter -> hit/near/miss; extra = buttons added to the last row */
    const keysHTML = (state, extra = '', disableUsed = false) => '<div class="hd-keys">' + rows.map((row, ri) => '<div class="hd-krow">' +
      row.map(u => `<button type="button" class="hk ${state[u] || ''}" data-k="${esc(u)}"${disableUsed && state[u] ? ' disabled' : ''}>${esc(u)}` +
        `${state[u] ? sr(KEYSAY[state[u]] || '') : ''}</button>`).join('') +
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
  // ---- practised words: every word in a round the player finishes (the words shown at the end), with a count
  //      and the date.  Kept on this device only.  Games without an end-of-round panel call practise([word]).
  const practisedMap = () => { try { return JSON.parse(ctx.store.get('practised', '{}')) || {}; } catch (e) { return {}; } };
  function practise(words) {
    const p = practisedMap(), now = Date.now();
    words.forEach(it => { if (it) { const r = p[it.id] || (p[it.id] = { n: 0 }); r.n++; r.t = now; } });
    ctx.store.set('practised', JSON.stringify(p));
  }
  /** a speaker button; label says what it plays ("Listen to gunga"), never revealing an answer */
  const speakerHTML = (file, cls = '', label = 'Listen') => `<button type="button" class="play ${cls}" data-audio="${esc(file)}" aria-label="${esc(label)}">` +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9.5v5h4l5 4v-13l-5 4H3z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>';
  const sr = text => `<span class="sr-only">${esc(text)}</span>`;          // words for screen readers only

  // ---- accessibility: announcements, keeping focus through redraws, optional automatic sound ----------
  // say(): read a message out through a live region that stays in the page (games redraw their boards,
  // and a status line that is replaced each time is often not announced).
  let sayEl = null, sayQueue = [], sayTimer = null, lastInput = 'pointer';
  document.addEventListener('keydown', () => { lastInput = 'key'; }, true);
  document.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
  function say(msg, key) {                            // a message with a key replaces a waiting one with the same key
    if (!msg || !sayEl) return;
    if (key) sayQueue = sayQueue.filter(m => m.key !== key);
    sayQueue.push({ key, text: String(msg).replace(/\s+/g, ' ').trim() });
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      const text = sayQueue.map(m => m.text).join(' ');
      sayQueue = [];
      sayEl.textContent = '';
      setTimeout(() => { if (sayEl) sayEl.textContent = text; }, 60);
    }, 120);
  }
  // "Play sounds automatically": recordings that start by themselves can talk over a screen reader
  const autoOn = () => ctx.store.get('g.autoplay', '1') === '1';
  const auto = file => { if (file && autoOn()) ctx.playFile(file); };
  // move focus for keyboard users only (touch users' screens shouldn't jump about)
  const focusIfKey = el => { if (el && lastInput === 'key') el.focus(); };
  const autoplayHTML = () => `<label class="chk2"><input type="checkbox" data-g="autoplay"${autoOn() ? ' checked' : ''}> Play sounds automatically</label>`;

  // After a keyboard action redraws the board, put focus back on the same control, or the nearest one
  // of its kind (next letter tile, first choice of a new question), or "Next" / "Play again".
  const FOCUS_ATTRS = ['data-k', 'data-tile', 'data-slot', 'data-c', 'data-b', 'data-ans', 'data-i', 'data-r', 'data-id',
    'data-hint', 'data-show', 'data-replay', 'data-meanings', 'data-reveal', 'data-listen'];
  function focusKey(el) {
    if (!el || el === document.body) return null;
    const attr = el.hasAttribute('data-r') ? 'data-r' : FOCUS_ATTRS.find(a => el.hasAttribute(a));   // grid cells go by row and column
    if (!attr) return null;
    const same = [...el.closest('.gplay, .game')?.querySelectorAll(`[${attr}]`) || []];
    const sel = attr === 'data-r' ? `[data-r="${el.dataset.r}"][data-c="${el.dataset.c}"]` : `[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
    return { attr, sel, index: same.indexOf(el) };
  }
  const usable = b => b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.offsetParent !== null;
  function watch(root) {
    let last = null, lastStat = '';
    const note = e => { const el = e.target.closest && e.target.closest(FOCUS_ATTRS.map(a => `[${a}]`).join(',')); last = el ? focusKey(el) : null; };
    root.addEventListener('focusin', note);
    root.addEventListener('click', note, true);           // some screen readers press a button without focusing it
    new MutationObserver(() => {
      if (!root.isConnected) return;
      const stat = (root.querySelector('.gstat') || {}).textContent || '';
      const newStat = stat !== lastStat;
      if (stat && newStat) { lastStat = stat; say(stat); }
      const a = document.activeElement;
      if (lastInput !== 'key' || (a && a !== document.body)) return;      // focus is still somewhere: leave it
      const play = root.querySelector('.gplay') || root;
      let target = last && play.querySelector(last.sel);
      if (!usable(target)) target = play.querySelector('[data-autofocus]') || play.querySelector('[data-next]') || play.querySelector('[data-again]');
      if (!usable(target) && last) {
        const same = [...play.querySelectorAll(`[${last.attr}]`)].filter(usable);
        target = same[newStat ? 0 : Math.min(Math.max(last.index, 0), same.length - 1)];
      }
      if (!usable(target)) target = [...play.querySelectorAll('button, a[href], [tabindex="0"]')].find(usable);
      if (target) target.focus();
    }).observe(root, { childList: true, subtree: true });
  }

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

  // the player's study list and how much they have practised
  function studyPage(main) {
    const m = ctx.study.map(), p = practisedMap();
    const its = ctx.items.filter(it => has(m, it.id)).sort((a, b) => m[b.id] - m[a.id]);
    const inGames = new Set(pool({ topic: 'study', audio: false }).map(it => it.id));
    const day = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const note = it => (!inGames.has(it.id) ? 'not used in the games'
      : p[it.id] ? `practised ${p[it.id].n}× · last ${day(p[it.id].t)}` : 'not practised yet');
    const nOut = its.length - inGames.size;
    const all = pool({ topic: '', audio: false }, true), done = all.filter(it => has(p, it.id)).length;
    const icon = `<span class="study-ico">${ctx.R.bookmarkSVG}</span>`;
    ctx.setList(its.map(it => it.id));
    main.innerHTML = '<a class="gback" href="#/learn">‹ All games</a><h2 class="gtitle">My study list</h2>' +
      `<p class="gintro">Words you have marked with the bookmark button ${icon} on a word card or at the top of an entry, ` +
      'newest first. Choose <strong>My study list</strong> as the topic in any game to practise them. ' +
      'The list is kept on this device only.</p>' +
      (its.length ? `<div class="grid">${its.map(it => ctx.R.cardHTML(it, note(it))).join('')}</div>` +
        (nOut ? `<p class="gnote">${nOut} of these ${nOut === 1 ? 'is' : 'are'} not used in the games (only words with a short, certain meaning are).</p>` : '') +
        '<p><button type="button" class="gbtn" data-clear-study>Clear the list</button></p>' +
        '<h3 class="section-title">Share this list</h3>' +
        '<p class="gintro">Send your list as a link, for example to a class. Whoever opens the link sees the words and can ' +
        'add them to their own study list. The link holds only the words and the name you give it.</p>' +
        '<div class="share-row"><label class="gsel">List name (optional) <input type="text" data-share-name maxlength="60"></label>' +
        '<button type="button" class="gbtn primary" data-share>Share this list</button></div>' +
        '<p class="share-out" hidden><input type="text" readonly data-share-url aria-label="Link to your study list"></p>' +
        '<p class="gnote" role="status" data-share-msg></p>'
        : `<p class="empty">No words yet. Tap the bookmark ${icon} on any word card, or at the top of an entry, to add it.</p>`) +
      '<h3 class="section-title">Practice so far</h3>' +
      `<p class="gintro">You have practised ${done} of the ${all.length} words used in the games. A word counts as practised ` +
      'when it is in a round you finish. Choose <strong>Not practised yet</strong> as the topic in any game to meet new words.</p>' +
      (done ? '<p><button type="button" class="gbtn" data-clear-practised>Forget my practice history</button></p>' : '');
    main.querySelector('[data-clear-study]')?.addEventListener('click', () => {
      if (confirm('Clear your study list?')) { ctx.study.clear(); studyPage(main); }
    });
    main.querySelector('[data-clear-practised]')?.addEventListener('click', () => {
      if (confirm('Forget which words you have practised?')) { ctx.store.set('practised', '{}'); studyPage(main); }
    });
    main.querySelector('[data-share]')?.addEventListener('click', async () => {
      const name = main.querySelector('[data-share-name]').value.trim(), m = ctx.study.map();
      const ids = Object.keys(m).sort((a, b) => m[b] - m[a]);
      const url = location.href.split('#')[0] + '#/learn/list/' + (name ? encodeURIComponent(name) + '/' : '') + ids.map(encodeURIComponent).join(',');
      const out = main.querySelector('[data-share-url]'), msg = main.querySelector('[data-share-msg]');
      out.value = url;
      out.parentNode.hidden = false;
      if (navigator.share) {                    // phones: the system's share sheet (messages, email …)
        try { await navigator.share({ title: name || `${ctx.lang} study list`, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(url); msg.textContent = 'Link copied. Paste it into a message or an email.'; }
      catch (e) { msg.textContent = 'Copy the link above and send it.'; out.focus(); out.select(); }
    });
    main.querySelector('[data-share-url]')?.addEventListener('focus', e => e.target.select());
  }

  // a study list someone shared as a link: #/learn/list/[name/]id,id,…
  function listPage(main, spec) {
    const k = spec.lastIndexOf('/');
    const name = (k >= 0 ? spec.slice(0, k) : '').trim().slice(0, 80);
    const ids = [...new Set((k >= 0 ? spec.slice(k + 1) : spec).split(',').filter(Boolean))];
    const byId = new Map(ctx.items.map(it => [it.id, it]));
    const its = ids.map(id => byId.get(id)).filter(Boolean), shared = new Set(its.map(it => it.id));
    const missing = ids.length - its.length;
    const words = n => `${n} ${n === 1 ? 'word' : 'words'}`;
    document.title = `${name || 'Shared study list'} – ${ctx.title}`;
    ctx.setList(its.map(it => it.id));
    function draw(done) {
      const m = ctx.study.map(), fresh = its.filter(it => !has(m, it.id)).length;
      const others = Object.keys(m).some(id => !shared.has(id));
      main.innerHTML = '<a class="gback" href="#/learn">‹ All games</a>' +
        `<h2 class="gtitle">${name ? esc(name) : 'A shared study list'}</h2>` +
        `<p class="gintro">${name ? 'A study list' : 'Someone'} shared with you: ${words(its.length)}. Add them to your own study list to practise ` +
        'them in the games (choose <strong>My study list</strong> as the topic), or use the bookmark on a card to add one word.</p>' +
        (missing ? `<p class="gnote">${words(missing)} in this link ${missing === 1 ? 'is' : 'are'} not in this version of the dictionary.</p>` : '') +
        (done ? `<p class="gnote share-done" tabindex="-1">${done} <a href="#/learn/study">See your study list</a>.</p>` : '') +
        (!its.length ? '<p class="empty">This link has no words from the dictionary in it.</p>'
          : '<div class="share-row">' +
            (fresh ? `<button type="button" class="gbtn primary" data-add-all>Add ${fresh === its.length ? `all ${its.length}` : `the ${fresh} new ${fresh === 1 ? 'one' : 'ones'}`} to my study list</button>`
              : '<span class="gnote">All of these are in your study list.</span>') +
            (others ? '<button type="button" class="gbtn" data-replace>Replace my study list with these</button>' : '') + '</div>' +
            `<div class="grid">${its.map(it => ctx.R.cardHTML(it)).join('')}</div>`);
      const msg = main.querySelector('.share-done');
      if (msg) msg.focus({ preventScroll: true });
      main.querySelector('[data-add-all]')?.addEventListener('click', () => {
        ctx.study.add(its.map(it => it.id));
        draw(`Added ${words(fresh)} to your study list.`);
      });
      main.querySelector('[data-replace]')?.addEventListener('click', () => {
        if (!confirm(`Replace your study list (${words(Object.keys(ctx.study.map()).length)}) with these ${its.length}?`)) return;
        ctx.study.replace(its.map(it => it.id));
        draw(`Your study list is now these ${words(its.length)}.`);
      });
    }
    draw('');
  }

  function view(main, game, context) {
    ctx = context;
    sayEl = null;
    if (game === 'tricky') { document.title = `My tricky words – ${ctx.title}`; trickyPage(main); focusHeading(main); return; }
    if (game === 'study') { document.title = `My study list – ${ctx.title}`; studyPage(main); focusHeading(main); return; }
    if (game.startsWith('list/')) { listPage(main, game.slice(5)); focusHeading(main); return; }
    const games = available();
    const g = games.find(x => x.id === game);
    if (!g) {
      ctx.setList([]);
      document.title = `Learn – ${ctx.title}`;
      setTimeout(() => focusHeading(main), 0);
      const n = Object.keys(trickyMap()).length, nStudy = Object.keys(ctx.study.map()).length;
      main.innerHTML = `<h2 class="gtitle">Learn ${esc(ctx.lang)}</h2><p class="gintro">Games with words from the dictionary. ` +
        'Choose a topic in each game, and listen to the words as you match them.</p>' +
        `<a class="tricky-band study-band" href="#/learn/study"><strong>My study list · ${nStudy} ${nStudy === 1 ? 'word' : 'words'}</strong>` +
        `<span>${nStudy ? 'See your list and how much you have practised, or choose “My study list” as the topic in any game.'
          : 'Mark words with the bookmark button on any word card or entry, then practise them here. See how much you have practised.'}</span></a>` +
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
    main.innerHTML = '<a class="gback" href="#/learn">‹ All games</a><div class="game"></div>' +
      '<div class="sr-only" aria-live="polite" aria-atomic="true" data-say></div>';
    sayEl = main.querySelector('[data-say]');
    ctx.setList([]);
    document.title = `${g.title} – ${ctx.title}`;
    const root = main.querySelector('.game');
    watch(root);
    g.run(root, ctx);
    focusHeading(root);
  }
  // after opening a page with the keyboard, start screen readers at its heading
  function focusHeading(root) {
    const h = root.querySelector('.gtitle');
    if (h && lastInput === 'key') { h.tabIndex = -1; h.focus({ preventScroll: true }); }
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
    letterKit, listenBtn, record, practise, speakerHTML, inTopic, domainGroups, tops, CLASSES, say, sr, auto, autoplayHTML, focusIfKey,
    get ctx() { return ctx; } };
  return { register, view, kit };
})();
