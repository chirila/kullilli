/* Memory pairs: turn over cards to find matching pairs: a word and its meaning, or (sound pairs)
   a recording and the word or its meaning.
   One game of the Learn tab (see core.js). To remove it, delete this file (and memory.css) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, say, auto } = window.DictGames.kit;
  let ctx;

  // card sides: k = written word, e = English meaning, s = sound (plays when turned over)
  const MODES = { we: ['k', 'e'], sw: ['s', 'k'], se: ['s', 'e'] };

  function memory(root) {
    const s = settings();
    const mode = MODES[ctx.store.get('g.cards', 'we')] ? ctx.store.get('g.cards', 'we') : 'we';
    const sound = mode !== 'we';
    const L = esc(ctx.lang);
    const sp = sound ? Object.assign({}, s, { audio: true }) : s;          // sound cards need recordings
    root.innerHTML = '<h2 class="gtitle">Memory pairs</h2><p class="gintro">Turn over two cards at a time and find the pairs (cards that don\'t match stay up until you turn the next one): ' +
      (mode === 'we' ? `each ${L} word and its English meaning.` : mode === 'sw'
        ? `each recording and the ${L} word it says. A sound card plays when you turn it over.`
        : 'each recording and its English meaning. A sound card plays when you turn it over.') + '</p>' +
      barHTML(sp, false, { audio: !sound, extra: segHTML('cards', 'Cards', mode,
        [['we', 'Word & meaning'], ['sw', 'Sound & word'], ['se', 'Sound & meaning']]) }) + '<div class="gplay"></div>';
    wireBar(root, () => memory(root));
    const play = root.querySelector('.gplay');
    const words = pick(pool(sp), 6);
    if (words.length < 4) { play.innerHTML = tooFew(words.length); return; }
    const cards = shuffle(words.flatMap(it => MODES[mode].map(side => ({ it, side }))));
    const face = cd => cd.side === 's'
      ? '<svg class="snd" viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9.5v5h4l5 4v-13l-5 4H3z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
      : esc(cd.side === 'k' ? hw(cd.it) : gloss(cd.it));
    const label = cd => (cd.side === 's' ? 'a recording' : cd.side === 'k' ? hw(cd.it) : gloss(cd.it));
    play.innerHTML = '<p class="gstat">Moves: 0</p><div class="mem-grid">' + cards.map((cd, i) =>
      `<button type="button" class="mcard ${cd.side}" data-i="${i}" aria-label="Card ${i + 1}, face down">` +
      `<span class="mface${cd.side === 'k' ? ' v' : ''}">${face(cd)}</span></button>`).join('') + '</div>';
    let open = [], moves = 0, found = 0, wrongPair = null;
    const el = i => play.querySelector(`.mcard[data-i="${i}"]`);
    const show = (i, on) => { const b = el(i), cd = cards[i]; b.classList.toggle('up', on);
      b.setAttribute('aria-label', on ? label(cd) : `Card ${i + 1}, face down`); };
    play.querySelector('.mem-grid').addEventListener('click', e => {
      const b = e.target.closest('.mcard');
      if (!b) return;
      const i = +b.dataset.i;
      if (b.classList.contains('up') && !(wrongPair && wrongPair.includes(i))) {   // a turned-up sound card plays again
        if (cards[i].side === 's') ctx.playFile(cards[i].it.c.audio);
        return;
      }
      if (wrongPair) { wrongPair.forEach(k => show(k, false)); wrongPair = null; }  // turn back the last pair that didn't match
      if (b.classList.contains('up')) return;
      show(i, true);
      say(`${label(cards[i])}.`);
      if (cards[i].side === 's') ctx.playFile(cards[i].it.c.audio);
      open.push(i);
      if (open.length < 2) return;
      moves++;
      const [a, c] = open;
      open = [];
      play.querySelector('.gstat').textContent = `Moves: ${moves}`;
      if (cards[a].it === cards[c].it) {
        [a, c].forEach(k => { el(k).classList.add('got'); el(k).setAttribute('aria-disabled', 'true');
          el(k).setAttribute('aria-label', `${label(cards[k])}, matched`); });
        say(`A pair: ${hw(cards[a].it)}, ${gloss(cards[a].it)}.`);
        if (!sound) auto(cards[a].it.c.audio);
        if (++found === words.length) {
          setTimeout(() => { play.innerHTML = finishHTML(`You found all ${words.length} pairs in ${moves} moves.`, words); }, 900);
        }
      } else {
        wrongPair = [a, c];                                        // stays face up until the next card is turned
        say('Not a pair. They will turn back when you turn over the next card.');
      }
    });
    play.addEventListener('click', e => { if (e.target.closest('[data-again]')) memory(root); });
  }

  window.DictGames.register({ id: 'memory', group: 'Words and meanings', order: 10, title: 'Memory pairs',
    desc: 'Turn over cards to find each word and its meaning, or match recordings to words (sound pairs).',
    run(root, c) { ctx = c; memory(root); } });
})();
