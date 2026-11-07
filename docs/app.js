/* Dictionary: wordlist, affixes, search, entry panel, audio and URL routing.
   URLs: #/letter/b  #/affixes  #/about  #/search/<query>  #/entry/<id>  (sub-entry: <id>/<n>) */
'use strict';
(() => {
  const DATA = window.DICT_DATA, S = window.BardiSearch, R = window.BardiRender;
  const LANG = DATA.language, TITLE = DATA.title;
  const { esc, enc, hwOf } = R;
  const $ = (sel, el = document) => el.querySelector(sel);
  const main = $('#main'), qInput = $('#q'), withEx = $('#withEx');
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
    mode: store.get('mode', 'both'), withEx: store.get('ex', '0') === '1',
    filter: store.get('filter', 'all'), view: store.get('view', 'cards'),
    letter: LETTERS[0], baseKey: '', list: [], openId: null,
  };
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
      el.insertAdjacentHTML('beforeend', list.slice(n, end).map(x => draw(x.it, x.note)).join(''));
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
  function viewLetter(letter) {
    if (!letterCount[letter]) letter = LETTERS[0];
    state.letter = letter;
    $('[data-tab="letter"]').href = '#/letter/' + enc(letter);
    const inL = items.filter(it => it.c.L === letter);
    const gc = {};
    inL.forEach(it => { const g = group(it.c.cls); gc[g] = (gc[g] || 0) + 1; });
    const shown = state.filter === 'all' ? inL : inL.filter(it => group(it.c.cls) === state.filter);
    const fLabel = (FILTERS.find(f => f[0] === state.filter) || ['', ''])[1];
    const wotd = wordOfTheDay();
    main.innerHTML = (wotd ? R.wotdHTML(wotd.it, wotd.label) : '') +
      '<div class="browse-bar"><nav class="letters" aria-label="Letters">' +
      LETTERS.map(l => `<a href="#/letter/${enc(l)}"${l === letter ? ' class="on" aria-current="page"' : ''} title="${letterCount[l]} entries">${esc(l.toUpperCase())}</a>`).join('') +
      '</nav><div class="tools"><div class="chips" role="group" aria-label="Word type">' +
      FILTERS.map(([k, lab]) => {
        const n = k === 'all' ? inL.length : (gc[k] || 0);
        return `<button type="button" class="chip${state.filter === k ? ' on' : ''}${n ? '' : ' zero'}" data-filter="${k}" aria-pressed="${state.filter === k}">${lab} <span>${n}</span></button>`;
      }).join('') + `</div>${toggleHTML()}</div></div>` +
      `<h2 class="list-title">${esc(letter.toUpperCase())} <small>${shown.length} ${shown.length === 1 ? 'entry' : 'entries'}${state.filter !== 'all' ? ' · ' + esc(fLabel.toLowerCase()) : ''}</small></h2>` +
      (shown.length ? '<div id="list"></div>' : `<p class="empty">No ${esc(fLabel.toLowerCase())} under ${esc(letter.toUpperCase())}.</p>`);
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

  function viewSearch(q) {
    const MAX = 600;
    const conv = r => r.slice(0, MAX).map(x => ({ it: items[x.i], note: x.note, score: x.score }));
    const b = state.mode !== 'english' ? conv(S.bardi(q, state.withEx)) : [];
    const e = state.mode !== 'bardi' ? conv(S.english(q, state.withEx)) : [];
    const secs = [];
    const bSec = { k: 'b', title: `${LANG} words`, list: b };
    const eSec = { k: 'e', title: 'English meanings', list: e };
    if (b.length && (!e.length || b[0].score >= 80)) secs.push(bSec, eSec); else secs.push(eSec, bSec);
    const shown = secs.filter(s => s.list.length);
    const tips = ['try fewer letters'];
    if (state.mode !== 'both') tips.push('search Both');
    if (!state.withEx) tips.push('tick “include example sentences”');
    main.innerHTML = `<div class="results-head"><h2>Results for “${esc(q)}”</h2>${toggleHTML()}</div>` +
      (shown.length
        ? shown.map(s => `<h3 class="section-title">${s.title} <small>${s.list.length}${s.list.length === MAX ? '+' : ''}</small></h3><div data-list="${s.k}"></div>`).join('')
        : `<p class="empty">No matches for “${esc(q)}”. You could ${tips.join(', or ')}.</p>`);
    shown.forEach(s => mountList($(`[data-list="${s.k}"]`), s.list));
    state.list = [...new Set(shown.flatMap(s => s.list.map(x => x.it.id)))];
  }

  // what the Learn-tab games get from the app (see games.js)
  const gameCtx = {
    items, lang: LANG, title: TITLE, R, store, study, keyboard: DATA.keyboard,
    playFile: file => playFile(file),
    setList: ids => { state.list = ids; },
  };

  function viewAbout() {
    main.innerHTML = '';
    main.append($('#about-tpl').content.cloneNode(true));
    const stat = (k, v) => { const el = main.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = v.toLocaleString(); };
    stat('entries', DATA.entries.length);
    stat('subs', items.length - DATA.entries.length);
    const key = main.querySelector('[data-abbr-list]');
    if (key) key.innerHTML = R.abbrListHTML();
    state.list = [];
  }

  // ---- routing -------------------------------------------------------------
  const dec = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  function parse(hash = location.hash) {
    const h = hash.replace(/^#\/?/, '');
    const k = h.indexOf('/');
    const head = k < 0 ? h : h.slice(0, k), rest = k < 0 ? '' : h.slice(k + 1);
    if (head === 'entry') return { type: 'entry', id: dec(rest) };
    if (head === 'search' && rest) return { type: 'search', q: dec(rest) };
    if (head === 'affixes' || head === 'about') return { type: head };
    if (head === 'learn') return { type: 'learn', game: dec(rest) };
    return { type: 'letter', letter: dec(rest) || state.letter };
  }

  function showBase(r, hash) {
    const key = JSON.stringify(r) + [state.filter, state.view, state.mode, state.withEx].join('|');
    state.baseHash = hash;
    if (r.type !== 'search') state.lastBrowse = hash;
    if (key === state.baseKey) return;          // same view: keep scroll position
    state.baseKey = key;
    observers.forEach(o => o.disconnect());
    observers = [];
    document.querySelectorAll('.tabs [data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === r.type));
    $('.tab-search').hidden = r.type !== 'search';
    if (r.type === 'search') { if (document.activeElement !== qInput) qInput.value = r.q; }
    else if (document.activeElement !== qInput) qInput.value = '';
    if (r.type === 'letter') viewLetter(r.letter);
    else if (r.type === 'affixes') viewAffixes();
    else if (r.type === 'about') viewAbout();
    else if (r.type === 'learn') window.DictGames.view(main, r.game, gameCtx);
    else viewSearch(r.q);
    window.scrollTo(0, 0);
  }

  function route() {
    const r = parse();
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
  function modeUI() {
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
    qInput.placeholder = { both: `Search ${LANG} or English…`, bardi: `Search ${LANG} words…`, english: 'Search English meanings…' }[state.mode];
    withEx.checked = state.withEx;
  }
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
  withEx.addEventListener('change', () => { state.withEx = withEx.checked; store.set('ex', state.withEx ? '1' : '0'); rerender(); });

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
    const t = e.target.closest('[data-filter],[data-view],[data-mode],[data-go],.close-btn');
    if (!t) return;
    if (t.dataset.filter) { state.filter = t.dataset.filter; store.set('filter', state.filter); rerender(); }
    else if (t.dataset.view) { state.view = t.dataset.view; store.set('view', state.view); rerender(); }
    else if (t.dataset.mode) { state.mode = t.dataset.mode; store.set('mode', state.mode); modeUI(); rerender(); qInput.focus(); }
    else if (t.dataset.go) go('#/entry/' + enc(t.dataset.go), true);
    else go(state.baseHash);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) go(state.baseHash); });
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

  modeUI();
  window.addEventListener('hashchange', route);
  route();
})();
