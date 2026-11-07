/* Daily five: five quick questions, the same for everyone on a given day (chosen from the date), with a day streak.
   Progress and the streak are kept on this device only.
   One game of the Learn tab (see core.js). To remove it, delete this file (and daily.css) and rebuild. */
'use strict';
(() => {
  const { esc, hw, gloss, pool, finishHTML, record, speakerHTML, say, auto, autoplayHTML, focusIfKey } = window.DictGames.kit;
  let ctx;

  // a small seeded random-number generator, so everyone gets the same questions on the same day
  const seedOf = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const sshuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dayString = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const FORMATS = ['k2e', 'listen', 'e2k', 'k2e', 'listen'];

  function questions(today) {
    const r = rng(seedOf(today + ctx.lang));
    const base = pool({ audio: true, topic: '' }, true).filter(it => /^[a-z]+$/.test(hw(it)));
    const words = [], seenG = new Set(), seenW = new Set();
    for (const it of sshuffle(base, r)) {
      const g = gloss(it).toLowerCase();
      if (seenG.has(g) || seenW.has(hw(it))) continue;
      seenG.add(g); seenW.add(hw(it)); words.push(it);
      if (words.length === FORMATS.length) break;
    }
    return words.map((it, i) => {
      const others = [], g = new Set([gloss(it).toLowerCase()]), w = new Set([hw(it)]);
      for (const x of sshuffle(base, r)) {
        if (g.has(gloss(x).toLowerCase()) || w.has(hw(x))) continue;
        g.add(gloss(x).toLowerCase()); w.add(hw(x)); others.push(x);
        if (others.length === 3) break;
      }
      return { it, format: FORMATS[i], opts: sshuffle([it].concat(others), r) };
    });
  }

  function daily(root) {
    const now = new Date(), today = dayString(now);
    const yesterday = dayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const L = esc(ctx.lang);
    const read = (k, d) => { try { return JSON.parse(ctx.store.get(k, '')) || d; } catch (e) { return d; } };
    let state = read('daily', {});
    if (state.date !== today) state = { date: today, answers: [] };
    const streak = read('dailyStreak', { last: '', n: 0 });
    const shownStreak = streak.last === today || streak.last === yesterday ? streak.n : 0;
    const qs = questions(today);
    const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    root.innerHTML = `<h2 class="gtitle">Daily five</h2><p class="gintro">Five quick questions for ${esc(dateLabel)}. ` +
      `Everyone gets the same five ${L} words today; come back tomorrow for five more.</p>` +
      `<p class="dl-streak">Day streak: <strong>${shownStreak}</strong></p><div class="game-bar">${autoplayHTML()}</div><div class="gplay"></div>`;
    root.querySelector('[data-g="autoplay"]').addEventListener('change', e => ctx.store.set('g.autoplay', e.target.checked ? '1' : '0'));
    const play = root.querySelector('.gplay');
    if (qs.length < FORMATS.length) { play.innerHTML = '<p class="empty">Not enough words with recordings for the daily questions.</p>'; return; }
    const save = () => ctx.store.set('daily', JSON.stringify(state));

    function finish() {
      const score = state.answers.filter(Boolean).length;
      if (streak.last !== today) {
        streak.n = streak.last === yesterday ? streak.n + 1 : 1;
        streak.last = today;
        ctx.store.set('dailyStreak', JSON.stringify(streak));
      }
      root.querySelector('.dl-streak strong').textContent = streak.n;
      play.innerHTML = finishHTML(`You got ${score} of ${qs.length} today. Day streak: ${streak.n}. Come back tomorrow for five new words.`, qs.map(q => q.it))
        .replace('<button type="button" class="gbtn primary" data-again>Play again</button>', '');
    }
    function ask() {
      const k = state.answers.length;
      if (k >= qs.length) { finish(); return; }
      const { it, format, opts } = qs[k];
      const prompt = format === 'k2e' ? `What does <strong class="v">${esc(hw(it))}</strong> mean?`
        : format === 'e2k' ? `Which word means <strong>‘${esc(gloss(it))}’</strong>?` : 'Which word do you hear?';
      play.innerHTML = `<p class="gstat">Question ${k + 1} of ${qs.length}</p>` +
        `<div class="dl-q">${format === 'listen' ? speakerHTML(it.c.audio, 'big us-play', 'Play the word') : ''}<p class="dl-prompt">${prompt}</p></div>` +
        '<div class="dl-opts">' + opts.map(o => `<div class="lcell"><button type="button" class="lopt${format === 'k2e' ? '' : ' v'}" data-id="${esc(o.id)}">` +
          `${esc(format === 'k2e' ? gloss(o) : hw(o))}</button><div class="lmore"></div></div>`).join('') + '</div><div class="gnext"></div>';
      if (format === 'listen') auto(it.c.audio);
    }
    play.addEventListener('click', e => {
      if (e.target.closest('[data-next]')) { ask(); return; }
      const b = e.target.closest('.lopt');
      if (!b || play.querySelector('.lopt.right')) return;
      const k = state.answers.length, { it, format, opts } = qs[k], right = b.dataset.id === it.id;
      state.answers.push(right); save();
      record(it, right);
      b.classList.add(right ? 'right' : 'wrong');
      play.querySelectorAll('.lopt').forEach(x => { x.disabled = true; if (x.dataset.id === it.id) x.classList.add('right'); });
      play.querySelectorAll('.lcell').forEach((cell, i) => {
        const o = opts[i];
        cell.querySelector('.lmore').innerHTML = `<span class="${format === 'k2e' ? 'v' : ''}">${esc(format === 'k2e' ? hw(o) : gloss(o))}</span>` + (o.c.audio ? speakerHTML(o.c.audio, '', `Listen to ${hw(o)}`) : '');
      });
      auto(it.c.audio);
      say(right ? `Right: ${hw(it)}, ${gloss(it)}.` : `Not right. It was ${hw(it)}, ${gloss(it)}.`);
      play.querySelector('.gnext').innerHTML = `<button type="button" class="gbtn primary" data-next>${k + 1 < qs.length ? 'Next' : 'See today\'s score'}</button>`;
      focusIfKey(play.querySelector('[data-next]'));
    });
    ask();
  }

  window.DictGames.register({ id: 'daily', group: 'Every day', order: 1, title: 'Daily five',
    desc: 'Five quick questions, the same for everyone each day. Keep a streak going.',
    run(root, c) { ctx = c; daily(root); } });
})();
