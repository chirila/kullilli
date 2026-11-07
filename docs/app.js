/* Dictionary: wordlist, affixes, search, entry panel, audio and URL routing.
   URLs: #/letter/b  #/english/b  #/topic  #/topic/1.6.1.2  #/affixes  #/about  #/search/<query>  #/entry/<id>  (sub-entry: <id>/<n>)
         #/feedback  #/feedback/word/<id> */
'use strict';
(() => {
  const DATA = window.DICT_DATA, S = window.BardiSearch, R = window.BardiRender;
  const LANG = DATA.language, TITLE = DATA.title;
  const { esc, enc, hwOf } = R;
  const $ = (sel, el = document) => el.querySelector(sel);
  const main = $('#main'), qInput = $('#q');
  const overlay = $('#overlay'), entryEl = $('#entry');

  // ---- every entry and sub-entry is an item; sorted alphabetically ----------
  const items = [], byId = new Map();
  function addItem(c, parent, n) {
    const it = { id: parent ? `${parent.id}/${n}` : c.id, c, parent, n, subs: [] };
    if (parent) parent.subs.push(it);
    items.push(it);
    byId.set(it.id, it);
    return it;
  }
  DATA.entries.forEach(e => {
    const it = addItem(e, null, 0);
    (e.subs || []).forEach((s, k) => addItem(s, it, k + 1));
  });
  items.sort((a, b) => (a.c.sk < b.c.sk ? -1 : a.c.sk > b.c.sk ? 1 : 0) || (a.c.hm || '').localeCompare(b.c.hm || ''));
  items.forEach((it, i) => { it.i = i; });
  S.build(items);
  R.init(items, DATA.sentences, DATA.abbr);

  const letterCount = {};
  items.forEach(it => { letterCount[it.c.L] = (letterCount[it.c.L] || 0) + 1; });
  const LETTERS = DATA.letters.filter(l => letterCount[l])
    .concat(Object.keys(letterCount).filter(l => !DATA.letters.includes(l)).sort());

  const group = cls => (['prefix', 'suffix', 'clitic'].includes(cls) ? 'affix'
    : ['phrase', 'interjection', 'other'].includes(cls) ? 'other' : cls);
  const groupTotal = {};
  items.forEach(it => { const g = group(it.c.cls); groupTotal[g] = (groupTotal[g] || 0) + 1; });
  // filter buttons only for word types this dictionary has
  const FILTERS = [['all', 'All'], ['noun', 'Nouns'], ['verb', 'Verbs'], ['adjective', 'Adjectives'], ['adverb', 'Adverbs'],
    ['pronoun', 'Pronouns & question words'], ['place', 'Place names'], ['affix', 'Affixes & clitics'], ['other', 'Other']]
    .filter(([k]) => k === 'all' || groupTotal[k]);
  const AFFIXES = [
    ['prefix', 'Prefixes', 'Attach before a stem; written with a following hyphen.'],
    ['suffix', 'Suffixes', 'Attach after a stem; written with a preceding hyphen.'],
    ['clitic', 'Clitics', 'Attach to the end of a word or phrase; written with =.'],
  ].filter(([k]) => items.some(it => it.c.cls === k));

  // ---- English-first wordlist: FLEx's English reversal index (c.fl), one card per English word and entry.
  //      An entry with no reversal uses its glosses.  Built the first time it is shown.
  const EN_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const junk = s => !s || /\?|unknown/i.test(s);
  let ENG = null;
  function engIndex() {
    if (ENG) return ENG;
    const list = [];
    items.forEach(it => {
      const c = it.c, seen = new Set();
      let keys = (c.fl || []).filter(f => !junk(f));
      if (!keys.length) keys = (c.senses || []).flatMap(s => s.gl || []).flatMap(g => g.split(/\s*;\s*/)).filter(g => !junk(g));
      keys.forEach(k => {
        const key = k.trim(), lk = key.toLowerCase(), m = /[a-z0-9]/.exec(lk);
        if (!m || seen.has(lk)) return;
        seen.add(lk);
        list.push({ key, it, sk: lk.slice(m.index), L: /\d/.test(m[0]) ? '#' : m[0] });   // pronoun labels (1sg …) go under #
      });
    });
    list.sort((a, b) => a.sk.localeCompare(b.sk, 'en') || a.it.i - b.it.i);
    const count = {};
    list.forEach(x => { count[x.L] = (count[x.L] || 0) + 1; });
    ENG = { list, count, letters: EN_LETTERS.concat(count['#'] ? ['#'] : []) };
    return ENG;
  }

  // ---- word of the day: same for everyone on a given date; steps through the whole
  //      pool (glossed words with a translated example or a recording) before any word repeats ----
  const WOTD_POOL = items.filter(({ c }) => c.status !== 'NK' && group(c.cls) !== 'affix' &&
    (c.senses || []).some(s => (s.gl || []).some(g => !/[?|]/.test(g))) &&
    (c.audio || (c.senses || []).some(s => (s.ex || []).some(x => x.v && x.e))));
  function wordOfTheDay() {
    if (!WOTD_POOL.length) return null;
    const now = new Date();
    const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    let stride = 7919;
    while (gcd(stride, WOTD_POOL.length) !== 1) stride++;
    return {
      it: WOTD_POOL[(day * stride) % WOTD_POOL.length],
      label: now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    };
  }

  // ---- state (display choices are remembered between visits) ---------------
  const store = {
    get: (k, d) => { try { return localStorage.getItem(LANG + '.' + k) ?? d; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(LANG + '.' + k, v); } catch (e) { /* private mode */ } },
    // everything this site keeps in the browser (for a backup file); load() replaces all of it
    dump() {
      const out = {}, P = LANG + '.';
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P)) out[k.slice(P.length)] = localStorage.getItem(k); } }
      catch (e) { /* private mode */ }
      return out;
    },
    load(data) {
      try {
        Object.keys(store.dump()).forEach(k => localStorage.removeItem(LANG + '.' + k));
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(LANG + '.' + k, v));
        return true;
      } catch (e) { return false; }
    },
  };
  // ---- my study list: words the reader marks with the bookmark button; kept on this device only
  let studyCache = null;
  const study = {
    map: () => { if (!studyCache) { try { studyCache = JSON.parse(store.get('study', '{}')) || {}; } catch (e) { studyCache = {}; } } return studyCache; },
    has: id => Object.prototype.hasOwnProperty.call(study.map(), id),
    save() {
      store.set('study', JSON.stringify(study.map()));
      document.querySelectorAll('[data-study]').forEach(b => b.setAttribute('aria-pressed', String(study.has(b.dataset.study))));
    },
    toggle(id) { const m = study.map(); if (m[id]) delete m[id]; else m[id] = Date.now(); study.save(); },
    add(ids) { const m = study.map(), now = Date.now(); ids.forEach((id, k) => { if (!m[id]) m[id] = now - k; }); study.save(); },  // keeps their order
    replace(ids) { studyCache = {}; study.add(ids); },
    clear() { studyCache = {}; study.save(); },
  };
  R.setStudy(study.has);
  window.addEventListener('storage', e => { if (e.key === LANG + '.study') studyCache = null; });   // changed in another tab

  const state = {
    filter: store.get('filter', 'all'), view: store.get('view', 'cards'),
    letter: LETTERS[0], eLetter: 'a', baseKey: '', list: [], openId: null,
  };
  if (store.get('wl', 'k') !== 'k') $('[data-tab="letter"]').href = store.get('wl') === 'e' ? '#/english/a' : '#/topic';   // the Wordlist tab opens the order last used
  if (!FILTERS.some(([k]) => k === state.filter)) state.filter = 'all';
  // linguist notes and questions on example sentences: hidden unless switched on (remembered)
  state.ling = store.get('ling', '0') === '1';
  document.body.classList.toggle('show-ling', state.ling);
  state.baseHash = state.lastBrowse = '#/letter/' + enc(state.letter);

  // ---- lists of cards, rendered in chunks as you scroll ---------------------
  let observers = [];
  function mountList(el, list) {
    const CHUNK = 180;
    let n = 0;
    el.className = state.view === 'list' ? 'rows' : 'grid';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'more-btn';
    const draw = state.view === 'list' ? R.rowHTML : R.cardHTML;
    const more = () => {
      const end = Math.min(n + CHUNK, list.length);
      el.insertAdjacentHTML('beforeend', list.slice(n, end).map(x => draw(x.it, x.note, x.eng)).join(''));
      n = end;
      if (n < list.length) { btn.textContent = `Show more (${list.length - n})`; el.after(btn); } else btn.remove();
    };
    btn.onclick = more;
    more();
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && n < list.length) more(); }), { rootMargin: '800px' });
      io.observe(btn);
      observers.push(io);
    }
  }

  const toggleHTML = () => '<div class="viewtoggle" role="group" aria-label="Display">' +
    `<button type="button" data-view="cards" aria-pressed="${state.view === 'cards'}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>Cards</button>` +
    `<button type="button" data-view="list" aria-pressed="${state.view === 'list'}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="2" width="14" height="2.4" rx="1"/><rect x="1" y="6.8" width="14" height="2.4" rx="1"/><rect x="1" y="11.6" width="14" height="2.4" rx="1"/></svg>List</button></div>`;

  // ---- views ---------------------------------------------------------------
  // Kullilli first (#/letter/…) or English first (#/english/…): same letters bar, filters, cards and entries
  const orderHTML = mode => '<nav class="wl-order" aria-label="Wordlist order">' + [
    ['k', `#/letter/${enc(state.letter)}`, `${esc(LANG)} → English`],
    ['e', `#/english/${enc(state.eLetter)}`, `English → ${esc(LANG)}`],
    ['t', '#/topic', 'By topic']].map(([m, href, label]) =>
    `<a href="${href}"${m === mode ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('') + '</nav>';
  /** word-type filter buttons; gc = count per type, total = all */
  const chipsHTML = (gc, total) => '<div class="chips" role="group" aria-label="Word type">' + FILTERS.map(([k, lab]) => {
    const n = k === 'all' ? total : (gc[k] || 0);
    return `<button type="button" class="chip${state.filter === k ? ' on' : ''}${n ? '' : ' zero'}" data-filter="${k}" aria-pressed="${state.filter === k}">${lab} <span>${n}</span></button>`;
  }).join('') + '</div>';

  function viewLetter(letter, eng) {
    const E = eng ? engIndex() : null;
    const count = eng ? E.count : letterCount, order = eng ? E.letters : LETTERS, base = eng ? '#/english/' : '#/letter/';
    const all = letter === 'all';                  // "All" (#/letter/all, #/english/all): every word, in alphabetical order
    if (!all && !count[letter]) letter = order.find(l => count[l]);
    if (eng) state.eLetter = letter; else state.letter = letter;
    store.set('wl', eng ? 'e' : 'k');
    $('[data-tab="letter"]').href = base + enc(letter);
    const inL = eng ? (all ? E.list.filter(x => x.L !== '#').concat(E.list.filter(x => x.L === '#'))   // # (1sg …) last, as on the bar
      : E.list.filter(x => x.L === letter)) : items.filter(it => all || it.c.L === letter).map(it => ({ it }));
    const head = all ? 'All' : letter.toUpperCase();
    const gc = {};
    inL.forEach(({ it }) => { const g = group(it.c.cls); gc[g] = (gc[g] || 0) + 1; });
    const shown = state.filter === 'all' ? inL : inL.filter(({ it }) => group(it.c.cls) === state.filter);
    const fLabel = (FILTERS.find(f => f[0] === state.filter) || ['', ''])[1];
    const wotd = wordOfTheDay();
    const letterLink = l => (count[l]
      ? `<a href="${base}${enc(l)}"${l === letter ? ' class="on" aria-current="page"' : ''} title="${count[l]} entries">${esc(l.toUpperCase())}</a>`
      : `<span class="off" title="No entries">${esc(l.toUpperCase())}</span>`);
    main.innerHTML = (wotd ? R.wotdHTML(wotd.it, wotd.label, store.get('wotd', '1') === '1') : '') + orderHTML(eng ? 'e' : 'k') +
      `<div class="browse-bar"><nav class="letters" aria-label="${eng ? 'English letters' : 'Letters'}">` +
      `<a class="all${all ? ' on" aria-current="page' : ''}" href="${base}all" title="Every word, A to Z">All</a>` +
      order.map(letterLink).join('') +
      `</nav><div class="tools">${chipsHTML(gc, inL.length)}${toggleHTML()}</div></div>` +
      `<h2 class="list-title">${esc(head)} <small>${shown.length} ${shown.length === 1 ? 'entry' : 'entries'}${state.filter !== 'all' ? ' · ' + esc(fLabel.toLowerCase()) : ''}</small></h2>` +
      (shown.length ? '<div id="list"></div>' : `<p class="empty">No ${esc(fLabel.toLowerCase())}${all ? '' : ' under ' + esc(head)}.</p>`);
    if (shown.length) mountList($('#list'), shown.map(x => ({ it: x.it, eng: x.key })));
    state.list = [...new Set(shown.map(x => x.it.id))];
  }

  // ---- topics: FLEx semantic domains (DDP4), e.g. "1.6.1.2 Bird".  A topic includes its smaller topics;
  //      a topic's parent is the nearest shorter code in the data (top-level names below if FLEx has none).
  const DDP_TOP = { 1: 'Universe, creation', 2: 'Person', 3: 'Language and thought', 4: 'Social behaviour', 5: 'Daily life',
    6: 'Work and occupation', 7: 'Physical actions', 8: 'States', 9: 'Grammar' };
  let TOPICS = null;
  function topicIndex() {
    if (TOPICS) return TOPICS;
    const names = new Map();
    items.forEach(it => (it.c.sd || []).forEach(d => { const m = /^([\d.]+)\s+(.*)$/.exec(d); if (m) names.set(m[1], m[2]); }));
    [...names.keys()].forEach(code => { const top = code.split('.')[0]; if (!names.has(top)) names.set(top, DDP_TOP[top] || top); });
    const num = code => code.split('.').map(Number);
    const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? -1) - (y[i] ?? -1); if (d) return d; } return 0; };
    const by = new Map();
    const list = [...names.keys()].sort(cmp).map(code => {
      const t = { code, name: names.get(code), children: [],
        items: items.filter(it => (it.c.sd || []).some(d => d.startsWith(code + ' ') || d.startsWith(code + '.'))) };
      const p = code.split('.');
      for (let i = p.length - 1; i > 0 && !t.parent; i--) t.parent = by.get(p.slice(0, i).join('.'));
      t.depth = t.parent ? t.parent.depth + 1 : 0;
      if (t.parent) t.parent.children.push(t);
      by.set(code, t);
      return t;
    });
    const none = items.filter(it => !(it.c.sd || []).length && !it.c.see);
    TOPICS = { list, by, none };
    return TOPICS;
  }
  const entries = n => `${n} ${n === 1 ? 'entry' : 'entries'}`;
  function viewTopicIndex() {
    const T = topicIndex();
    const below = t => t.children.flatMap(c => [c].concat(below(c)));
    store.set('wl', 't');
    $('[data-tab="letter"]').href = '#/topic';
    main.innerHTML = orderHTML('t') +
      `<h2 class="list-title">Topics <small>${T.list.length} topics</small></h2>` +
      '<p class="section-intro">Words grouped by subject, using the semantic domains in the dictionary. A topic includes ' +
      'its smaller topics: <em>Animal</em> has all the birds, snakes and fish too.</p>' +
      T.list.filter(t => !t.parent).map(top => `<section class="tp-group"><h3 class="section-title">` +
        `<a href="#/topic/${enc(top.code)}">${esc(top.name)}</a> <small>${entries(top.items.length)}</small></h3>` +
        (top.children.length ? '<ul class="tp-list">' + below(top).map(t => `<li style="--d:${t.depth - 1}">` +
          `<a href="#/topic/${enc(t.code)}">${esc(t.name)}</a> <span>${t.items.length}</span></li>`).join('') + '</ul>' : '') +
        '</section>').join('') +
      (T.none.length ? `<p class="section-intro"><a href="#/topic/none">Words without a topic</a> (${T.none.length})</p>` : '');
    state.list = [];
  }
  function viewTopic(code) {
    const T = topicIndex();
    const t = code === 'none' ? { code, name: 'Words without a topic', items: T.none, children: [] } : T.by.get(code);
    if (!t) { viewTopicIndex(); return; }
    store.set('wl', 't');
    $('[data-tab="letter"]').href = '#/topic/' + enc(code);
    const up = [];
    for (let p = t.parent; p; p = p.parent) up.unshift(p);
    const gc = {};
    t.items.forEach(it => { const g = group(it.c.cls); gc[g] = (gc[g] || 0) + 1; });
    const shown = state.filter === 'all' ? t.items : t.items.filter(it => group(it.c.cls) === state.filter);
    const fLabel = (FILTERS.find(f => f[0] === state.filter) || ['', ''])[1];
    main.innerHTML = orderHTML('t') +
      '<nav class="tp-crumbs" aria-label="Topic"><a href="#/topic">All topics</a>' +
      up.map(p => ` › <a href="#/topic/${enc(p.code)}">${esc(p.name)}</a>`).join('') + '</nav>' +
      `<h2 class="list-title">${esc(t.name)} <small>${entries(shown.length)}${state.filter !== 'all' ? ' · ' + esc(fLabel.toLowerCase()) : ''}</small></h2>` +
      (t.children.length ? '<nav class="tp-subs" aria-label="Smaller topics">' + t.children.map(c =>
        `<a href="#/topic/${enc(c.code)}">${esc(c.name)} <span>${c.items.length}</span></a>`).join('') + '</nav>' : '') +
      `<div class="browse-bar"><div class="tools">${chipsHTML(gc, t.items.length)}${toggleHTML()}</div></div>` +
      (shown.length ? '<div id="list"></div>' : `<p class="empty">No ${esc(fLabel.toLowerCase())} in this topic.</p>`);
    if (shown.length) mountList($('#list'), shown.map(it => ({ it })));
    state.list = shown.map(it => it.id);
  }

  function viewAffixes() {
    const groups = AFFIXES.map(([k, title, intro]) => ({ k, title, intro, list: items.filter(it => it.c.cls === k) }));
    main.innerHTML = `<div class="results-head"><h2>Affixes and clitics</h2>${toggleHTML()}</div>` +
      groups.map(g => `<h3 class="section-title">${g.title} <small>${g.list.length}</small></h3><p class="section-intro">${g.intro}</p><div data-list="${g.k}"></div>`).join('');
    groups.forEach(g => mountList($(`[data-list="${g.k}"]`), g.list.map(it => ({ it }))));
    state.list = groups.flatMap(g => g.list.map(it => it.id));
  }

  // ---- English suggestions: a related English word that is in the dictionary (infant -> child), from
  //      WordNet via build/suggest.py.  data/suggest.js loads the first time a search needs it.
  let suggestLoad = null;
  const loadSuggest = () => suggestLoad || (suggestLoad = new Promise(done => {
    if (window.DICT_SUGGEST || !DATA.suggest) { done(window.DICT_SUGGEST || null); return; }
    const s = Object.assign(document.createElement('script'), { src: DATA.suggest });
    s.onload = () => done(window.DICT_SUGGEST || null);
    s.onerror = () => { suggestLoad = null; done(null); };
    document.head.appendChild(s);
  }));
  function suggestionsFor(q, SG) {
    const w = q.toLowerCase().replace(/[^a-z' -]+/g, ' ').replace(/\s+/g, ' ').trim();
    const forms = x => [x, x.replace(/ies$/, 'y'), x.replace(/es$/, ''), x.replace(/s$/, ''), x.replace(/ing$/, ''),
      x.replace(/ing$/, 'e'), x.replace(/ed$/, ''), x.replace(/ed$/, 'e')];
    const out = [];
    for (const x of [w].concat(w.includes(' ') ? w.split(' ') : [])) {
      const hit = forms(x).find(f => SG.map[f]);
      if (hit) SG.map[hit].forEach(i => { const s = SG.words[i]; if (s !== w && !out.includes(s)) out.push(s); });
    }
    return out.slice(0, 6);
  }

  function viewSearch(q) {
    const MAX = 600;
    const conv = r => r.slice(0, MAX).map(x => ({ it: items[x.i], note: x.note, score: x.score }));
    const b = conv(S.bardi(q, true)), e = conv(S.english(q, true));   // Kullilli and English, examples included
    // words found only in an example sentence (they come last) go in a folded part under each list;
    // shown open when they are all the list has
    const isEx = x => /in an example/.test(x.note || '');
    const sec = (k, title, list) => ({ k, title, list, direct: list.filter(x => !isEx(x)), ex: list.filter(isEx) });
    const bSec = sec('b', `${LANG} words`, b), eSec = sec('e', 'English meanings', e);
    const secs = b.length && (!eSec.direct.length || b[0].score >= 80) ? [bSec, eSec] : [eSec, bSec];
    const shown = secs.filter(s => s.list.length);
    // suggestions when English meanings (not just example sentences) give fewer than 3 words
    const wantSuggest = eSec.direct.length < 3;
    const more = s => s.list.length === MAX ? '+' : '';
    const secHTML = s => `<h3 class="section-title">${s.title} <small>${s.direct.length || s.ex.length}${s.direct.length ? '' : more(s)}</small></h3>` +
      (s.direct.length ? `<div data-list="${s.k}"></div>` : '') +
      (s.ex.length ? `<details class="ex-hits"${s.direct.length ? '' : ' open'}><summary>` +
        `${s.direct.length ? `${s.ex.length}${more(s)} more` : 'Only'} in example sentences` +
        '<span class="ex-act" aria-hidden="true"><span class="ex-show">Show</span><span class="ex-hide">Hide</span></span></summary>' +
        `<div data-list="${s.k}x"></div></details>` : '');
    main.innerHTML = `<div class="results-head"><h2>Results for “${esc(q)}”</h2>${toggleHTML()}</div>` +
      (wantSuggest ? '<p class="suggest" data-suggest hidden></p>' : '') +
      (shown.length ? shown.map(secHTML).join('') : `<p class="empty">No matches for “${esc(q)}”. You could try fewer letters.</p>`);
    shown.forEach(s => {
      if (s.direct.length) mountList($(`[data-list="${s.k}"]`), s.direct);
      if (s.ex.length) mountList($(`[data-list="${s.k}x"]`), s.ex);
    });
    if (wantSuggest) loadSuggest().then(SG => {
      const box = main.querySelector('[data-suggest]'), list = SG ? suggestionsFor(q, SG) : [];
      if (!box || !list.length) return;
      box.innerHTML = `<strong>Try a related word:</strong> ${list.map(w => `<a href="#/search/${enc(w)}">${esc(w)}</a>`).join(' · ')}` +
        ' <span class="suggest-note">Suggestions from WordNet, an English word list.</span>';
      box.hidden = false;
    });
    state.list = [...new Set(shown.flatMap(s => s.list.map(x => x.it.id)))];
  }

  // what the Learn-tab games get from the app (see games.js)
  const gameCtx = {
    items, lang: LANG, title: TITLE, R, store, study, keyboard: DATA.keyboard,
    playFile: file => playFile(file),
    setList: ids => { state.list = ids; },
  };

  // ---- feedback: the GitHub issue forms in .github/ISSUE_TEMPLATE/, filled in from where the reader was ----
  const FB = DATA.feedback || {};
  const fbRepo = () => FB.repo || (location.hostname.endsWith('.github.io')
    ? `${location.hostname.split('.')[0]}/${location.pathname.split('/')[1] || location.hostname}` : '');
  const issueURL = (template, fields) => `https://github.com/${fbRepo()}/issues/new?` + new URLSearchParams(Object.assign({ template }, fields));
  let lastPage = '';                              // the page the reader was on before opening the feedback page
  function viewFeedback(kind, id) {
    const repo = fbRepo(), it = id ? byId.get(id) : null, base = location.href.split('#')[0];
    const go = (template, fields, label) => (repo
      ? `<a class="gbtn primary" href="${esc(issueURL(template, fields))}" target="_blank" rel="noopener">${label}` +
        '<span class="sr-only"> (opens GitHub in a new tab)</span></a>' : '');
    const word = it ? { title: `Word: ${hwOf(it.c)}${it.c.hm ? ' ' + it.c.hm : ''}`, word: hwOf(it.c) + (it.c.hm ? ` (${it.c.hm})` : ''),
      entry: base + '#/entry/' + enc(it.id), meaning: R.plain(R.meaning(it.c)) } : {};
    // without a GitHub account: the same questions as an email, opened in the reader's email app
    const email = (subject, lines) => (FB.email
      ? `<a class="gbtn" href="mailto:${esc(FB.email)}?subject=${enc(`${TITLE}: ${subject}`)}&body=${enc(lines.join('\r\n'))}">Email instead</a>` : '');
    const card = (key, title, text, extra, btns) => `<section class="fb-card${kind === key ? ' on' : ''}" id="fb-${key}">` +
      `<h3>${title}</h3><p>${text}</p>${extra}<div class="share-row">${btns}</div></section>`;
    const device = `${navigator.userAgent} (screen ${innerWidth}×${innerHeight})`;
    const mail = FB.email ? ' No GitHub account? Use <strong>Email instead</strong>: it opens your email app with the same questions, ' +
      `ready to send to ${esc(FB.email)}. Emails are not public.` : '';
    main.innerHTML = '<h2 class="gtitle">Send feedback</h2>' +
      `<p class="gintro">Tell us about problems with the website, ideas for new features or activities, and comments on the ` +
      `words and their meanings. Everything you send helps make the dictionary better.</p><div class="fb-cards">` +
      card('problem', 'Report a problem with the site',
        'Something that doesn’t work or looks wrong: a page, a game, search, sound, or how the site looks on your phone or ' +
        'computer. The form fills in the page you were on and your device.', '',
        go('2-problem.yml', { title: 'Problem: ', page: lastPage || base, device }, 'Report a problem') +
        email('problem with the site', ['What happened?', '', '', 'What did you expect to happen?', '', '', `Page: ${lastPage || base}`, `Device: ${device}`])) +
      card('idea', 'Suggest a feature or activity',
        'Something you’d like the dictionary to do, an idea for a new game or activity, or a change to one.', '',
        go('3-idea.yml', { title: 'Idea: ' }, 'Suggest an idea') +
        email('idea', ['My idea:', '', '', 'Who would it help, and how?', ''])) +
      card('word', it ? `Comment on <span class="v">${esc(hwOf(it.c))}</span>` : 'Comment on a word or meaning',
        'A meaning or translation that could be better, a spelling, a recording, an example sentence, or something to add.' +
        (it ? '' : ' To comment on one word, use “Comment on this word” at the bottom of its entry: that fills in the word for you.'),
        it ? `<div class="grid fb-word">${R.cardHTML(it)}</div>` : '',
        go('1-word.yml', it ? word : { title: 'Word: ' }, it ? 'Comment on this word' : 'Comment on a word') +
        email(it ? `comment on ${word.word}` : 'comment on a word', (it
          ? [`Word: ${word.word}`, `Link: ${word.entry}`, `What the dictionary says now: ${word.meaning}`, '']
          : ['Word:', '']).concat(['My comment:', '', '', 'Where does this come from? (optional)', '']))) +
      '</div>' +
      '<p class="fb-note">The forms are on GitHub, where the dictionary’s files are kept. You need a free GitHub account to send ' +
      'one, and what you write is public, so please don’t include private information about yourself or other people.' + mail + '</p>' +
      (repo ? '' : '<p class="fb-note">(The GitHub buttons appear on the published site. To send feedback somewhere else, set ' +
        'FEEDBACK_REPO in build/build_lift.py.)</p>');
    state.list = it ? [it.id] : [];
    document.title = `Send feedback – ${TITLE}`;
    if (kind) setTimeout(() => main.querySelector('#fb-' + kind)?.scrollIntoView({ block: 'start' }), 0);
  }

  // Lessons tab: a placeholder while the lessons (docs/lessons/, from build/build_lessons.py) are being checked.
  // When they are ready, point the tab at lessons/ in index.html and remove this page and the "coming soon" badge.
  function viewLessons() {
    main.innerHTML = `<article class="prose">
      <h2>Lessons <span class="soon">coming soon</span></h2>
      <p>Short lessons on how Kullilli works are on their way: the sounds and spelling, greetings and introductions,
        numbers, verbs and their endings, noun endings, pronouns, asking questions, and more. Each lesson has a short
        explanation, examples, and questions to check yourself, and you can save lessons to come back to later.</p>
      <p>The lessons are made from the <em>Kullilli Sketch Grammar</em> and are being checked before they go up here.</p>
    </article>`;
    document.title = `Lessons – ${TITLE}`;
  }

  function viewAbout() {
    main.innerHTML = '';
    main.append($('#about-tpl').content.cloneNode(true));
    const stat = (k, v) => { const el = main.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = v.toLocaleString(); };
    stat('entries', DATA.entries.length);
    stat('subs', items.length - DATA.entries.length);
    const key = main.querySelector('[data-abbr-list]');
    if (key) key.innerHTML = R.abbrListHTML();
    // dates: the site's last update (written by the build into index.html) and the newest edit in the FLEx data
    const day = s => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); return m
      ? new Date(+m[1], m[2] - 1, +m[3]).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
    const site = day((document.querySelector('meta[name="site-updated"]') || {}).content), edited = day(DATA.edited);
    const dates = main.querySelector('[data-updated]');
    if (dates && site && edited) {
      dates.querySelector('[data-date="site"]').textContent = site;
      dates.querySelector('[data-date="edited"]').textContent = edited;
    } else if (dates) dates.remove();
    wireOffline();
    state.list = [];
  }

  // ---- offline: sw.js saves the site; recordings go in the "recordings" store as they play, or all at once here
  const AUDIO_STORE = 'recordings';
  const audioFiles = () => {                       // every recording the data refers to
    const out = new Set();
    const walk = v => { if (typeof v === 'string') { if (/\.(wav|mp3|m4a|ogg)$/i.test(v)) out.add(v); } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(DATA.entries);
    return [...out];
  };
  const audioURL = f => new URL('audio/' + enc(f), location.href).href;
  function wireOffline() {
    const msg = main.querySelector('[data-offline-msg]'), tools = main.querySelector('[data-offline-tools]');
    if (!msg) return;
    if (!('caches' in window) || !('serviceWorker' in navigator)) {
      tools.hidden = true;
      msg.textContent = 'This browser can’t save the dictionary for offline use.';
      return;
    }
    const files = audioFiles();
    const status = async () => {
      const saved = (await (await caches.open(AUDIO_STORE)).keys()).length;
      msg.textContent = `${Math.min(saved, files.length).toLocaleString()} of ${files.length.toLocaleString()} recordings are saved on this device.`;
      return saved;
    };
    status();
    const save = main.querySelector('[data-save-audio]'), clear = main.querySelector('[data-clear-audio]');
    save.addEventListener('click', async () => {
      save.disabled = clear.disabled = true;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});   // ask the browser to keep them
      const cache = await caches.open(AUDIO_STORE);
      let done = 0, failed = 0;
      const queue = files.slice();
      const worker = async () => {
        for (let f = queue.shift(); f; f = queue.shift()) {
          const url = audioURL(f);
          try { if (!(await cache.match(url))) { const r = await fetch(url); if (r.ok) await cache.put(url, r); else failed++; } }
          catch (e) { failed++; }
          if (++done % 25 === 0 || done === files.length) msg.textContent = `Saving recordings: ${done} of ${files.length}…`;
        }
      };
      await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
      await status();
      if (failed) msg.textContent += ` ${failed} couldn’t be saved; try again when you have a better connection.`;
      save.disabled = clear.disabled = false;
    });
    clear.addEventListener('click', async () => {
      if (!confirm('Remove the saved recordings from this device? They will be saved again as you play them.')) return;
      await caches.delete(AUDIO_STORE);
      status();
    });
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---- routing -------------------------------------------------------------
  const dec = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  function parse(hash = location.hash) {
    const h = hash.replace(/^#\/?/, '');
    const k = h.indexOf('/');
    const head = k < 0 ? h : h.slice(0, k), rest = k < 0 ? '' : h.slice(k + 1);
    if (head === 'entry') return { type: 'entry', id: dec(rest) };
    if (head === 'search' && rest) return { type: 'search', q: dec(rest) };
    if (head === 'affixes' || head === 'about' || head === 'lessons') return { type: head };
    if (head === 'feedback') {                    // #/feedback/<kind>[/<entry id>]: kind = problem, idea or word
      const k = rest.indexOf('/');
      return { type: 'feedback', kind: dec(k < 0 ? rest : rest.slice(0, k)), id: k < 0 ? '' : dec(rest.slice(k + 1)) };
    }
    if (head === 'english') return { type: 'english', letter: dec(rest) || state.eLetter };
    if (head === 'topic') return { type: 'topic', code: dec(rest) };
    if (!h && store.get('wl', 'k') === 'e') return { type: 'english', letter: state.eLetter };
    if (!h && store.get('wl', 'k') === 't') return { type: 'topic', code: '' };
    if (head === 'mylist') return { type: 'mylist', spec: '', section: dec(rest) };     // #/mylist/tricky: start at that list
    if (head === 'shared') return { type: 'mylist', spec: dec(rest) };        // a study list shared as a link
    if (head === 'learn') {
      const g = dec(rest);
      if (g === 'study' || g === 'tricky') return { type: 'mylist', spec: '', section: g };   // earlier addresses of the same pages
      if (g.startsWith('list/')) return { type: 'mylist', spec: g.slice(5) };
      return { type: 'learn', game: g };
    }
    return { type: 'letter', letter: dec(rest) || state.letter };
  }

  function showBase(r, hash) {
    const key = JSON.stringify(r) + [state.filter, state.view].join('|');
    state.baseHash = hash;
    if (r.type !== 'search') state.lastBrowse = hash;
    if (key === state.baseKey) return;          // same view: keep scroll position
    state.baseKey = key;
    observers.forEach(o => o.disconnect());
    observers = [];
    const tab = r.type === 'english' || r.type === 'topic' ? 'letter' : r.type;
    document.querySelectorAll('.tabs [data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
    $('.tab-search').hidden = r.type !== 'search';
    if (r.type === 'search') { if (document.activeElement !== qInput) qInput.value = r.q; }
    else if (document.activeElement !== qInput) qInput.value = '';
    document.title = TITLE;                     // pages with their own title set it below
    if (r.type === 'letter') viewLetter(r.letter);
    else if (r.type === 'english') viewLetter(r.letter, true);
    else if (r.type === 'topic') { if (r.code) viewTopic(r.code); else viewTopicIndex(); }
    else if (r.type === 'affixes') viewAffixes();
    else if (r.type === 'about') viewAbout();
    else if (r.type === 'lessons') viewLessons();
    else if (r.type === 'feedback') viewFeedback(r.kind, r.id);
    else if (r.type === 'learn') window.DictGames.view(main, r.game, gameCtx);
    else if (r.type === 'mylist') window.DictGames.myList(main, r.spec, gameCtx, r.section);
    else viewSearch(r.q);
    window.scrollTo(0, 0);
  }

  function route() {
    const r = parse();
    if (r.type !== 'feedback') lastPage = location.href;
    if (r.type === 'entry') {
      const it = byId.get(r.id);
      if (!it) return go('#/letter/' + enc(state.letter), true);
      if (!state.baseKey) {
        const L = (it.parent || it).c.L;
        showBase({ type: 'letter', letter: L }, '#/letter/' + enc(L));
      }
      openEntry(it);
    } else {
      closeEntry();
      showBase(r, location.hash || '#/letter/' + enc(state.letter));
    }
  }

  function go(hash, replace) {
    if (replace) { history.replaceState(null, '', hash); route(); }
    else if (location.hash === hash) route();
    else location.hash = hash;
  }

  // ---- entry panel -----------------------------------------------------------
  function neighbours(it) {
    let k = state.list.indexOf(it.id);
    if (k >= 0) return [byId.get(state.list[k - 1]), byId.get(state.list[k + 1])];
    return [items[it.i - 1], items[it.i + 1]];
  }

  function openEntry(it) {
    const top = it.parent || it;
    const [prev, next] = neighbours(it);
    stopAudio();
    state.openId = it.id;
    entryEl.innerHTML = R.entryHTML(top, prev, next, store.get('more', '0') === '1', state.ling);
    overlay.hidden = false;
    document.body.classList.add('noscroll');
    document.title = `${hwOf(it.c)} – ${TITLE}`;
    $('.close-btn', entryEl).focus({ preventScroll: true });
    const sub = it.parent && entryEl.querySelector(`[data-sub="${it.n}"]`);
    if (sub) { sub.classList.add('hl'); sub.scrollIntoView({ block: 'start' }); } else overlay.scrollTop = 0;
  }

  function closeEntry() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('noscroll');
    document.title = TITLE;
    stopAudio();
    const card = state.openId && main.querySelector(`[data-id="${CSS.escape(state.openId)}"]`);
    if (card) card.focus();
  }

  // ---- events ----------------------------------------------------------------
  const rerender = () => { const r = parse(); if (r.type !== 'entry') showBase(r, location.hash || state.baseHash); };

  let timer;
  function runSearch() {
    clearTimeout(timer);
    const q = qInput.value.trim(), onSearch = parse().type === 'search';
    if (!q) { if (onSearch) go(state.lastBrowse, true); return; }
    go('#/search/' + enc(q), onSearch);
  }
  qInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, 160); });
  qInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      runSearch();
      const first = main.querySelector('.card, .row');
      if (first) first.click();
    } else if (e.key === 'Escape' && qInput.value) {
      qInput.value = '';
      runSearch();
    }
  });

  // ---- audio: one player; tapping the same button again stops it -------------
  const player = new Audio();
  player.preload = 'none';
  let playing = null;
  function stopAudio() {
    player.pause();
    if (playing) playing.classList.remove('playing');
    playing = null;
  }
  function playFile(file) {                // used by the games: play a recording without a button
    stopAudio();
    player.src = 'audio/' + enc(file);
    player.play().catch(() => {});
  }
  function playAudio(btn) {
    if (playing === btn) { stopAudio(); return; }
    stopAudio();
    playing = btn;
    btn.classList.add('playing');
    player.src = 'audio/' + enc(btn.dataset.audio);
    player.play().catch(() => stopAudio());
  }
  player.addEventListener('ended', stopAudio);
  player.addEventListener('error', stopAudio);

  document.addEventListener('click', e => {
    const st = e.target.closest('[data-study]');
    if (st) { e.preventDefault(); study.toggle(st.dataset.study); return; }
    const a = e.target.closest('[data-audio]');
    if (a) { e.preventDefault(); playAudio(a); return; }
    const t = e.target.closest('[data-filter],[data-view],[data-go],.close-btn');
    if (!t) return;
    if (t.dataset.filter) { state.filter = t.dataset.filter; store.set('filter', state.filter); rerender(); }
    else if (t.dataset.view) { state.view = t.dataset.view; store.set('view', state.view); rerender(); }
    else if (t.dataset.go) go('#/entry/' + enc(t.dataset.go), true);
    else go(state.baseHash);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) go(state.baseHash); });
  main.addEventListener('toggle', e => { if (e.target.matches('details.wotd-box')) store.set('wotd', e.target.open ? '1' : '0'); }, true);
  entryEl.addEventListener('toggle', e => { if (e.target.matches('details.more')) store.set('more', e.target.open ? '1' : '0'); }, true);
  entryEl.addEventListener('change', e => {
    if (!e.target.matches('[data-ling]')) return;
    state.ling = e.target.checked;
    store.set('ling', state.ling ? '1' : '0');
    document.body.classList.toggle('show-ling', state.ling);
  });

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName);
    if (!overlay.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); go(state.baseHash); }
      else if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const b = entryEl.querySelectorAll('.nav-btn')[e.key === 'ArrowLeft' ? 0 : 1];
        if (b && !b.disabled) b.click();
      }
      return;
    }
    if (e.key === '/' && !typing) { e.preventDefault(); qInput.focus(); qInput.select(); }
  });

  const nSubs = items.length - DATA.entries.length, nAudio = items.filter(it => it.c.audio).length;
  $('#stats').textContent = [`${DATA.entries.length.toLocaleString()} entries`,
    nSubs ? `${nSubs.toLocaleString()} sub-entries` : '', nAudio ? `${nAudio.toLocaleString()} recordings` : '',
    `built from ${DATA.source}`].filter(Boolean).join(' · ');
  // Kullilli text carries its language code (from the FLEx writing system) and translate="no", so it is
  // known not to be English and page translators leave it alone. Marked as it appears: wordlist, entries,
  // examples and games. Hidden English for screen readers inside it (.sr-only) is marked back as the page's language.
  const VERN_LANG = DATA.langCode || '';
  const VERN_SEL = '.v, .hw, .sub-hw, .exv, .iw-s, .iw-m, .ht, .hk:not(.wide), .ws-cell, .us-tile';
  const mark = el => {
    if (el.lang) return;
    el.lang = VERN_LANG;
    el.setAttribute('translate', 'no');
    el.querySelectorAll('.sr-only').forEach(s => { s.lang = document.documentElement.lang; s.setAttribute('translate', 'yes'); });
  };
  const markLang = node => {
    if (!VERN_LANG || node.nodeType !== 1) return;
    if (node.matches(VERN_SEL)) mark(node);
    node.querySelectorAll(VERN_SEL).forEach(mark);
  };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(markLang))).observe(document.body, { childList: true, subtree: true });
  markLang(document.body);

  window.addEventListener('hashchange', route);
  route();
})();
