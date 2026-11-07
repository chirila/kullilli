/* Same or different?: hear two recordings and say whether they are the same word. The different ones are
   minimal pairs (one letter apart), which can be limited to one kind of sound difference.
   One game of the Learn tab (see core.js). To remove it, delete this file (and same.css) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, segHTML, finishHTML, letterKit, speakerHTML } = window.DictGames.kit;
  let ctx;

  // kinds of sound difference, by the two letters that differ
  const GROUPS = [
    ['vowels', 'Vowels (a, i, u)', [['a', 'i'], ['a', 'u'], ['i', 'u']]],
    ['voicing', 'b/p, d/t, g/k …', [['b', 'p'], ['d', 't'], ['g', 'k'], ['dh', 'th'], ['dy', 'ty'], ['rd', 'rt']]],
    ['rr', 'r / rr', [['r', 'rr']]],
    ['retroflex', 'd/rd, n/rn, l/rl …', [['d', 'rd'], ['t', 'rt'], ['n', 'rn'], ['l', 'rl']]],
    ['dental', 'd/dh, n/nh, l/lh …', [['d', 'dh'], ['t', 'th'], ['n', 'nh'], ['l', 'lh']]],
    ['palatal', 'd/dy, n/ny, l/ly …', [['d', 'dy'], ['t', 'ty'], ['n', 'ny'], ['l', 'ly']]],
  ];
  const kindOf = (x, y) => (GROUPS.find(g => g[2].some(([p, q]) => (p === x && q === y) || (p === y && q === x))) || ['other'])[0];

  let PAIRS = null;                                   // computed once: [{ a, b, kind, diff: [x, y] }]
  function pairs() {
    if (PAIRS) return PAIRS;
    const { tok } = letterKit();
    const words = ctx.items.filter(it => !it.parent && !it.c.see && it.c.audio && /^[a-z]+$/.test(hw(it)));
    const firstGloss = it => ((it.c.senses || []).flatMap(s => s.gl || [])[0] || '').toLowerCase();
    const variants = it => new Set((it.c.va || []).map(v => String(v[0]).toLowerCase()));
    const T = new Map(words.map(it => [it, tok(hw(it))]));
    const seen = new Set();
    PAIRS = [];
    words.forEach((a, i) => words.slice(i + 1).forEach(b => {
      const ta = T.get(a), tb = T.get(b);
      if (ta.length !== tb.length || hw(a) === hw(b)) return;
      const diff = ta.map((u, k) => [u, tb[k]]).filter(([u, v]) => u !== v);
      if (diff.length !== 1) return;
      if ((firstGloss(a) && firstGloss(a) === firstGloss(b)) || variants(a).has(hw(b)) || variants(b).has(hw(a))) return;  // same word, other spelling
      const key = [hw(a), hw(b)].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      PAIRS.push({ a, b, kind: kindOf(...diff[0]), diff: diff[0] });
    }));
    return PAIRS;
  }

  let cur = null;                                      // the recording playing now (this game plays two in a row)
  const stop = () => { if (cur) { cur.pause(); cur = null; } };
  function playTwo(fa, fb, mark) {
    stop();
    const a = new Audio('audio/' + encodeURIComponent(fa));
    cur = a; mark(1);
    a.onended = () => setTimeout(() => {
      if (cur !== a) return;
      const b = new Audio('audio/' + encodeURIComponent(fb));
      cur = b; mark(2);
      b.onended = () => { if (cur === b) mark(0); };
      b.play().catch(() => mark(0));
    }, 450);
    a.play().catch(() => mark(0));
  }

  function same(root) {
    const kind = ctx.store.get('g.contrast', 'all');
    const all = pairs(), count = k => all.filter(p => k === 'all' || p.kind === k).length;
    const opts = [['all', `Any difference (${count('all')})`]].concat(GROUPS.filter(g => count(g[0]) >= 3).map(g => [g[0], `${g[1]} (${count(g[0])})`]));
    root.innerHTML = '<h2 class="gtitle">Same or different?</h2><p class="gintro">Listen to two recordings. Are they the same ' +
      `${esc(ctx.lang)} word twice, or two different words? The different ones are only one sound apart, so listen closely. ` +
      'Choose a kind of sound difference to practise just that.</p>' +
      '<div class="game-bar"><label class="gsel">Sounds <select data-g="contrast">' +
      opts.map(([v, t]) => `<option value="${v}"${v === kind ? ' selected' : ''}>${esc(t)}</option>`).join('') + '</select></label>' +
      '<button type="button" class="gbtn" data-g="new">New round</button></div><div class="gplay"></div>';
    root.querySelector('[data-g="contrast"]').addEventListener('change', e => { ctx.store.set('g.contrast', e.target.value); stop(); same(root); });
    root.querySelector('[data-g="new"]').addEventListener('click', () => { stop(); same(root); });
    const play = root.querySelector('.gplay');
    const pool = shuffle(all.filter(p => kind === 'all' || p.kind === kind));
    if (pool.length < 3) { play.innerHTML = '<p class="empty">Not enough recorded pairs for this kind of sound yet.</p>'; return; }
    // 10 trials, about half "different" (a pair) and half "same" (one word twice)
    const trials = shuffle(Array.from({ length: Math.min(10, pool.length * 2) }, (_, i) => {
      const p = pool[Math.floor(i / 2) % pool.length];
      return i % 2 ? { same: true, a: Math.random() < 0.5 ? p.a : p.b, pair: p } : { same: false, a: p.a, b: p.b, pair: p };
    })).map(t => (t.same ? t : (Math.random() < 0.5 ? t : Object.assign({}, t, { a: t.b, b: t.a }))));
    let q = 0, score = 0;
    const words = [];

    function ask() {
      const t = trials[q];
      play.innerHTML = `<p class="gstat" aria-live="polite">Pair ${q + 1} of ${trials.length} · Score ${score}</p>` +
        '<div class="sd-box"><div class="sd-marks"><span class="sd-n" data-n="1">1</span><span class="sd-n" data-n="2">2</span></div>' +
        '<button type="button" class="gbtn sd-play" data-replay>▶ Play again</button>' +
        '<div class="sd-choices"><button type="button" class="sd-ans" data-ans="same">Same</button>' +
        '<button type="button" class="sd-ans" data-ans="diff">Different</button></div><div class="sd-reveal"></div></div><div class="gnext"></div>';
      hear();
    }
    const mark = n => play.querySelectorAll('.sd-n').forEach(x => x.classList.toggle('on', +x.dataset.n === n));
    const hear = () => { const t = trials[q]; playTwo(t.a.c.audio, (t.same ? t.a : t.b).c.audio, mark); };
    const wordHTML = it => `<div class="sd-word"><span class="v">${esc(hw(it))}</span><span class="tr">${esc(gloss(it) || (it.c.senses || []).flatMap(s => s.gl || [])[0] || '')}</span>${speakerHTML(it.c.audio)}</div>`;

    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { same(root); return; }
      if (e.target.closest('[data-replay]')) { hear(); return; }
      if (e.target.closest('[data-next]')) {
        stop(); q++;
        if (q < trials.length) ask(); else play.innerHTML = finishHTML(`You got ${score} out of ${trials.length}.`, words);
        return;
      }
      const b = e.target.closest('[data-ans]');
      if (!b || play.querySelector('.sd-ans.right, .sd-ans.wrong')) return;
      const t = trials[q], right = (b.dataset.ans === 'same') === t.same;
      if (right) score++;
      b.classList.add(right ? 'right' : 'wrong');
      play.querySelectorAll('.sd-ans').forEach(x => { x.disabled = true; });
      [t.a, t.b].filter(Boolean).forEach(it => { if (!words.includes(it)) words.push(it); });
      const [x, y] = t.pair.diff;
      play.querySelector('.sd-reveal').innerHTML = (t.same
        ? `<p class="sd-say">${right ? 'Right: ' : ''}the same word twice.</p>${wordHTML(t.a)}`
        : `<p class="sd-say">${right ? 'Right: ' : ''}two different words, <strong class="v">${esc(x)}</strong> / <strong class="v">${esc(y)}</strong>.</p>${wordHTML(t.a)}${wordHTML(t.b)}`);
      play.querySelector('.gstat').textContent = `Pair ${q + 1} of ${trials.length} · Score ${score}`;
      play.querySelector('.gnext').innerHTML = `<button type="button" class="gbtn primary" data-next>${q + 1 < trials.length ? 'Next' : 'See your score'}</button>`;
    });
    ask();
  }

  window.DictGames.register({ id: 'same', group: 'Listening', order: 45, title: 'Same or different?', needs: 'keyboard',
    desc: 'Hear two recordings and say if they are the same word. The different ones are one sound apart.',
    run(root, c) { ctx = c; same(root); } });
})();
