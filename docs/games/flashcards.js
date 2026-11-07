/* Flashcards: see a word, turn the card over for its meaning (or the other way round) and an example.
   Counts the words studied this way per day and shows today, this week, this month and this year.
   One game of the Learn tab (see core.js). To remove it, delete this file (and flashcards.css) and rebuild. */
'use strict';
(() => {
  const { esc, hw, pool, pick, settings, segHTML, barHTML, wireBar, finishHTML, practise, practised, record, speakerHTML, say, auto } = window.DictGames.kit;
  let ctx;

  // ---- words studied with flashcards: a count per day (store "flash"), kept on this device only.
  //      A card counts the first time it is turned over in a round.  Weeks start on Monday.
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const readLog = () => { try { return JSON.parse(ctx.store.get('flash', '{}')) || {}; } catch (e) { return {}; } };
  function logCard() {
    const log = readLog(), k = dayKey(new Date());
    log[k] = (log[k] || 0) + 1;
    ctx.store.set('flash', JSON.stringify(log));
  }
  function totals() {
    const now = new Date(), today = dayKey(now);
    const monday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7));
    const t = { day: 0, week: 0, month: 0, year: 0 };
    Object.entries(readLog()).forEach(([k, n]) => {
      if (k === today) t.day += n;
      if (k >= monday && k <= today) t.week += n;
      if (k.slice(0, 7) === today.slice(0, 7)) t.month += n;
      if (k.slice(0, 4) === today.slice(0, 4)) t.year += n;
    });
    return t;
  }
  const totalsHTML = () => {
    const t = totals();
    return '<p class="fc-totals">Words studied with flashcards: ' +
      `today <strong>${t.day}</strong> · this week <strong>${t.week}</strong> · ` +
      `this month <strong>${t.month}</strong> · this year <strong>${t.year}</strong></p>`;
  };

  function flashcards(root) {
    const s = settings();
    const L = esc(ctx.lang);
    const n = +ctx.store.get('g.fcards', '10') || 10;       // own name: Memory pairs uses g.cards for its card type
    const which = s.which;                                    // any words / new to me / studied before (in the bar)
    root.innerHTML = '<h2 class="gtitle">Flashcards</h2><p class="gintro">' +
      'See a word, think of its meaning, then turn the card over: click or tap it, or press Enter. ' +
      `The back has the other language and an example, and the ${L} word can be played. ` +
      'Then say whether you knew it: words you are still learning go on your tricky words list (on the My lists tab). ' +
      'With a keyboard, the left and right arrow keys go to the previous or next card.</p>' +
      barHTML(s, true, { extra:
        `<label class="gsel">Cards <select data-g="fcards">${[5, 10, 20, 30, 50].map(k =>
          `<option value="${k}"${k === n ? ' selected' : ''}>${k}</option>`).join('')}</select></label>` }) +
      '<div class="gplay"></div>';
    wireBar(root, () => flashcards(root));
    const play = root.querySelector('.gplay');

    // pool() already keeps only new or studied words; studied before: the ones practised longest ago first
    const p = practised();
    let list = pool(s);
    if (which === 'old') list = list.sort((a, b) => p[a.id].t - p[b.id].t).slice(0, n * 2);
    const cards = pick(list, n);
    if (!cards.length) {
      play.innerHTML = '<p class="empty">' + (which === 'new'
        ? 'You have studied every word in this topic. Choose “Studied before”, “Any words” or another topic.'
        : which === 'old'
          ? 'You haven’t studied any words in this topic yet. A word counts as studied when you turn its flashcard ' +
            'or finish a round of any game with it. Choose “New to me” or “Any words”.'
          : 'There are no words in this topic. Choose another topic, or untick “Only words with recordings”.') +
        '</p>' + totalsHTML();
      return;
    }

    const k2e = s.dir === 'k2e';
    let q = 0, back = false;
    const turned = new Set();
    const rated = new Map();                                 // card number -> 'got' / 'learning' (once per round)

    function draw() {
      const it = cards[q], last = q === cards.length - 1;
      const kw = `<span class="fc-word v">${esc(hw(it))}</span>`;
      const ew = `<span class="fc-word">${ctx.R.fmt(ctx.R.meaning(it.c), false)}</span>`;
      const pos = ctx.R.posLabel(it.c.ps), ex = back ? ctx.R.exampleHTML(it.c) : '';
      const body = back
        ? `<span class="fc-side">${k2e ? 'English' : L}</span><span class="fc-main sp">${k2e ? ew : kw}</span>` +
          `<span class="fc-also sp">${k2e ? kw : ew}${pos ? ` <span class="fc-pos">${esc(pos)}</span>` : ''}</span>` +
          (ex ? `<span class="fc-ex sp">${ex}</span>` : '')
        : `<span class="fc-side">${k2e ? L : 'English'}</span><span class="fc-main sp">${k2e ? kw : ew}</span>`;
      const sound = it.c.audio && (k2e || back) ? speakerHTML(it.c.audio, '', `Listen to ${hw(it)}`) : '';
      play.innerHTML = `<p class="gstat">Card ${q + 1} of ${cards.length}</p>` +
        `<div class="fc ${back ? 'back' : 'front'}" data-card><div class="fc-body">${body}</div>` +
        `<div class="fc-tools">${sound}<button type="button" class="gbtn" data-flip data-autofocus>Turn over</button>` +
        (back ? `<a class="gbtn" href="#/entry/${encodeURIComponent(it.id)}">Open the entry</a>` : '') +
        ctx.R.studyBtn(it, false, 'This word in my study list') + '</div></div>' +     // no word in the label: it would give the answer away
        (back ? rateHTML(rated.get(q)) : '') +
        `<div class="fc-nav"><button type="button" class="gbtn" data-prev${q ? '' : ' disabled'}>‹ Previous</button>` +
        `<button type="button" class="gbtn primary" data-next>${last ? 'Finish' : 'Next ›'}</button></div>` + totalsHTML();
      // read the card out after the "Card n of m" line (which core.js announces)
      const parts = [...play.querySelectorAll('.fc-side, .fc-main, .fc-also .fc-word, .fc-pos, .fc-ex .exv, .fc-ex .exe')]
        .map(e => e.textContent.trim()).filter(Boolean).map(t => (/[.!?:]$/.test(t) ? t : t + '.'));
      setTimeout(() => say(parts.join(' '), 'card'), 0);     // a newer card replaces one not yet read
    }
    // after turning a card over: did you know it?  Still learning = a wrong answer (onto the tricky list);
    // got it = a right one (two in a row take a word off the tricky list).  Then on to the next card.
    const rateHTML = r => '<div class="fc-rate" role="group" aria-labelledby="fc-rate-q"><span id="fc-rate-q">Did you know it?</span>' +
      `<button type="button" class="gbtn" data-rate="got" aria-pressed="${r === 'got'}"${r ? ' disabled' : ''}>✓ Got it</button>` +
      `<button type="button" class="gbtn" data-rate="learning" aria-pressed="${r === 'learning'}"${r ? ' disabled' : ''}>Still learning</button></div>`;
    function rate(kind) {
      if (rated.has(q)) return;
      rated.set(q, kind);
      record(cards[q], kind === 'got');
      say(kind === 'got' ? 'Got it.' : 'Still learning: added to your tricky words.', 'rate');
      go(1);
    }
    function flip() {
      back = !back;
      const it = cards[q];
      if (back && !turned.has(q)) { turned.add(q); logCard(); practise([it]); }
      draw();
      if (back && !k2e) auto(it.c.audio);                 // English first: the recording comes with the Kullilli side
    }
    function go(d) {
      if (d > 0 && q === cards.length - 1) { finish(); return; }
      if (q + d < 0) return;
      q += d;
      back = false;
      draw();
      if (k2e) auto(cards[q].c.audio);
    }
    function finish() {
      const got = [...rated.values()].filter(v => v === 'got').length, learning = rated.size - got;
      const msg = `You turned over ${turned.size} of ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}.` +
        (rated.size ? ` You knew ${got}${learning ? `; ${learning} ${learning === 1 ? 'word went' : 'words went'} on your tricky words list` : ''}.` : '');
      play.innerHTML = finishHTML(msg, cards, true) + totalsHTML();
      say(msg);
    }

    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { flashcards(root); return; }
      if (e.target.closest('[data-next]')) { go(1); return; }
      if (e.target.closest('[data-prev]')) { go(-1); return; }
      if (e.target.closest('[data-flip]')) { flip(); return; }
      const rb = e.target.closest('[data-rate]');
      if (rb) { rate(rb.dataset.rate); return; }
      if (e.target.closest('[data-card]') && !e.target.closest('button, a')) flip();     // anywhere on the card
    });
    const onKey = e => {
      if (!play.isConnected) { document.removeEventListener('keydown', onKey); return; }
      const ae = document.activeElement;
      if ((ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) || !document.getElementById('overlay').hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !play.querySelector('[data-card]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if ((e.key === 'Enter' || e.key === ' ') && (!ae || ae === document.body)) { e.preventDefault(); flip(); }
    };
    document.addEventListener('keydown', onKey);
    draw();
    if (k2e) auto(cards[0].c.audio);
  }

  window.DictGames.register({ id: 'flashcards', group: 'Every day', order: 2, title: 'Flashcards',
    desc: 'Turn over cards to learn words, with recordings and examples. Counts the words you study each day.',
    run(root, c) { ctx = c; flashcards(root); } });
})();
