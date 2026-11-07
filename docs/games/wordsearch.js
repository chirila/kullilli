/* Word search: find words from a topic hidden in a grid of the language's letters (ng, dh … fill one cell).
   One game of the Learn tab (see core.js). To remove it, delete this file (and wordsearch.css) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, letterKit, record, say, sr, auto } = window.DictGames.kit;
  let ctx;
  const SIZE = 8, WORDS = 6;
  const DIRS = [[0, 1], [1, 0], [1, 1]];              // across, down, diagonal

  function wordsearch(root) {
    const s = settings();
    const clue = ctx.store.get('g.wsclue', 'k') === 'e' ? 'e' : 'k';
    const L = esc(ctx.lang);
    const { units, tok, plain } = letterKit();
    root.innerHTML = '<h2 class="gtitle">Word search</h2><p class="gintro">' +
      `Find the ${clue === 'k' ? `${L} words in the list` : `${L} words for the English meanings in the list`} hidden in the grid. ` +
      'They run across, down or diagonally. Drag across a word, or tap its first and last letters (with a keyboard, move with the arrow keys and press Enter on the first and last letters).</p>' +
      barHTML(s, false, { extra: segHTML('wsclue', 'Clues', clue, [['k', `Clues: ${L} words`], ['e', 'Clues: English meanings']]) }) +
      '<div class="gplay"></div>';
    wireBar(root, () => wordsearch(root));
    const play = root.querySelector('.gplay');
    const fitsGrid = it => { const w = plain(it); if (!/^[a-z]+$/.test(w)) return false; const t = tok(w); return t.length >= 3 && t.length <= SIZE && t.every(u => units.has(u)); };
    const cand = pick(pool(s).filter(fitsGrid), 20);
    if (cand.length < 4) { play.innerHTML = tooFew(cand.length); return; }

    // place words, longest first; letters may be shared where they agree
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const placed = [];
    for (const it of cand.sort((a, b) => tok(plain(b)).length - tok(plain(a)).length)) {
      if (placed.length === WORDS) break;
      const t = tok(plain(it));
      const spots = [];
      for (const [dr, dc] of DIRS) for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const er = r + dr * (t.length - 1), ec = c + dc * (t.length - 1);
        if (er >= SIZE || ec >= SIZE) continue;
        if (t.every((u, k) => { const x = grid[r + dr * k][c + dc * k]; return x === null || x === u; })) spots.push([r, c, dr, dc]);
      }
      if (!spots.length) continue;
      const [r, c, dr, dc] = spots[Math.floor(Math.random() * spots.length)];
      const cells = t.map((u, k) => { grid[r + dr * k][c + dc * k] = u; return [r + dr * k, c + dc * k]; });
      placed.push({ it, t, cells, found: false });
    }
    if (placed.length < 4) { play.innerHTML = tooFew(placed.length); return; }
    // fill the rest with letters in the proportions they have in the dictionary
    const bag = ctx.items.flatMap(it => (/^[a-z]+$/.test(plain(it)) ? tok(plain(it)).filter(u => units.has(u)) : []));
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === null) grid[r][c] = bag[Math.floor(Math.random() * bag.length)];
    placed.sort((a, b) => plain(a.it).localeCompare(plain(b.it)));

    let start = null, path = [], shown = false;
    const key = (r, c) => `${r},${c}`;
    function draw() {
      const foundCells = new Map();
      placed.forEach((p, i) => { if (p.found) p.cells.forEach(([r, c]) => foundCells.set(key(r, c), i % 6)); });
      const onPath = new Set(path.map(([r, c]) => key(r, c)));
      const left = placed.filter(p => !p.found).length;
      const isStart = (r, c) => start && start[0] === r && start[1] === c;
      play.innerHTML = `<p class="gstat">Found ${placed.length - left} of ${placed.length}</p>` +
        `<div class="ws-wrap"><div class="ws-grid" style="--n:${SIZE}" role="group" aria-label="Letter grid, ${SIZE} rows of ${SIZE}. Arrow keys move between letters.">` +
        grid.map((row, r) => row.map((u, c) =>
          `<button type="button" class="ws-cell${foundCells.has(key(r, c)) ? ' f' + foundCells.get(key(r, c)) : ''}${onPath.has(key(r, c)) ? ' sel' : ''}` +
          `${isStart(r, c) ? ' start' : ''}" data-r="${r}" data-c="${c}" aria-label="${esc(u)}, row ${r + 1}, column ${c + 1}` +
          `${foundCells.has(key(r, c)) ? ', in a found word' : ''}${isStart(r, c) ? ', chosen as the first letter' : ''}">${esc(u)}</button>`).join('')).join('') + '</div>' +
        '<ul class="ws-list" aria-label="Words to find">' + placed.map((p, i) => `<li class="${p.found ? 'got f' + (i % 6) : ''}">${p.found ? sr('Found: ') : ''}` +
          `${clue === 'k' || p.found ? `<span class="v">${esc(plain(p.it))}</span>` : ''}${clue === 'e' || p.found ? `${p.found ? sr(', ') : ''}<span class="tr">${esc(gloss(p.it))}</span>` : ''}</li>`).join('') + '</ul></div>' +
        `<div class="hd-tools">${left && !shown ? '<button type="button" class="gbtn" data-reveal>Show the words</button>' : ''}</div>`;
    }
    const line = (a, b) => {                                // cells from a to b if they are in a straight line
      const dr = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]), n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      if ((dr && dc && Math.abs(b[0] - a[0]) !== Math.abs(b[1] - a[1]))) return [a];
      return Array.from({ length: n + 1 }, (_, k) => [a[0] + dr * k, a[1] + dc * k]);
    };
    function choose(cells) {
      const ks = cells.map(([r, c]) => key(r, c)).join('|');
      const p = placed.find(x => !x.found && (x.cells.map(([r, c]) => key(r, c)).join('|') === ks || [...x.cells].reverse().map(([r, c]) => key(r, c)).join('|') === ks));
      if (p) {
        p.found = true;
        if (!shown) record(p.it, true);
        auto(p.it.c.audio);
        say(`Found ${plain(p.it)}, ${gloss(p.it)}.`);
      } else {
        say(`No word there: ${cells.map(([r, c]) => grid[r][c]).join(', ')}.`);
      }
      start = null; path = [];
      if (placed.every(x => x.found) && !shown) { draw(); setTimeout(() => { play.innerHTML = finishHTML(`You found all ${placed.length} words!`, placed.map(x => x.it)); }, 900); return; }
      draw();
    }

    // drag across cells, or tap the first and then the last cell
    let down = null, dragged = 0;
    const cellAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); const b = el && el.closest('.ws-cell'); return b ? [+b.dataset.r, +b.dataset.c] : null; };
    play.addEventListener('pointerdown', e => {
      const b = e.target.closest('.ws-cell'); if (!b) return;
      down = { at: [+b.dataset.r, +b.dataset.c], moved: false };
      try { b.releasePointerCapture(e.pointerId); } catch (err) { /* lets pointermove reach other cells */ }
    });
    play.addEventListener('pointermove', e => {
      if (!down) return;
      const at = cellAt(e);
      if (!at || (at[0] === down.at[0] && at[1] === down.at[1] && !down.moved)) return;
      down.moved = true;
      path = line(down.at, at);
      draw();
    });
    const up = e => {
      if (!down) return;
      const d = down; down = null;
      if (d.moved) { const at = cellAt(e) || path[path.length - 1] || d.at; dragged = Date.now(); choose(line(d.at, at)); }
      // a tap without moving: the click that follows chooses the letter
    };
    play.addEventListener('pointerup', up);
    play.addEventListener('pointercancel', () => { down = null; });
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { wordsearch(root); return; }
      const cell = e.target.closest('.ws-cell');
      if (cell) {                                     // tap, click, Enter/Space or a screen reader: first letter, then last
        if (Date.now() - dragged < 300) return;
        const at = [+cell.dataset.r, +cell.dataset.c];
        if (!start) { start = at; path = [at]; draw(); say(`First letter: ${grid[at[0]][at[1]]}, row ${at[0] + 1}, column ${at[1] + 1}. Now choose the last letter of the word.`); return; }
        choose(line(start, at));
        return;
      }
      if (e.target.closest('[data-reveal]')) {
        shown = true;
        placed.forEach(p => { if (!p.found) { p.found = true; record(p.it, false); } });
        start = null; path = [];
        draw();
        say('The words are: ' + placed.map(p => `${plain(p.it)}, ${gloss(p.it)}`).join('; ') + '.');
        play.insertAdjacentHTML('beforeend', `<div class="gnext"><button type="button" class="gbtn primary" data-again>New word search</button></div>`);
      }
    });
    play.addEventListener('keydown', e => {           // arrow keys move between letters
      const cell = e.target.closest('.ws-cell');
      const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!cell || !step) return;
      e.preventDefault();
      const r = Math.min(SIZE - 1, Math.max(0, +cell.dataset.r + step[0])), c = Math.min(SIZE - 1, Math.max(0, +cell.dataset.c + step[1]));
      play.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`)?.focus();
    });
    draw();
  }

  window.DictGames.register({ id: 'wordsearch', group: 'Words and meanings', order: 90, title: 'Word search', needs: 'keyboard',
    desc: 'Find words from a topic hidden in a grid of Kullilli letters.',
    run(root, c) { ctx = c; wordsearch(root); } });
})();
