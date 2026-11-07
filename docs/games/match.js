/* Match up: Drag words onto their meanings, or tap one and then the other.
   One game of the Learn tab (see core.js). To remove it, delete this file (and match.css if there is one) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, letterKit, listenBtn, record, say, auto, focusIfKey } = window.DictGames.kit;
  let ctx;

  // ---- match-up: drag one side onto the other, or tap one then the other ---------------------
  function match(root) {
    const s = settings();
    const L = esc(ctx.lang);
    root.innerHTML = '<h2 class="gtitle">Match up</h2><p class="gintro">' +
      (s.dir === 'k2e' ? `Drag each ${L} word onto its English meaning.` : `Drag each English meaning onto its ${L} word.`) +
      ' On a phone you can also tap one, then the other; with a keyboard, press Enter on one, then on the other.</p>' + barHTML(s, true) + '<div class="gplay"></div>';
    wireBar(root, () => match(root));
    const play = root.querySelector('.gplay');
    const words = pick(pool(s), 6);
    if (words.length < 3) { play.innerHTML = tooFew(words.length); return; }
    const item = (it, side) => `<button type="button" class="mitem ${side}${side === 'k' ? ' v' : ''}" data-id="${esc(it.id)}" data-side="${side}" aria-pressed="false">` +
      `${esc(side === 'k' ? hw(it) : gloss(it))}</button>`;
    const left = s.dir === 'k2e' ? 'k' : 'e', right = left === 'k' ? 'e' : 'k';
    play.innerHTML = '<p class="gstat">Matched: 0 of ' + words.length + '</p><div class="match-cols">' +
      `<div class="mcol">${shuffle(words).map(it => item(it, left)).join('')}</div>` +
      `<div class="mcol">${shuffle(words).map(it => item(it, right)).join('')}</div></div>`;

    let sel = null, done = 0, mistakes = 0;
    const byId = id => words.find(it => it.id === id);
    function tryPair(a, b) {
      if (!a || !b || a === b || a.dataset.side === b.dataset.side) return false;
      if (a.dataset.id === b.dataset.id) {
        [a, b].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.setAttribute('aria-pressed', 'false');
          x.setAttribute('aria-label', `${x.textContent}, matched`); x.disabled = true; });
        const it = byId(a.dataset.id);
        record(it, true);
        auto(it.c.audio);
        say(`Matched: ${hw(it)}, ${gloss(it)}.`);
        focusIfKey([...b.parentNode.querySelectorAll('.mitem:not(:disabled)')][0] || play.querySelector('.mitem:not(:disabled)'));
        play.querySelector('.gstat').textContent = `Matched: ${++done} of ${words.length}`;
        if (done === words.length) {
          setTimeout(() => { play.innerHTML = finishHTML(`All ${words.length} matched` +
            (mistakes ? `, with ${mistakes} ${mistakes === 1 ? 'try' : 'tries'} that didn't fit.` : ' first time!'), words); }, 900);
        }
      } else {
        mistakes++;
        record(byId(a.dataset.id), false);              // the word being placed
        say(`Not a match: ${a.textContent} and ${b.textContent}.`);
        [a, b].forEach(x => { x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad'); });
      }
      return true;
    }
    const press = (x, on) => { x.classList.toggle('sel', on); x.setAttribute('aria-pressed', String(on)); };
    function select(b) {
      if (sel === b) { press(b, false); sel = null; say('Unselected.'); return; }
      if (sel && sel.dataset.side !== b.dataset.side) { const a = sel; sel = null; press(a, false); tryPair(a, b); return; }
      if (sel) press(sel, false);
      sel = b; press(b, true);
      say(`${b.textContent} selected. Now choose its ${b.dataset.side === 'k' ? 'meaning' : 'word'}.`);
    }

    // pointer events cover mouse, touch and pen; a short press without moving counts as a tap
    let drag = null, dragged = 0;
    play.addEventListener('pointerdown', e => {
      const b = e.target.closest('.mitem');
      if (!b || b.disabled || e.button > 0) return;
      drag = { b, x: e.clientX, y: e.clientY, ghost: null };
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* moves still reach the board */ }
    });
    play.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
        drag.ghost = drag.b.cloneNode(true);
        drag.ghost.classList.add('ghost');
        drag.ghost.style.width = drag.b.offsetWidth + 'px';
        document.body.appendChild(drag.ghost);
        drag.b.classList.add('lifted');
      }
      drag.ghost.style.left = (e.clientX - drag.b.offsetWidth / 2) + 'px';
      drag.ghost.style.top = (e.clientY - 22) + 'px';
      play.querySelectorAll('.mitem.over').forEach(x => x.classList.remove('over'));
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const t = under && under.closest('.mitem');
      if (t && !t.disabled && t.dataset.side !== drag.b.dataset.side) t.classList.add('over');
    });
    const end = e => {
      if (!drag) return;
      const { b, ghost } = drag;
      drag = null;
      play.querySelectorAll('.mitem.over').forEach(x => x.classList.remove('over'));
      b.classList.remove('lifted');
      if (!ghost) return;                                 // a tap: the click that follows picks the word
      ghost.remove();
      dragged = Date.now();
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const t = under && under.closest('.mitem');
      if (t && !t.disabled) { if (sel) { press(sel, false); sel = null; } tryPair(b, t); }
    };
    play.addEventListener('pointerup', end);
    play.addEventListener('pointercancel', end);
    // picking a word is a click: mouse, tap, Enter/Space and screen readers all produce one
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { match(root); return; }
      const b = e.target.closest('.mitem');
      if (b && !b.disabled && Date.now() - dragged > 300) select(b);
    });
  }

  window.DictGames.register({ id: 'match', group: 'Words and meanings', order: 20, title: 'Match up', desc: 'Drag words onto their meanings, or tap one and then the other.', run(root, c) { ctx = c; match(root); } });
})();
