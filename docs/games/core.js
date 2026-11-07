/* Learn tab, shared parts: which words can be played, topics, settings bar, end-of-round panel,
   letters and keyboard helpers, tricky words, and the game registry.  Each game is its own file in
   docs/games/ and calls DictGames.register(); the build lists those files in index.html.
   view(main, game, ctx) draws the Learn page or a game; myList(main, spec, ctx, section) draws the My lists tab
   (the reader's study list and tricky words, or a list shared as a link); ctx comes from app.js. */
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
  // 'study' (words they bookmarked), 'tricky' (words they got wrong)
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const LISTS = { study: () => ctx.study.map(), tricky: () => trickyMap() };
  const inList = (it, code, m) => has(m, it.id);
  // "Which words", on top of the topic, one setting for all games: all, 'new' (never practised anywhere on
  // the site) or 'old' (practised before, in any game or flashcards: words to go over again)
  const whichTest = s => {
    if (s.which !== 'new' && s.which !== 'old') return null;
    const p = practisedMap();
    return s.which === 'new' ? it => !has(p, it.id) : it => has(p, it.id);
  };
  const inTopic = (it, code) => !code || (LISTS[code] ? inList(it, code, LISTS[code]())
    : (it.c.sd || []).some(d => d.startsWith(code + ' ') || d.startsWith(code + '.')));
  // the words a game can use: anyTopic = ignore the topic and "Which words" (e.g. wrong answers from all words)
  function pool(s, anyTopic) {
    const code = anyTopic ? '' : s.topic, m = LISTS[code] && LISTS[code](), w = anyTopic ? null : whichTest(s);
    return ctx.items.filter(it => !it.parent && !it.c.see && CLASSES.has(it.c.cls) && gloss(it)
      && (!s.audio || it.c.audio) && (m ? inList(it, code, m) : inTopic(it, code)) && (!w || w(it)));
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
    const base = pool(s, true), names = new Map(), w = whichTest(s);
    base.forEach(it => (it.c.sd || []).forEach(d => { const m = /^([\d.]+)\s+(.*)$/.exec(d); if (m) names.set(m[1], m[2]); }));
    const num = code => code.split('.').map(Number);
    return [...names].map(([code, name]) => { const all = base.filter(it => inTopic(it, code));
      return { code, name, total: all.length, n: w ? all.filter(w).length : all.length }; })      // n follows Which words
      .filter(t => t.total >= 6)
      .sort((a, b) => { const x = num(a.code), y = num(b.code); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1); } return 0; });
  }

  // ---- settings (remembered) ------------------------------------------------------------
  const settings = () => {
    if (ctx.store.get('g.topic', '') === 'new') { ctx.store.set('g.topic', ''); ctx.store.set('g.which', 'new'); }   // was a topic
    return {
    topic: ctx.store.get('g.topic', ''),
    which: ctx.store.get('g.which', 'all'),          // all / new / old, shared by all games (see whichTest)
    audio: ctx.store.get('g.audio', '1') === '1',
    dir: ctx.store.get('g.dir', 'k2e'),
    level: ctx.store.get('g.level', 'easy'),          // listen and choose: easy / hard
    answer: ctx.store.get('g.answer', 'word'),        // listen and choose: answer with the word or its meaning
    };
  };

  /** a row of choice buttons; picking one stores it as g.<key> */
  const segHTML = (key, label, cur, choices) => `<div class="seg2" role="group" aria-label="${esc(label)}">` +
    choices.map(([v, t]) => `<button type="button" data-g="${key}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`).join('') + '</div>';

  /** "Which words": one setting for all games (see whichTest) */
  const whichHTML = s => segHTML('which', 'Which words', s.which, [['all', 'Any words'], ['new', 'New to me'], ['old', 'Studied before']]);

  /** settings bar: topic, recordings-only (unless audio: false), direction (withDir), and any extra choices */
  function barHTML(s, withDir, { audio = true, extra = '' } = {}) {
    const tops = topics(s);
    const n = code => pool(Object.assign({}, s, { topic: code })).length;
    if (s.topic && !LISTS[s.topic] && !tops.some(t => t.code === s.topic)) s.topic = '';
    const nTricky = n('tricky');
    const own = [['study', `My study list (${n('study')})`]]
      .concat(nTricky || s.topic === 'tricky' ? [['tricky', `★ My tricky words (${nTricky})`]] : []);
    const w = whichTest(s), all = pool(s, true);
    const opts = [`<option value="">All words (${w ? all.filter(w).length : all.length})</option>`].concat(
      own.map(([v, t]) => `<option value="${v}"${s.topic === v ? ' selected' : ''}>${esc(t)}</option>`),
      tops.map(t =>
      `<option value="${t.code}"${t.code === s.topic ? ' selected' : ''}>${' '.repeat(t.code.split('.').length - 1)}${esc(t.name)} (${t.n})</option>`));
    const L = esc(ctx.lang);
    return '<div class="game-bar">' +
      `<label class="gsel">Topic <select data-g="topic">${opts.join('')}</select></label>` +
      whichHTML(s) +
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

  /** sorting games: not enough topic groups; says why when "Which words" is narrowing them down */
  const fewTopics = () => (ctx.store.get('g.which', 'all') === 'all'
    ? '<p class="empty">Not enough topics with words for this game.</p>'
    : `<p class="empty">Not enough topics have words ${ctx.store.get('g.which') === 'new' ? 'that are new to you' : 'that you have studied before'} ` +
      'for this game. Choose “Any words”.</p>');
  const tooFew = n => {
    const t = ctx.store.get('g.topic', ''), w = `${n} ${n === 1 ? 'word' : 'words'}`, which = ctx.store.get('g.which', 'all');
    if (which === 'new' || which === 'old') return `<p class="empty">${n ? `Only ${w}` : 'No words'} ` +
      `${which === 'new' ? 'that are new to you' : 'that you have studied before'} fit this game${t ? ' in this topic' : ''}` +
      `${n ? ', not enough for a round' : ''}. ${which === 'old' ? 'A word counts as studied when you finish a round with it or turn its flashcard. ' : ''}` +
      'Choose “Any words”, or another topic.</p>';
    if (t === 'tricky') return `<p class="empty">You have ${n} tricky ${n === 1 ? 'word' : 'words'} that fit this game, not enough for a round. Words you get wrong in any game are added; choose another topic for now.</p>`;
    if (t === 'study') return `<p class="empty">Your study list has ${w} that fit this game, not enough for a round. Add words with the bookmark button ` +
      `on any word card or entry (<a href="#/mylist">see your list</a>), untick "Only words with recordings", or choose another topic.</p>`;
    if (t === 'new') return `<p class="empty">Only ${w} you haven't practised yet fit this game. Choose another topic, or untick "Only words with recordings".</p>`;
    return `<p class="empty">There aren't enough words for this game in this topic (${n}). Choose another topic, or untick "Only words with recordings".</p>`;
  };

  /** end-of-round panel: message, play again, and the words played (cards link to their entries) */
  function finishHTML(msg, words, counted) {        // counted: the game has already recorded these words as practised
    if (!counted) practise(words);
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
      const text = sayQueue.map(m => (/[.!?:]$/.test(m.text) ? m.text : m.text + '.')).join(' ');   // a full stop = a pause
      sayQueue = [];
      sayEl.textContent = '';
      setTimeout(() => { if (sayEl) sayEl.textContent = text; }, 60);
    }, 120);
  }
  // "Play sounds automatically": recordings that start by themselves can talk over a screen reader
  const autoOn = () => ctx.store.get('g.autoplay', '1') === '1';
  // automatic sounds start after a short pause (AUTO_DELAY ms), so they don't cut in as the screen changes.
  // A newer one replaces one still waiting; pressing a play button, or leaving the game, cancels it.
  const AUTO_DELAY = 300;
  let autoTimer = null;
  const auto = file => {
    clearTimeout(autoTimer);
    if (file && autoOn()) autoTimer = setTimeout(() => { if (sayEl && sayEl.isConnected) ctx.playFile(file); }, AUTO_DELAY);
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-audio], [data-listen]')) clearTimeout(autoTimer); }, true);
  // move focus for keyboard users only (touch users' screens shouldn't jump about)
  const focusIfKey = el => { if (el && lastInput === 'key') el.focus(); };
  const autoplayHTML = () => `<label class="chk2"><input type="checkbox" data-g="autoplay"${autoOn() ? ' checked' : ''}> Play sounds automatically</label>`;

  // After a keyboard action redraws the board, put focus back on the same control, or the nearest one
  // of its kind (next letter tile, first choice of a new question), or "Next" / "Play again".
  const FOCUS_ATTRS = ['data-k', 'data-tile', 'data-slot', 'data-c', 'data-b', 'data-ans', 'data-i', 'data-r', 'data-id',
    'data-hint', 'data-show', 'data-replay', 'data-meanings', 'data-reveal', 'data-listen', 'data-flip', 'data-prev'];
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
      if (stat && newStat) { lastStat = stat; say(stat, 'stat'); }
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

  // ---- saving to files: lists as spreadsheets (CSV), and a backup of everything the site keeps in the browser
  const today = () => new Date().toISOString().slice(0, 10);
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  /** a word list as CSV (opens in Excel, Numbers, Google Sheets; Anki and other flashcard apps can import it).
      extra = [column name, value(it)] for a list's own column */
  function saveList(its, what, extra) {
    const R = ctx.R, base = location.href.split('#')[0];
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [[ctx.lang, 'Word type', 'English', 'Example', 'Example in English'].concat(extra ? [extra[0]] : [], ['Link'])]
      .concat(its.map(it => [R.hwOf(it.c) + (it.c.hm ? ` (${it.c.hm})` : ''), R.posLabel(it.c.ps), R.plain(R.meaning(it.c))]
        .concat(R.exampleText(it.c), extra ? [extra[1](it)] : [], [base + '#/entry/' + encodeURIComponent(it.id)])));
    download(`${slug(ctx.lang)}-${what}-${today()}.csv`, '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }

  // a backup file holds every setting and list; restoring one replaces what this browser has
  const BACKUP = 'dictionary-site-data';
  function backupHTML() {
    return '<h3 class="section-title">Back up your data</h3>' +
      '<p class="gintro">Your study list, practice history, flashcard counts, tricky words, daily streak and settings are kept ' +
      'only in this browser. Clearing the browser’s data deletes them, and they don’t move to your other devices. Save a backup ' +
      'file to keep them safe, or to move them: open this site on the other phone or computer and restore the file there.</p>' +
      '<div class="share-row"><button type="button" class="gbtn" data-backup>Save a backup</button>' +
      '<button type="button" class="gbtn" data-restore>Restore from a backup…</button>' +
      '<input type="file" accept=".json,application/json" data-restore-file hidden></div>' +
      '<p class="gnote" role="status" data-backup-msg></p>';
  }
  function wireBackup(main) {
    const msg = main.querySelector('[data-backup-msg]'), file = main.querySelector('[data-restore-file]');
    const count = (data, k) => { try { return Object.keys(JSON.parse(data[k] || '{}')).length; } catch (e) { return 0; } };
    const words = (n, what) => `${n} ${what}${n === 1 ? 'word' : 'words'}`;
    main.querySelector('[data-backup]').addEventListener('click', () => {
      const data = ctx.store.dump();
      download(`${slug(ctx.title)}-backup-${today()}.json`,
        JSON.stringify({ backup: BACKUP, language: ctx.lang, saved: new Date().toISOString(), data }, null, 1), 'application/json');
      msg.textContent = `Backup saved: ${words(count(data, 'study'), '')} in your study list, ${words(count(data, 'practised'), 'practised ')} and your settings.`;
    });
    main.querySelector('[data-restore]').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      let b = null;
      try { b = JSON.parse(await f.text()); } catch (e) { /* not JSON */ }
      const ok = b && b.backup === BACKUP && b.data && typeof b.data === 'object' &&
        Object.entries(b.data).every(([k, v]) => /^[\w.-]{1,40}$/.test(k) && typeof v === 'string' && v.length < 2e6);
      if (!ok) { msg.textContent = 'That file isn’t a backup from this site.'; return; }
      if (b.language !== ctx.lang) { msg.textContent = `That backup is from the ${b.language} dictionary, not this one.`; return; }
      const when = new Date(b.saved).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      if (!confirm(`Restore the backup saved on ${when}? It has ${words(count(b.data, 'study'), '')} in the study list and ` +
        `${words(count(b.data, 'practised'), 'practised ')}. Everything this browser has now will be replaced.`)) return;
      if (!ctx.store.load(b.data)) { msg.textContent = 'The backup couldn’t be restored: this browser isn’t letting the site save data.'; return; }
      location.reload();
    });
  }

  // the My lists tab: the study list, the tricky words, practice so far, and backups.
  // section = where to start on the page: 'study', 'tricky', 'practice' or 'backup' (#/mylist/<section>)
  function listsPage(main, section) {
    const m = ctx.study.map(), p = practisedMap(), t = trickyMap();
    const its = ctx.items.filter(it => has(m, it.id)).sort((a, b) => m[b.id] - m[a.id]);
    const tricky = ctx.items.filter(it => has(t, it.id)).sort((a, b) => t[b.id].miss - t[a.id].miss);
    const inGames = new Set(pool({ topic: 'study', audio: false }).map(it => it.id));
    const day = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const note = it => (!inGames.has(it.id) ? 'not used in the games'
      : p[it.id] ? `practised ${p[it.id].n}× · last ${day(p[it.id].t)}` : 'not practised yet');
    const nOut = its.length - inGames.size;
    const all = pool({ topic: '', audio: false }, true), done = all.filter(it => has(p, it.id)).length;
    const icon = `<span class="study-ico">${ctx.R.bookmarkSVG}</span>`;
    const words = n => `${n} ${n === 1 ? 'word' : 'words'}`;
    ctx.setList([...new Set(its.concat(tricky).map(it => it.id))]);
    main.innerHTML = '<h2 class="gtitle">My lists</h2>' +
      '<p class="gintro">Your own lists of words, and how much you have practised. They are kept on this device only.</p>' +
      '<nav class="ml-nav" aria-label="On this page">' +
      `<a href="#/mylist/study">My study list (${its.length})</a><a href="#/mylist/tricky">★ My tricky words (${tricky.length})</a>` +
      '<a href="#/mylist/practice">Practice so far</a><a href="#/mylist/backup">Back up your data</a></nav>' +

      `<h3 class="section-title" id="ml-study">My study list <small>${words(its.length)}</small></h3>` +
      `<p class="gintro">Words you have marked with the bookmark button ${icon} on a word card, an entry or a flashcard, ` +
      'newest first. Choose <strong>My study list</strong> as the topic in any game to practise them.</p>' +
      (its.length ? `<div class="grid">${its.map(it => ctx.R.cardHTML(it, note(it))).join('')}</div>` +
        (nOut ? `<p class="gnote">${nOut} of these ${nOut === 1 ? 'is' : 'are'} not used in the games (only words with a short, certain meaning are).</p>` : '') +
        '<p class="share-row"><button type="button" class="gbtn" data-save-study>Save as a spreadsheet</button>' +
        '<button type="button" class="gbtn" data-clear-study>Clear the list</button></p>' +
        '<p class="gnote">The spreadsheet has each word’s meaning, an example and a link to its entry. It opens in Excel, Numbers ' +
        'or Google Sheets, and flashcard apps such as Anki can import it.</p>' +
        '<p class="gintro">Share the list as a link, for example with a class. Whoever opens the link sees the words and can ' +
        'add them to their own study list. The link holds only the words and the name you give it.</p>' +
        '<div class="share-row"><label class="gsel">List name (optional) <input type="text" data-share-name maxlength="60"></label>' +
        '<button type="button" class="gbtn primary" data-share>Share this list</button></div>' +
        '<p class="share-out" hidden><input type="text" readonly data-share-url aria-label="Link to your study list"></p>' +
        '<p class="gnote" role="status" data-share-msg></p>'
        : `<p class="empty">No words yet. Tap the bookmark ${icon} on any word card, or at the top of an entry, to add it.</p>`) +

      `<h3 class="section-title" id="ml-tricky">★ My tricky words <small>${words(tricky.length)}</small></h3>` +
      '<p class="gintro">Words you got wrong in the games, most-missed first. Choose <strong>★ My tricky words</strong> as the topic ' +
      'in any game to practise them; a word comes off the list after you get it right twice in a row.</p>' +
      (tricky.length ? `<div class="grid">${tricky.map(it => ctx.R.cardHTML(it, `missed ${t[it.id].miss}×`)).join('')}</div>` +
        '<p class="share-row"><button type="button" class="gbtn" data-save-tricky>Save as a spreadsheet</button>' +
        '<button type="button" class="gbtn" data-clear-tricky>Clear the list</button></p>'
        : '<p class="empty">No tricky words yet. Words you get wrong in the games will appear here.</p>') +

      '<h3 class="section-title" id="ml-practice">Practice so far</h3>' +
      `<p class="gintro">You have practised ${done} of the ${all.length} words used in the games. A word counts as practised ` +
      'when it is in a round you finish, or when you turn its flashcard. In any game, choose <strong>New to me</strong> to meet new ' +
      'words, or <strong>Studied before</strong> to go over words you have already practised.</p>' +
      (done ? '<p><button type="button" class="gbtn" data-clear-practised>Forget my practice history</button></p>' : '') +
      backupHTML();
    wireBackup(main);
    const again = () => listsPage(main, '');
    main.querySelector('[data-save-study]')?.addEventListener('click', () => saveList(its, 'study-list',
      ['Times practised', it => (p[it.id] ? p[it.id].n : 0)]));
    main.querySelector('[data-save-tricky]')?.addEventListener('click', () => saveList(tricky, 'tricky-words', ['Times missed', it => t[it.id].miss]));
    main.querySelector('[data-clear-study]')?.addEventListener('click', () => { if (confirm('Clear your study list?')) { ctx.study.clear(); again(); } });
    main.querySelector('[data-clear-tricky]')?.addEventListener('click', () => { if (confirm('Clear your tricky words?')) { ctx.store.set('tricky', '{}'); again(); } });
    main.querySelector('[data-clear-practised]')?.addEventListener('click', () => {
      if (confirm('Forget which words you have practised?')) { ctx.store.set('practised', '{}'); again(); }
    });
    main.querySelector('[data-share]')?.addEventListener('click', async () => {
      const name = main.querySelector('[data-share-name]').value.trim(), sm = ctx.study.map();
      const ids = Object.keys(sm).sort((a, b) => sm[b] - sm[a]);
      const url = location.href.split('#')[0] + '#/shared/' + (name ? encodeURIComponent(name) + '/' : '') + ids.map(encodeURIComponent).join(',');
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
    // start at the section asked for (after the router's scroll to the top)
    const h = section && main.querySelector('#ml-' + section);
    if (h) setTimeout(() => { h.scrollIntoView({ block: 'start' }); if (lastInput === 'key') { h.tabIndex = -1; h.focus({ preventScroll: true }); } }, 0);
  }

  // a study list someone shared as a link: #/shared/[name/]id,id,…
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
      main.innerHTML = '<a class="gback" href="#/mylist">‹ My lists</a>' +
        `<h2 class="gtitle">${name ? esc(name) : 'A shared study list'}</h2>` +
        `<p class="gintro">${name ? 'A study list' : 'Someone'} shared with you: ${words(its.length)}. Add them to your own study list to practise ` +
        'them in the games (choose <strong>My study list</strong> as the topic), or use the bookmark on a card to add one word.</p>' +
        (missing ? `<p class="gnote">${words(missing)} in this link ${missing === 1 ? 'is' : 'are'} not in this version of the dictionary.</p>` : '') +
        (done ? `<p class="gnote share-done" tabindex="-1">${done} <a href="#/mylist">See your study list</a>.</p>` : '') +
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
    const games = available();
    const g = games.find(x => x.id === game);
    if (!g) {
      ctx.setList([]);
      document.title = `Learn – ${ctx.title}`;
      setTimeout(() => focusHeading(main), 0);
      const n = Object.keys(trickyMap()).length, nStudy = Object.keys(ctx.study.map()).length;
      main.innerHTML = `<h2 class="gtitle">Learn ${esc(ctx.lang)}</h2><p class="gintro">Games with words from the dictionary. ` +
        'Choose a topic in each game, and listen to the words as you match them.</p>' +
        `<a class="tricky-band study-band" href="#/mylist"><strong>My study list · ${nStudy} ${nStudy === 1 ? 'word' : 'words'}</strong>` +
        `<span>${nStudy ? 'See your list and how much you have practised, or choose “My study list” as the topic in any game.'
          : 'Mark words with the bookmark button on any word card or entry, then practise them here. See how much you have practised.'}</span></a>` +
        (n ? `<a class="tricky-band" href="#/mylist/tricky"><strong>★ ${n} tricky ${n === 1 ? 'word' : 'words'}</strong>` +
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
  // the My lists tab: the reader's lists (section = where on the page to start), or (spec = [name/]id,id,…)
  // a list someone shared as a link
  function myList(main, spec, context, section) {
    ctx = context;
    sayEl = null;
    if (spec) listPage(main, spec);
    else { document.title = `My lists – ${ctx.title}`; listsPage(main, section); }
    if (!section) focusHeading(main);
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
    const w = whichTest(s);
    return [...names].map(([code, name]) => ({ code, name, top: code.split('.')[0], items: base.filter(it => inTopic(it, code) && (!w || w(it))) }))
      .filter(g => g.items.length >= min);
  }
  const tops = it => new Set((it.c.sd || []).map(d => d.split(/[.\s]/)[0]));

  const kit = { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, whichHTML, tooFew, fewTopics, finishHTML,
    letterKit, listenBtn, record, practise, practised: () => practisedMap(), speakerHTML, inTopic, domainGroups, tops, CLASSES, say, sr, auto, autoplayHTML, focusIfKey,
    get ctx() { return ctx; } };
  return { register, view, myList, kit };
})();
