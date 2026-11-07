/* Unscramble: put shuffled letter tiles in order to spell a word, from its meaning or its recording.
   Letters are the language's own (ng, dh … are one tile).
   One game of the Learn tab (see core.js). To remove it, delete this file (and unscramble.css) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, letterKit, record, speakerHTML, say, auto, focusIfKey } = window.DictGames.kit;
  let ctx;

  function unscramble(root) {
    const s = settings();
    const clue = ctx.store.get('g.clue', 'meaning') === 'sound' ? 'sound' : 'meaning';
    const sp = clue === 'sound' ? Object.assign({}, s, { audio: true }) : s;
    const L = esc(ctx.lang);
    const { tok, plain, fits } = letterKit();
    root.innerHTML = '<h2 class="gtitle">Unscramble</h2><p class="gintro">' +
      (clue === 'sound' ? `Listen to the ${L} word` : `Read what the ${L} word means`) +
      ', then tap the letters in the right order to spell it. Tap a letter in the boxes to take it back. ' +
      'Letters like <span class="v">ng</span> and <span class="v">dh</span> are one tile.</p>' +
      barHTML(sp, false, { audio: clue !== 'sound', extra: segHTML('clue', 'Clue', clue, [['meaning', 'Clue: meaning'], ['sound', 'Clue: sound']]) }) +
      '<div class="gplay"></div>';
    wireBar(root, () => unscramble(root));
    const play = root.querySelector('.gplay');
    const words = pick(pool(sp).filter(fits), 8);
    if (words.length < 3) { play.innerHTML = tooFew(words.length); return; }
    let q = 0, firstTry = 0, tiles, slots, missed;

    function ask() {
      const it = words[q], target = tok(plain(it));
      let order = shuffle(target.map((u, i) => i));
      for (let k = 0; k < 5 && order.every((v, i) => target[v] === target[i]); k++) order = shuffle(order);   // not already in order
      tiles = order.map(i => ({ u: target[i], used: false }));
      slots = target.map(() => null);
      missed = false;
      draw();
      if (clue === 'sound') auto(it.c.audio);
    }
    function draw(state = '') {
      const it = words[q];
      play.innerHTML = `<p class="gstat">Word ${q + 1} of ${words.length}</p>` +
        '<div class="us-clue">' + (clue === 'sound' ? speakerHTML(it.c.audio, 'big us-play', 'Play the word') : `<span class="us-gloss">‘${esc(gloss(it))}’</span>`) + '</div>' +
        `<div class="hd-board"><div class="hd-row" role="group" aria-label="Your word"><div class="hd-tiles us-slots${state === 'bad' ? ' shake' : ''}">` +
        slots.map((t, i) => `<button type="button" class="ht us-slot${t !== null ? ' typed' : ''}${state === 'good' ? ' hit' : ''}" data-slot="${i}" ` +
          `aria-label="${t !== null ? `Box ${i + 1}: ${esc(tiles[t].u)}.${state === 'good' || state === 'shown' ? '' : ' Press to take it back.'}` : `Box ${i + 1}, empty`}">` +
          `${t !== null ? esc(tiles[t].u) : ''}</button>`).join('') +
        '</div></div></div>' +
        (state === 'good' || state === 'shown' ? (state === 'shown' ? `<p class="us-note">The word is <strong class="v">${esc(plain(it))}</strong>.</p>` : '') +
          `<div class="gnext"><button type="button" class="gbtn primary" data-next>${q + 1 < words.length ? 'Next word' : 'See your score'}</button></div>`
          : '<div class="us-tiles" role="group" aria-label="Letters to place">' + tiles.map((t, i) => `<button type="button" class="hk us-tile" data-tile="${i}"${t.used ? ' disabled' : ''}>${t.used ? '' : esc(t.u)}</button>`).join('') + '</div>' +
          '<div class="hd-tools"><button type="button" class="gbtn" data-show>Show me</button>' +
          (clue === 'sound' ? `<button type="button" class="gbtn" data-hint>Meaning</button>` : '') + '</div>');
    }
    function check() {
      if (slots.some(t => t === null)) return draw();
      const it = words[q], target = tok(plain(it));
      if (slots.every((t, i) => tiles[t].u === target[i])) {
        if (!missed) firstTry++;
        record(it, !missed);
        auto(it.c.audio);
        draw('good');
        say(`Right: ${plain(it)}, ${gloss(it)}.`);
        focusIfKey(play.querySelector('[data-next]'));
      } else {
        missed = true;
        draw('bad');
        say(`Not the right order yet: ${slots.map(t => tiles[t].u).join(', ')}. Press a box to take its letter back.`);
      }
    }
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { unscramble(root); return; }
      if (e.target.closest('[data-next]')) {
        q++;
        if (q < words.length) ask();
        else play.innerHTML = finishHTML(`You spelled ${firstTry} of ${words.length} at the first try.`, words);
        return;
      }
      if (e.target.closest('[data-hint]')) { e.target.closest('[data-hint]').textContent = `‘${gloss(words[q])}’`; say(`Meaning: ${gloss(words[q])}.`); return; }
      if (e.target.closest('[data-show]')) {
        const it = words[q], target = tok(plain(it));
        record(it, false);
        tiles = target.map(u => ({ u, used: true }));
        slots = target.map((u, i) => i);
        auto(it.c.audio);
        draw('shown');
        say(`The word is ${plain(it)}, ${gloss(it)}.`);
        focusIfKey(play.querySelector('[data-next]'));
        return;
      }
      const t = e.target.closest('[data-tile]');
      if (t) {
        const i = +t.dataset.tile, free = slots.indexOf(null);
        if (free < 0 || tiles[i].used) return;
        tiles[i].used = true; slots[free] = i;
        if (slots.every(x => x !== null)) check(); else { draw(); say(`${tiles[i].u} in box ${free + 1}.`); }
        return;
      }
      const sl = e.target.closest('[data-slot]');
      if (sl && !play.querySelector('[data-next]')) {
        const k = +sl.dataset.slot;
        if (slots[k] === null) return;
        const u = tiles[slots[k]].u;
        tiles[slots[k]].used = false; slots[k] = null;
        draw();
        say(`${u} taken back from box ${k + 1}.`);
      }
    });
    ask();
  }

  window.DictGames.register({ id: 'unscramble', group: 'Spelling', order: 50, title: 'Unscramble', needs: 'keyboard',
    desc: 'Put the letters in order to spell a word, from its meaning or its recording.',
    run(root, c) { ctx = c; unscramble(root); } });
})();
