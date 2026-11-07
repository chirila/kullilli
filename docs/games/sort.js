/* Sort into groups: drag words (or tap a word, then a basket) into baskets for two or three topics.
   One game of the Learn tab (see core.js). To remove it, delete this file (and sort.css) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pick, settings, segHTML, finishHTML, domainGroups, tops, record } = window.DictGames.kit;
  let ctx;

  function sortGame(root) {
    const s = settings();
    const n = ctx.store.get('g.groups', '2') === '3' ? 3 : 2;
    const L = esc(ctx.lang);
    root.innerHTML = '<h2 class="gtitle">Sort into groups</h2><p class="gintro">' +
      `Put each ${L} word in the basket for its topic: drag it there, or tap the word and then the basket.</p>` +
      '<div class="game-bar">' +
      `<label class="chk2"><input type="checkbox" data-g="audio"${s.audio ? ' checked' : ''}> Only words with recordings</label>` +
      segHTML('groups', 'Baskets', String(n), [['2', 'Two topics'], ['3', 'Three topics']]) +
      '<button type="button" class="gbtn" data-g="new">New round</button></div><div class="gplay"></div>';
    const bar = root.querySelector('.game-bar');
    bar.addEventListener('change', e => { if (e.target.dataset.g === 'audio') ctx.store.set('g.audio', e.target.checked ? '1' : '0'); sortGame(root); });
    bar.addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b) return; if (b.dataset.v) ctx.store.set('g.' + b.dataset.g, b.dataset.v); sortGame(root); });
    const play = root.querySelector('.gplay');

    // topics from different top-level domains, so no word could belong to two baskets
    const chosen = [];
    for (const g of shuffle(domainGroups(s, 4))) {
      if (chosen.length === n) break;
      if (chosen.some(c => c.top === g.top)) continue;
      const others = chosen.map(c => c.top);
      const words = pick(g.items.filter(it => !others.some(t => tops(it).has(t))), 4);
      if (words.length === 4) chosen.push(Object.assign({}, g, { words }));
    }
    if (chosen.length < n) { play.innerHTML = '<p class="empty">Not enough topics with words for this game.</p>'; return; }
    chosen.forEach(g => { g.words = g.words.filter(it => !chosen.some(o => o !== g && tops(it).has(o.top))); });
    const chips = shuffle(chosen.flatMap((g, gi) => g.words.map(it => ({ it, gi }))));
    const missed = new Set();
    let placed = 0, mistakes = 0, sel = null, meanings = false;

    function draw() {
      play.innerHTML = `<p class="gstat" aria-live="polite">Sorted: ${placed} of ${chips.length}</p>` +
        `<div class="sort-baskets n${n}">` + chosen.map((g, gi) => `<div class="basket" data-b="${gi}"><div class="basket-name">${esc(g.name)}</div>` +
          '<div class="basket-in">' + chips.filter(c => c.done && c.gi === gi).map(c => `<span class="wchip in v">${esc(hw(c.it))}</span>`).join('') + '</div></div>').join('') +
        '</div><div class="sort-pool">' + chips.map((c, i) => c.done ? '' : `<button type="button" class="wchip${sel === i ? ' sel' : ''}" data-c="${i}">` +
          `<span class="v">${esc(hw(c.it))}</span>${meanings ? `<span class="wchip-gl">${esc(gloss(c.it))}</span>` : ''}</button>`).join('') + '</div>' +
        `<div class="hd-tools"><button type="button" class="gbtn" data-meanings${meanings ? ' disabled' : ''}>${meanings ? 'Meanings shown' : 'Show meanings'}</button></div>`;
    }
    function drop(ci, gi, chipEl) {
      const c = chips[ci];
      if (!c || c.done) return;
      if (c.gi === gi) {
        c.done = true; placed++;
        record(c.it, !missed.has(c.it));
        if (c.it.c.audio) ctx.playFile(c.it.c.audio);
        sel = null;
        if (placed === chips.length) {
          play.innerHTML = finishHTML(`All sorted${mistakes ? `, with ${mistakes} ${mistakes === 1 ? 'word' : 'words'} in the wrong basket on the way` : ' first time'}.`, chips.map(x => x.it));
          return;
        }
        draw();
      } else {
        mistakes++; missed.add(c.it);
        sel = null;
        draw();
        const again = play.querySelector(`[data-c="${ci}"]`), basket = play.querySelector(`[data-b="${gi}"]`);
        [again, basket].forEach(x => { if (x) { x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad'); } });
      }
    }

    // tap a word then a basket, or drag the word onto a basket (pointer events: mouse, touch, pen)
    let drag = null;
    play.addEventListener('pointerdown', e => {
      const b = e.target.closest('.wchip[data-c]');
      if (!b || e.button > 0) return;
      drag = { b, x: e.clientX, y: e.clientY, ghost: null };
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    });
    play.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
        drag.ghost = drag.b.cloneNode(true); drag.ghost.classList.add('ghost');
        document.body.appendChild(drag.ghost); drag.b.classList.add('lifted');
      }
      drag.ghost.style.left = (e.clientX - drag.ghost.offsetWidth / 2) + 'px';
      drag.ghost.style.top = (e.clientY - 20) + 'px';
      play.querySelectorAll('.basket.over').forEach(x => x.classList.remove('over'));
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.basket');
      if (t) t.classList.add('over');
    });
    const end = e => {
      if (!drag) return;
      const { b, ghost } = drag;
      drag = null;
      play.querySelectorAll('.basket.over').forEach(x => x.classList.remove('over'));
      b.classList.remove('lifted');
      if (!ghost) { if (e.type === 'pointerup') { const i = +b.dataset.c; sel = sel === i ? null : i; draw(); } return; }
      ghost.remove();
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.basket');
      if (t) drop(+b.dataset.c, +t.dataset.b, b);
    };
    play.addEventListener('pointerup', end);
    play.addEventListener('pointercancel', end);
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { sortGame(root); return; }
      if (e.target.closest('[data-meanings]')) { meanings = true; draw(); return; }
      const basket = e.target.closest('.basket');
      if (basket && sel !== null) drop(sel, +basket.dataset.b);
    });
    play.addEventListener('keydown', e => {                    // keyboard: Enter on a word selects it, Enter on a basket drops it
      const c = e.target.closest('.wchip[data-c]');
      if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const i = +c.dataset.c; sel = sel === i ? null : i; draw(); play.querySelector(`[data-c="${i}"]`)?.focus(); }
    });
    draw();
  }

  window.DictGames.register({ id: 'sort', group: 'Words and meanings', order: 85, title: 'Sort into groups',
    desc: 'Drag words into baskets for two or three topics.',
    run(root, c) { ctx = c; sortGame(root); } });
})();
