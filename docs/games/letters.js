/* Letter by letter: An easier word puzzle: pick letters to fill in a hidden word, with no wrong answers.
   One game of the Learn tab (see core.js). To remove it, delete this file (and letters.css if there is one) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, letterKit, listenBtn, record, practise, say, sr, auto } = window.DictGames.kit;
  let ctx;

  // ---- letter by letter (easier): pick letters to fill in a hidden word, no wrong answers ------------
  function letters(root) {
    const s = settings();
    const L = esc(ctx.lang);
    const { units, tok, plain, fits, keysHTML } = letterKit();
    root.innerHTML = '<h2 class="gtitle">Letter by letter</h2><p class="gintro">' +
      `Tap letters to fill in the hidden ${L} word. Letters in the word appear in their boxes; letters that ` +
      'aren\'t in it are greyed out. Take as many tries as you like. Letters like <span class="v">ng</span> and ' +
      '<span class="v">dh</span> count as one letter and have their own keys.</p>' + barHTML(s, false) + '<div class="gplay"></div>';
    wireBar(root, () => letters(root));
    const play = root.querySelector('.gplay');
    const answers = pool(s).filter(fits);
    if (!answers.length) { play.innerHTML = tooFew(0); return; }
    const it = answers[Math.floor(Math.random() * answers.length)];
    const target = tok(plain(it)), n = target.length;
    const tried = {};                                   // letter -> hit / miss
    let hint = false;
    const done = () => target.every(u => tried[u]);

    function draw() {
      const finished = done();
      const misses = Object.values(tried).filter(v => v === 'miss').length, count = Object.keys(tried).length;
      const tiles = target.map(u => `<span class="ht ${tried[u] ? 'hit' : ''}">${tried[u] ? esc(u) : sr('blank')}</span>`).join('');
      play.innerHTML = `<p class="gstat">${n} letters · ${count} tried${misses ? ` (${misses} not in the word)` : ''}</p>` +
        `<div class="hd-board"><div class="hd-row" role="group" aria-label="The word so far"><div class="hd-tiles">${tiles}</div></div></div>` +
        (finished
          ? `<div class="gdone"><p class="gdone-msg">You found it with ${count} ${count === 1 ? 'letter' : 'letters'} tried.</p>` +
            '<button type="button" class="gbtn primary" data-again>New word</button></div>' +
            `<div class="grid hd-answer">${ctx.R.cardHTML(it)}</div>`
          : '<div class="hd-tools"><button type="button" class="gbtn" data-hint' + (hint ? ' disabled' : '') + '>' +
            (hint ? 'Meaning: ' + esc(gloss(it)) : 'Show the meaning') + '</button>' + listenBtn(it) + '</div>' + keysHTML(tried, '', true));
    }
    function guess(u) {
      if (done() || tried[u] || !units.has(u)) return;
      tried[u] = target.includes(u) ? 'hit' : 'miss';
      if (done()) { auto(it.c.audio); ctx.setList([it.id]); practise([it]); }
      draw();
      const pattern = target.map(x => (tried[x] ? x : 'blank')).join(', ');
      say(`${u} is ${tried[u] === 'hit' ? '' : 'not '}in the word. ` + (done() ? `You found it: ${plain(it)}, ${gloss(it)}.` : `The word so far: ${pattern}.`));
    }
    play.addEventListener('click', e => {
      const k = e.target.closest('[data-k]');
      if (k) { guess(k.dataset.k); return; }
      const l = e.target.closest('[data-listen]');
      if (l) { ctx.playFile(l.dataset.listen); return; }
      if (e.target.closest('[data-hint]')) { hint = true; draw(); say(`Meaning: ${gloss(it)}.`); return; }
      if (e.target.closest('[data-again]')) letters(root);
    });
    const onKey = e => {                                  // single letters can be typed; two-letter ones are on screen
      if (!play.isConnected) { document.removeEventListener('keydown', onKey); return; }
      const ae = document.activeElement;
      if ((ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) || !document.getElementById('overlay').hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-z]$/i.test(e.key)) guess(e.key.toLowerCase());
    };
    document.addEventListener('keydown', onKey);
    draw();
  }

  window.DictGames.register({ id: 'letters', group: 'Spelling', order: 60, title: 'Letter by letter', desc: 'An easier word puzzle: pick letters to fill in a hidden word, with no wrong answers.', needs: 'keyboard', run(root, c) { ctx = c; letters(root); } });
})();
