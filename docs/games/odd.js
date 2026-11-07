/* Odd one out: four words, three from the same topic; tap the one that doesn't belong.
   One game of the Learn tab (see core.js). To remove it, delete this file (and odd.css) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pick, settings, segHTML, finishHTML, domainGroups, tops, speakerHTML, wireBar, say, autoplayHTML, focusIfKey } = window.DictGames.kit;
  let ctx;

  function odd(root) {
    const s = settings();
    const show = ctx.store.get('g.oddshow', 'k') === 'ke' ? 'ke' : 'k';
    const L = esc(ctx.lang);
    root.innerHTML = '<h2 class="gtitle">Odd one out</h2><p class="gintro">' +
      `Three of these ${L} words belong to the same topic. Tap the one that doesn't. ` +
      'After each answer you\'ll see what all four mean.</p>' +
      '<div class="game-bar">' +
      `<label class="chk2"><input type="checkbox" data-g="audio"${s.audio ? ' checked' : ''}> Only words with recordings</label>` +
      segHTML('oddshow', 'Show', show, [['k', `${L} words`], ['ke', 'Words and meanings']]) + autoplayHTML() +
      '<button type="button" class="gbtn" data-g="new">New round</button></div><div class="gplay"></div>';
    wireBar(root, () => odd(root));
    const play = root.querySelector('.gplay');
    const groups = domainGroups(s, 4);
    if (groups.length < 2) { play.innerHTML = '<p class="empty">Not enough topics with words for this game.</p>'; return; }

    // 10 questions: three words from one topic, one from a topic with a different top-level number
    const qs = [];
    for (const g of shuffle(groups)) {
      if (qs.length === 10) break;
      const three = pick(g.items, 3);
      if (three.length < 3) continue;
      const outside = groups.filter(o => o.top !== g.top).flatMap(o => o.items).filter(it => !tops(it).has(g.top));
      const [oddWord] = pick(outside.filter(it => !three.some(t => gloss(t).toLowerCase() === gloss(it).toLowerCase())), 1);
      if (oddWord) qs.push({ g, odd: oddWord, words: shuffle(three.concat([oddWord])) });
    }
    if (qs.length < 3) { play.innerHTML = '<p class="empty">Not enough topics with words for this game.</p>'; return; }
    let q = 0, score = 0;
    const seen = [];

    function ask() {
      const Q = qs[q];
      play.innerHTML = `<p class="gstat">Question ${q + 1} of ${qs.length} · Score ${score}</p>` +
        '<div class="odd-grid">' + Q.words.map(it => `<div class="lcell"><button type="button" class="lopt v" data-id="${esc(it.id)}">${esc(hw(it))}` +
          (show === 'ke' ? `<span class="odd-gl" lang="en">${esc(gloss(it))}</span>` : '') + '</button><div class="lmore"></div></div>').join('') +
        '</div><div class="odd-say"></div><div class="gnext"></div>';
    }
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { odd(root); return; }
      if (e.target.closest('[data-next]')) { q++; if (q < qs.length) ask(); else play.innerHTML = finishHTML(`You found ${score} of ${qs.length}.`, seen); return; }
      const b = e.target.closest('.lopt');
      if (!b || play.querySelector('.lopt.right')) return;
      const Q = qs[q], right = b.dataset.id === Q.odd.id;
      if (right) score++;
      b.classList.add(right ? 'right' : 'wrong');
      play.querySelectorAll('.lopt').forEach(x => { x.disabled = true; if (x.dataset.id === Q.odd.id) x.classList.add('right'); });
      play.querySelectorAll('.lcell').forEach((cell, i) => {
        const it = Q.words[i];
        cell.querySelector('.lmore').innerHTML = `<span>${esc(gloss(it))}</span>` + (it.c.audio ? speakerHTML(it.c.audio, '', `Listen to ${hw(it)}`) : '');
      });
      Q.words.forEach(it => { if (!seen.includes(it)) seen.push(it); });
      play.querySelector('.odd-say').innerHTML = `${right ? 'Right! ' : ''}The others are all <strong>${esc(Q.g.name)}</strong>.`;
      play.querySelector('.gstat').textContent = `Question ${q + 1} of ${qs.length} · Score ${score}`;
      play.querySelector('.gnext').innerHTML = `<button type="button" class="gbtn primary" data-next>${q + 1 < qs.length ? 'Next' : 'See your score'}</button>`;
      say(`${right ? 'Right.' : 'Not right.'} The odd one out is ${hw(Q.odd)}, ${gloss(Q.odd)}. The others are all ${Q.g.name}: ` +
        Q.words.filter(x => x !== Q.odd).map(x => `${hw(x)}, ${gloss(x)}`).join('; ') + '.');
      focusIfKey(play.querySelector('[data-next]'));
    });
    ask();
  }

  window.DictGames.register({ id: 'odd', group: 'Words and meanings', order: 80, title: 'Odd one out',
    desc: 'Three words share a topic; find the one that doesn\'t belong.',
    run(root, c) { ctx = c; odd(root); } });
})();
