/* Kullilli lessons: contents, lesson pages and "Save for later".
   The lesson texts come from lessons-data.js (window.LESSONS), written by build/build_lessons.py.
   Saved lessons are kept in this browser only, under Kullilli.lessons (a list of lesson ids), so the
   dictionary's backup on the My lists page includes them. */
(function () {
  'use strict';
  const DATA = window.LESSONS;
  const KEY = 'Kullilli.lessons';
  const main = document.getElementById('main');

  const all = [];
  DATA.units.forEach(u => u.lessons.forEach(l => { l.unit = u; all.push(l); }));
  const byId = Object.fromEntries(all.map(l => [l.id, l]));

  // ---------- saved lessons ----------
  const saved = {
    list() {
      try { return (JSON.parse(localStorage.getItem(KEY)) || []).filter(id => byId[id]); }
      catch (e) { return []; }
    },
    has(id) { return saved.list().includes(id); },
    toggle(id) {
      const s = saved.list(), i = s.indexOf(id);
      if (i < 0) s.push(id); else s.splice(i, 1);
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
      return i < 0;
    },
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plain = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };

  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';
  function saveBtn(l, withText) {
    const on = saved.has(l.id);
    return `<button type="button" class="save${withText ? ' big' : ''}" data-save="${esc(l.id)}" aria-pressed="${on}"`
      + (withText ? '' : ` aria-label="Save for later: ${esc(plain(l.title))}" title="Save for later"`)
      + `>${ICON}${withText ? '<span class="off">Save for later</span><span class="on">Saved for later</span>' : ''}</button>`;
  }

  // screen-reader announcement (e.g. "Saved for later")
  const live = document.createElement('div');
  live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);
  const say = msg => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 50); };

  // ---------- pages ----------
  function lessonRow(l) {
    return `<li><a href="#/${esc(l.id)}"><span class="ln">${l.n}</span> <span class="lt">${l.title}</span></a>${saveBtn(l)}</li>`;
  }

  function contents() {
    const n = saved.list().length;
    return `<section class="intro">
      <h1 tabindex="-1">Kullilli lessons</h1>
      <p>${all.length} short lessons from the <em>Kullilli Sketch Grammar</em>. Each one has a short explanation,
        examples, and questions to check yourself. Press the bookmark button
        <span class="save inline" aria-hidden="true">${ICON}</span> to save a lesson for later.</p>
      <p><a class="pill" href="#/saved">Saved for later <span class="count">${n}</span></a></p>
    </section>
    <ol class="units">${DATA.units.map(u => `
      <li class="unit">
        <h2><span class="un">Unit ${u.n}</span> ${esc(u.title)}</h2>
        <ol class="lessons">${u.lessons.map(lessonRow).join('')}</ol>
      </li>`).join('')}
    </ol>`;
  }

  function savedPage() {
    const list = saved.list().map(id => byId[id]).sort((a, b) => all.indexOf(a) - all.indexOf(b));
    return `<section class="intro">
      <h1 tabindex="-1">Saved for later</h1>
      ${list.length
        ? `<p>${list.length === 1 ? 'One lesson' : list.length + ' lessons'} saved on this device. Press the bookmark button again to take a lesson off the list.</p>`
        : `<p>No saved lessons yet. Open a lesson and press <strong>Save for later</strong>, or press the bookmark button
           <span class="save inline" aria-hidden="true">${ICON}</span> next to a lesson in the <a href="#/">list of lessons</a>.</p>`}
    </section>
    ${list.length ? `<ol class="lessons saved-list">${list.map(l => lessonRow(l).replace('</a>', `<span class="lu">Unit ${l.unit.n}: ${esc(l.unit.title)}</span></a>`)).join('')}</ol>` : ''}
    <p class="muted small">Saved lessons are kept in this browser only. The Kullilli Dictionary's
      <a href="../#/mylist">My lists</a> page can save a backup file of everything you have kept on this device, including these.</p>`;
  }

  function lessonPage(l) {
    const i = all.indexOf(l), prev = all[i - 1], next = all[i + 1];
    const link = (x, rel, label) => x
      ? `<a rel="${rel}" href="#/${esc(x.id)}"><span class="dir">${label}</span><span class="ln">${x.n}</span> ${x.title}</a>`
      : '<span></span>';
    return `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">All lessons</a> › Unit ${l.unit.n}: ${esc(l.unit.title)}</nav>
    <article class="lesson">
      <header class="lesson-head">
        <p class="kicker">Lesson ${l.n}</p>
        <h1 tabindex="-1">${l.title}</h1>
        ${saveBtn(l, true)}
      </header>
      <div class="lesson-body">${l.html}</div>
      ${l.qa.length ? `<section class="review" aria-labelledby="review-h">
        <h2 id="review-h">Check yourself</h2>
        <ol class="qa">${l.qa.map(([q, a]) => `<li><p class="q">${q}</p>
          <details><summary>Show answer</summary><p class="a">${a}</p></details></li>`).join('')}</ol>
      </section>` : ''}
      ${l.grammar ? `<p class="from">From the sketch grammar: ${l.grammar}</p>` : ''}
    </article>
    <nav class="pager" aria-label="Next and previous lessons">${link(prev, 'prev', 'Previous')}${link(next, 'next', 'Next')}</nav>`;
  }

  function notFound() {
    return `<section class="intro"><h1 tabindex="-1">Lesson not found</h1>
      <p>This lesson may have been renamed. <a href="#/">See all lessons</a>.</p></section>`;
  }

  // ---------- routing ----------
  let first = true;
  function route() {
    const path = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    let tab = 'all', title = DATA.title;
    if (!path) main.innerHTML = contents();
    else if (path === 'saved') { main.innerHTML = savedPage(); tab = 'saved'; title = 'Saved for later · ' + DATA.title; }
    else if (byId[path]) { main.innerHTML = lessonPage(byId[path]); title = plain(byId[path].title) + ' · ' + DATA.title; }
    else main.innerHTML = notFound();
    document.title = title;
    document.querySelectorAll('.tabs [data-tab]').forEach(a => {
      const on = a.dataset.tab === tab;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (!first) {
      window.scrollTo(0, 0);
      const h = main.querySelector('h1');
      if (h) h.focus({ preventScroll: true });
    }
    first = false;
  }

  main.addEventListener('click', e => {
    const b = e.target.closest('[data-save]');
    if (!b) return;
    e.preventDefault();
    const on = saved.toggle(b.dataset.save);
    document.querySelectorAll(`[data-save="${CSS.escape(b.dataset.save)}"]`).forEach(x => x.setAttribute('aria-pressed', on));
    const count = main.querySelector('.count');
    if (count) count.textContent = saved.list().length;
    say(on ? 'Saved for later' : 'Removed from saved lessons');
  });

  document.getElementById('credit').textContent = DATA.credit;
  window.addEventListener('hashchange', route);
  route();
})();
