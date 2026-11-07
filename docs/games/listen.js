/* Listen and choose: Hear a word and pick it out from four, by its spelling or its meaning. Easy, or harder with words that sound alike.
   One game of the Learn tab (see core.js). To remove it, delete this file (and listen.css if there is one) and rebuild. */
'use strict';
(() => {
  const { esc, shuffle, hw, gloss, pool, pick, settings, segHTML, barHTML, wireBar, tooFew, finishHTML, letterKit, listenBtn, record } = window.DictGames.kit;
  let ctx;

  // ---- listen and choose: hear a word, pick it (or its meaning) from four ----------------------
  // The word heard has a recording and comes from the chosen topic; the other three come from anywhere in the
  // dictionary. Easy: words that look and sound very different. Harder: words one or two letters away
  // (minimal and near-minimal pairs), counting letters the language's way (ng, dh … are one letter).
  function listen(root) {
    const s = settings();
    const L = esc(ctx.lang);
    const tok = ctx.keyboard && ctx.keyboard.length ? letterKit().tok : w => [...w];
    const byMeaning = s.answer === 'meaning', hard = s.level === 'hard';
    const sAudio = Object.assign({}, s, { audio: true });          // the word you hear always has a recording
    root.innerHTML = '<h2 class="gtitle">Listen and choose</h2><p class="gintro">' +
      (byMeaning ? `Listen to the ${L} word, then pick what it means.` : `Listen to the ${L} word, then pick how it's written.`) +
      (hard ? ' Harder: the other choices are words that sound alike.' : '') + ' Tap the speaker to hear it again.</p>' +
      barHTML(sAudio, false, { audio: false, extra:
        segHTML('level', 'Level', s.level, [['easy', 'Easy'], ['hard', 'Harder: sounds alike']]) +
        segHTML('answer', 'Answer with', s.answer, [['word', `${L} spelling`], ['meaning', 'English meaning']]) }) +
      '<div class="gplay"></div>';
    wireBar(root, () => listen(root));
    const play = root.querySelector('.gplay');
    const plainWord = it => /^[a-z]+$/.test(hw(it));
    const qs = pick(pool(sAudio).filter(plainWord), 10);
    if (qs.length < 4) { play.innerHTML = tooFew(qs.length); return; }
    // every ordinary written word in the dictionary can be a wrong answer
    const cands = ctx.items.filter(it => !it.parent && !it.c.see && plainWord(it) && (!byMeaning || gloss(it)));
    const units = new Map(cands.map(it => [it, tok(hw(it))]));
    const lev = (a, b) => { let p = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c.push(Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))); p = c; } return p[b.length]; };

    function others(t) {
      const tw = hw(t), tu = tok(tw), tg = gloss(t).toLowerCase();
      const same = new Set([tw].concat((t.c.va || []).flatMap(v => String(v[0]).toLowerCase().split(/\s*[,;~]\s*/)),
        (t.c.orig || []).map(x => x.toLowerCase())));
      const ok = cands.filter(x => x !== t && !same.has(hw(x))                       // not a variant spelling of the answer
        && !(x.c.see || []).some(r => r[1] === t.id) && !(t.c.see || []).some(r => r[1] === x.id)
        && !(gloss(x) && gloss(x).toLowerCase() === tg));                           // nor a word with the same meaning
      let ranked;
      if (hard) {
        ranked = shuffle(ok).map(x => ({ x, d: lev(tu, units.get(x)) })).sort((a, b) => a.d - b.d).map(r => r.x);
      } else {
        ranked = shuffle(ok.filter(x => { const u = units.get(x); return u[0] !== tu[0] && lev(tu, u) >= 3; }));
      }
      const out = [], seenW = new Set([tw]), seenG = new Set([tg]);
      for (const x of ranked) {
        const w = hw(x), g = gloss(x).toLowerCase();
        if (seenW.has(w) || (byMeaning && seenG.has(g))) continue;
        seenW.add(w); seenG.add(g); out.push(x);
        if (out.length === 3) break;
      }
      return out;
    }

    let q = 0, score = 0, opts = [];
    const speaker = (file, big) => `<button type="button" class="play${big ? ' big ls-play' : ''}" data-audio="${esc(file)}" aria-label="Listen">` +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M3 9.5v5h4l5 4v-13l-5 4H3z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg></button>';
    function ask() {
      const t = qs[q];
      opts = shuffle([t].concat(others(t)));
      play.innerHTML = `<p class="gstat" aria-live="polite">Question ${q + 1} of ${qs.length} · Score ${score}</p>` +
        `<div class="ls-q">${speaker(t.c.audio, true)}<p class="ls-prompt">${byMeaning ? 'What does it mean?' : 'Which word is it?'}</p></div>` +
        '<div class="ls-opts">' + opts.map(o => `<div class="lcell"><button type="button" class="lopt${byMeaning ? '' : ' v'}" data-id="${esc(o.id)}">` +
          `${esc(byMeaning ? gloss(o) : hw(o))}</button><div class="lmore"></div></div>`).join('') + '</div><div class="gnext"></div>';
      ctx.playFile(t.c.audio);
    }
    play.addEventListener('click', e => {
      if (e.target.closest('[data-again]')) { listen(root); return; }
      if (e.target.closest('[data-next]')) { q++; if (q < qs.length) ask(); else play.innerHTML = finishHTML(`You got ${score} out of ${qs.length}.`, qs); return; }
      const b = e.target.closest('.lopt');
      if (!b || play.querySelector('.lopt.right')) return;
      const t = qs[q], right = b.dataset.id === t.id;
      if (right) score++;
      record(t, right);
      b.classList.add(right ? 'right' : 'wrong');
      play.querySelectorAll('.lopt').forEach(x => { x.disabled = true; if (x.dataset.id === t.id) x.classList.add('right'); });
      // now show each choice's meaning (or spelling) and let the sound-alikes be heard
      play.querySelectorAll('.lcell').forEach((cell, i) => {
        const o = opts[i];
        const meaning = gloss(o) || (o.c.senses || []).flatMap(z => z.gl || [])[0] || '';    // e.g. 1sg.nom for a pronoun
        cell.querySelector('.lmore').innerHTML = `<span class="${byMeaning ? 'v' : ''}">${esc(byMeaning ? hw(o) : meaning)}</span>` +
          (o.c.audio ? speaker(o.c.audio) : '');
      });
      play.querySelector('.gstat').textContent = `Question ${q + 1} of ${qs.length} · Score ${score}`;
      play.querySelector('.gnext').innerHTML = `<button type="button" class="gbtn primary" data-next>${q + 1 < qs.length ? 'Next' : 'See your score'}</button>`;
      if (!right) ctx.playFile(t.c.audio);
    });
    ask();
  }

  window.DictGames.register({ id: 'listen', group: 'Listening', order: 40, title: 'Listen and choose', desc: 'Hear a word and pick it out from four, by its spelling or its meaning. Easy, or harder with words that sound alike.', run(root, c) { ctx = c; listen(root); } });
})();
