/* Spell it: hear a word and type it on the language's own keyboard; each letter is marked right or wrong.
   One game of the Learn tab (see core.js). To remove it, delete this file and rebuild. */
'use strict';
(() => {
  const { esc, gloss, pool, pick, settings, barHTML, wireBar, tooFew, finishHTML, letterKit, record, speakerHTML } = window.DictGames.kit;
  let ctx;

  function spell(root) {
    const s = Object.assign(settings(), { audio: true });              // you hear the word, so it needs a recording
    const L = esc(ctx.lang);
    const { units, tok, plain, fits, keysHTML } = letterKit();
    root.innerHTML = '<h2 class="gtitle">Spell it</h2><p class="gintro">' +
      `Listen to the ${L} word and type it with the keyboard below (or your computer's keyboard: n then g makes ng). ` +
      'Press Check to see which letters are right.</p>' + barHTML(s, false, { audio: false }) + '<div class="gplay"></div>';
    wireBar(root, () => spell(root));
    const play = root.querySelector('.gplay');
    const words = pick(pool(s).filter(fits), 8);
    if (words.length < 3) { play.innerHTML = tooFew(words.length); return; }
    let q = 0, firstTry = 0, cur, marks, tries, done, hint;

    function ask() { cur = []; marks = null; tries = 0; done = ''; hint = false; draw(); ctx.playFile(words[q].c.audio); }
    function draw() {
      const it = words[q], n = tok(plain(it)).length;
      const boxes = Array.from({ length: n }, (_, i) => {
        const u = done === 'shown' ? tok(plain(it))[i] : (cur[i] || '');
        const st = done === 'right' ? 'hit' : marks && !done ? (marks[i] ? 'hit' : 'miss') : (u ? 'typed' : '');
        return `<span class="ht ${st}">${esc(u)}</span>`;
      }).join('');
      play.innerHTML = `<p class="gstat" aria-live="polite">Word ${q + 1} of ${words.length} · ${n} letters</p>` +
        `<div class="us-clue">${speakerHTML(it.c.audio, 'big us-play')}</div>` +
        `<div class="hd-board"><div class="hd-row"><div class="hd-tiles">${boxes}</div></div></div>` +
        (done
          ? (done === 'shown' ? `<p class="us-note">The word is <strong class="v">${esc(plain(it))}</strong> ‘${esc(gloss(it))}’.</p>`
            : `<p class="us-note">Right: <strong class="v">${esc(plain(it))}</strong> ‘${esc(gloss(it))}’.</p>`) +
            `<div class="gnext"><button type="button" class="gbtn primary" data-next>${q + 1 < words.length ? 'Next word' : 'See your score'}</button></div>`
          : '<div class="hd-tools">' + `<button type="button" class="gbtn" data-hint${hint ? ' disabled' : ''}>${hint ? 'Meaning: ' + esc(gloss(it)) : 'Show the meaning'}</button>` +
            (tries ? '<button type="button" class="gbtn" data-show>Show me</button>' : '') + '</div>' +
            keysHTML({}, '<button type="button" class="hk wide" data-k="back" aria-label="Delete letter">⌫</button>' +
              '<button type="button" class="hk wide enter" data-k="check">Check</button>'));
    }
    const add = u => { if (done) return; const n = tok(plain(words[q])).length, next = tok(cur.join('') + u);
      if (next.length <= n && next.every(x => units.has(x))) { cur = next; marks = null; draw(); } };
    const back = () => { if (!done && cur.length) { cur = cur.slice(0, -1); marks = null; draw(); } };
    function check() {
      if (done) return;
      const it = words[q], target = tok(plain(it));
      if (cur.length < target.length) return;
      marks = target.map((u, i) => cur[i] === u);
      if (marks.every(Boolean)) {
        if (!tries) firstTry++;
        record(it, !tries);
        done = 'right';
        ctx.playFile(it.c.audio);
      } else {
        tries++;
      }
      draw();
    }
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { spell(root); return; }
      if (e.target.closest('[data-next]')) { q++; if (q < words.length) ask(); else play.innerHTML = finishHTML(`You spelled ${firstTry} of ${words.length} at the first try.`, words); return; }
      if (e.target.closest('[data-hint]')) { hint = true; draw(); return; }
      if (e.target.closest('[data-show]')) { record(words[q], false); done = 'shown'; draw(); ctx.playFile(words[q].c.audio); return; }
      const k = e.target.closest('[data-k]');
      if (k) { const v = k.dataset.k; if (v === 'back') back(); else if (v === 'check') check(); else add(v); }
    });
    const onKey = e => {
      if (!play.isConnected) { document.removeEventListener('keydown', onKey); return; }
      const ae = document.activeElement;
      if ((ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) || !document.getElementById('overlay').hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); if (done) play.querySelector('[data-next]')?.click(); else check(); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
      else if (/^[a-z]$/i.test(e.key)) add(e.key.toLowerCase());
    };
    document.addEventListener('keydown', onKey);
    ask();
  }

  window.DictGames.register({ id: 'spell', group: 'Spelling', order: 55, title: 'Spell it', needs: 'keyboard',
    desc: 'Hear a word and type it on the Kullilli keyboard; each letter is marked right or wrong.',
    run(root, c) { ctx = c; spell(root); } });
})();
