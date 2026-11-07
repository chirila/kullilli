/* Hidden word: Guess a word in six tries, letter by letter.
   One game of the Learn tab (see core.js). To remove it, delete this file (and hidden.css if there is one) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, letterKit, listenBtn, record, practise, say, sr, auto } = window.DictGames.kit;
  let ctx;

  // ---- hidden word: guess a word in six tries, letter by letter ---------------------------
  function hidden(root) {
    const s = settings();
    const L = esc(ctx.lang);
    const { units, tok, plain, fits, keysHTML } = letterKit();
    root.innerHTML = '<h2 class="gtitle">Hidden word</h2><p class="gintro">' +
      `Guess the hidden ${L} word in six tries. After each guess, the tiles show which letters are in the right place, ` +
      'which are in the word but somewhere else, and which are not in it. Letters like <span class="v">ng</span> and ' +
      '<span class="v">dh</span> count as one letter.</p>' + barHTML(s, false) + '<div class="gplay"></div>';
    wireBar(root, () => hidden(root));
    const play = root.querySelector('.gplay');
    const answers = pool(s).filter(fits);
    if (!answers.length) { play.innerHTML = tooFew(0); return; }
    const it = answers[Math.floor(Math.random() * answers.length)];
    const target = tok(plain(it)), n = target.length, TRIES = 6;
    const meaning = new Map();                       // guesses that are real words show their meaning
    ctx.items.forEach(x => { const g = (x.c.senses || []).flatMap(z => z.gl || [])[0]; const w = (x.c.lc || x.c.hw).toLowerCase(); if (g && !meaning.has(w)) meaning.set(w, g); });
    const RANK = { miss: 1, near: 2, hit: 3 };
    const SAY = { hit: 'right place', near: 'in the word, somewhere else', miss: 'not in the word' };
    let guesses = [], cur = [], over = '', hint = false, note = '';
    const keyState = {};

    function score(g) {
      const res = Array(n).fill('miss'), left = {};
      target.forEach((u, i) => { if (g[i] === u) res[i] = 'hit'; else left[u] = (left[u] || 0) + 1; });
      g.forEach((u, i) => { if (res[i] !== 'hit' && left[u]) { res[i] = 'near'; left[u]--; } });
      return res;
    }
    function draw() {
      const board = Array.from({ length: TRIES }, (_, r) => {
        const g = guesses[r], letters = g ? g.units : (r === guesses.length && !over ? cur : []);
        const real = g && meaning.get(g.units.join(''));
        const now = r === guesses.length && !over;
        const rowLabel = g ? ` role="group" aria-label="Guess ${r + 1}"` : now ? ' role="group" aria-label="Your guess"' : ' aria-hidden="true"';
        return `<div class="hd-row${now ? ' now' : ''}"${rowLabel}><div class="hd-tiles">` +
          Array.from({ length: n }, (_, i) => {
            const u = letters[i] || '', st = g ? g.res[i] : (u ? 'typed' : '');
            return `<span class="ht ${st}">${esc(u)}${g ? sr(`, ${SAY[st]}`) : ''}</span>`;
          }).join('') + '</div>' + (real ? `<span class="hd-real">‘${esc(real)}’</span>` : '') + '</div>';
      }).join('');
      const keys = keysHTML(keyState, '<button type="button" class="hk wide" data-k="back" aria-label="Delete letter">⌫</button>' +
        '<button type="button" class="hk wide enter" data-k="enter">Enter</button>');
      const end = over ? `<div class="gdone"><p class="gdone-msg">${over === 'won'
        ? `You found it in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}!` : 'Out of tries. The word was:'}</p>` +
        '<button type="button" class="gbtn primary" data-again>New word</button></div>' +
        `<div class="grid hd-answer">${ctx.R.cardHTML(it)}</div>` : '';
      play.innerHTML = `<p class="gstat">${note || `${n} letters · guess ${Math.min(guesses.length + 1, TRIES)} of ${TRIES}`}</p>` +
        `<div class="hd-board">${board}</div>` + (over ? end :
        `<div class="hd-tools"><button type="button" class="gbtn" data-hint${hint ? ' disabled' : ''}>` +
        `${hint ? 'Meaning: ' + esc(gloss(it)) : 'Show the meaning'}</button></div>` + keys);
      note = '';
    }
    function add(u) {
      if (over) return;
      const next = tok(cur.join('') + u);             // n then g makes ng, d then h makes dh
      if (next.length <= n && next.every(x => units.has(x))) { cur = next; draw(); say(cur.join(', '), 'typed'); }
    }
    function back() { if (!over && cur.length) { cur = cur.slice(0, -1); draw(); say(cur.length ? cur.join(', ') : 'Empty', 'typed'); } }
    function enter() {
      if (over) return;
      if (cur.length < n) { note = `The word has ${n} letters.`; draw(); return; }
      const res = score(cur);
      guesses.push({ units: cur, res });
      cur.forEach((u, i) => { if (!keyState[u] || RANK[res[i]] > RANK[keyState[u]]) keyState[u] = res[i]; });
      cur = [];
      if (res.every(x => x === 'hit')) over = 'won';
      else if (guesses.length === TRIES) over = 'lost';
      if (over) { record(it, over === 'won'); practise([it]); auto(it.c.audio); ctx.setList([it.id]); }
      draw();
      const g = guesses[guesses.length - 1];
      say(`Guess ${guesses.length}: ` + g.units.map((u, i) => `${u}, ${SAY[g.res[i]]}`).join('; ') + '.' +
        (over === 'won' ? ` You found it: ${plain(it)}, ${gloss(it)}.` : over === 'lost' ? ` Out of tries. The word was ${plain(it)}, ${gloss(it)}.` : ''), 'typed');
    }
    play.addEventListener('click', e => {
      const k = e.target.closest('[data-k]');
      if (k) { const v = k.dataset.k; if (v === 'back') back(); else if (v === 'enter') enter(); else add(v); return; }
      if (e.target.closest('[data-hint]')) { hint = true; draw(); say(`Meaning: ${gloss(it)}.`); return; }
      if (e.target.closest('[data-again]')) hidden(root);
    });
    const onKey = e => {                                  // typing on a computer keyboard
      if (!play.isConnected) { document.removeEventListener('keydown', onKey); return; }
      const ae = document.activeElement;
      if ((ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) || !document.getElementById('overlay').hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('button, a, select, input')) return;   // Enter on a focused key types that key
      if (e.key === 'Enter') { e.preventDefault(); enter(); } else if (e.key === 'Backspace') { e.preventDefault(); back(); } else if (/^[a-z]$/i.test(e.key)) add(e.key.toLowerCase());
    };
    document.addEventListener('keydown', onKey);
    draw();
  }

  window.DictGames.register({ id: 'hidden', group: 'Spelling', order: 70, title: 'Hidden word', desc: 'Guess a word in six tries, letter by letter.', needs: 'keyboard', run(root, c) { ctx = c; hidden(root); } });
})();
