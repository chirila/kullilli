/* Word in the middle: Pick the right meaning from the circle round the word.
   One game of the Learn tab (see core.js). To remove it, delete this file (and circle.css if there is one) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, letterKit, listenBtn, record, say, auto, speakerHTML, focusIfKey } = window.DictGames.kit;
  let ctx;

  // ---- word in the middle: one word in the centre, meanings in a circle round it ------------------
  function circle(root) {
    const s = settings();
    const L = esc(ctx.lang);
    root.innerHTML = '<h2 class="gtitle">Word in the middle</h2><p class="gintro">' +
      (s.dir === 'k2e' ? `Tap the English meaning of the ${L} word in the middle.` : `Tap the ${L} word for the English in the middle.`) +
      '</p>' + barHTML(s, true) + '<div class="gplay"></div>';
    wireBar(root, () => circle(root));
    const play = root.querySelector('.gplay');
    const list = pool(s);
    const qs = pick(list, 10);
    if (qs.length < 4) { play.innerHTML = tooFew(qs.length); return; }
    let q = 0, score = 0;
    const others = list.length >= 12 ? list : pool(s, true);       // small topic: take wrong answers from all words

    function ask() {
      const it = qs[q];
      const opts = shuffle([it].concat(pick(others.filter(x => gloss(x).toLowerCase() !== gloss(it).toLowerCase()
        && hw(x).toLowerCase() !== hw(it).toLowerCase()), 5)));
      const k2e = s.dir === 'k2e';
      const centre = k2e
        ? `<span class="cw-word v">${esc(hw(it))}</span>${it.c.audio ? speakerHTML(it.c.audio, '', `Listen to ${hw(it)}`) : ''}`
        : `<span class="cw-word">${esc(gloss(it))}</span>`;
      const n = opts.length;
      play.innerHTML = `<p class="gstat">Question ${q + 1} of ${qs.length} · Score ${score}</p>` +
        `<div class="circle"><div class="cw">${centre}</div>` + opts.map((o, i) => {
          const a = -Math.PI / 2 + i * 2 * Math.PI / n;
          return `<button type="button" class="opt${k2e ? '' : ' v'}" data-id="${esc(o.id)}" style="left:${(50 + 36 * Math.cos(a)).toFixed(2)}%;top:${(50 + 36 * Math.sin(a)).toFixed(2)}%">` +
            `${esc(k2e ? gloss(o) : hw(o))}</button>`;
        }).join('') + '</div><div class="gnext"></div>';
      if (k2e) auto(it.c.audio);
    }
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { circle(root); return; }
      if (e.target.closest('[data-next]')) { next(); return; }
      const b = e.target.closest('.opt');
      if (!b || play.querySelector('.opt.right, .opt.wrong')) return;
      const it = qs[q];
      const right = b.dataset.id === it.id;
      b.classList.add(right ? 'right' : 'wrong');
      if (!right) play.querySelector(`.opt[data-id="${CSS.escape(it.id)}"]`).classList.add('right');
      play.querySelectorAll('.opt').forEach(x => { x.disabled = true; });
      if (right) score++;
      record(it, right);
      auto(it.c.audio);
      const k2e = s.dir === 'k2e';
      say(right ? `Right: ${hw(it)} means ${gloss(it)}.` : `Not right. ${k2e ? `${hw(it)} means ${gloss(it)}` : `${gloss(it)} is ${hw(it)}`}.`);
      play.querySelector('.gstat').textContent = `Question ${q + 1} of ${qs.length} · Score ${score}`;
      play.querySelector('.gnext').innerHTML = `<button type="button" class="gbtn primary" data-next>${q + 1 < qs.length ? 'Next' : 'See your score'}</button>`;
      focusIfKey(play.querySelector('[data-next]'));
    });
    function next() {
      if (!play.querySelector('.opt.right')) return;                  // already moved on
      q++;
      if (q < qs.length) ask();
      else play.innerHTML = finishHTML(`You got ${score} out of ${qs.length}.`, qs);
    }
    ask();
  }

  window.DictGames.register({ id: 'circle', group: 'Words and meanings', order: 30, title: 'Word in the middle', desc: 'Pick the right meaning from the circle round the word.', run(root, c) { ctx = c; circle(root); } });
})();
