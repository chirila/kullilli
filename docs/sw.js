/* Offline support.  The site itself (pages, scripts, styles, dictionary data, icons) is saved when the site is
   first opened, and replaced as a whole when a new version is published.  Recordings are saved as they are played
   (or all at once from the About page) in a separate store that survives updates.
   The list below is written by build/build_lift.py: don't edit it by hand. */
'use strict';
// <assets>
const VERSION = 'a2ba7fd543';
const UPDATED = '2026-11-07';
const ASSETS = [
 "./",
 "manifest.webmanifest",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "style.css?v=4b26b4a6",
 "games/games.css?v=28d08a2d",
 "games/circle.css?v=57fc8708",
 "games/daily.css?v=10ea7dfc",
 "games/flashcards.css?v=02fd027e",
 "games/listen.css?v=2eac986f",
 "games/match.css?v=079ea437",
 "games/memory.css?v=3614d08d",
 "games/odd.css?v=63149542",
 "games/same.css?v=74feeec9",
 "games/sort.css?v=082132d3",
 "games/unscramble.css?v=dfb878ef",
 "games/wordsearch.css?v=94767a94",
 "data/dictionary.js?v=cd068d68",
 "search.js?v=7fc450b3",
 "render.js?v=fe2aab89",
 "games/core.js?v=b3482ac1",
 "games/circle.js?v=6df7b98c",
 "games/daily.js?v=6bc87705",
 "games/flashcards.js?v=a8e2e2ef",
 "games/hidden.js?v=e83f87bf",
 "games/letters.js?v=93d3b2aa",
 "games/listen.js?v=92cfb9e1",
 "games/match.js?v=8c691ec1",
 "games/memory.js?v=e519f82d",
 "games/odd.js?v=a835c50e",
 "games/same.js?v=74f6b011",
 "games/sort.js?v=23651f6b",
 "games/spell.js?v=75562ba2",
 "games/unscramble.js?v=769897e6",
 "games/wordsearch.js?v=0dd3cb0b",
 "app.js?v=fc820877",
 "icons/icon-512.png"
];
// </assets>
const SITE = 'site-' + VERSION, AUDIO = 'recordings';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SITE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('site-') && k !== SITE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/audio/')) { e.respondWith(recording(req)); return; }
  if (req.mode === 'navigate') {                         // the page: newest when online, saved copy when not
    e.respondWith(fetch(req).catch(() => caches.match('./', { cacheName: SITE })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));   // scripts, styles, data: saved copy first
});

// recordings: from the store if saved, else from the network (and then saved).  Browsers ask for parts of a
// sound file ("Range"); Safari won't play one without that, so parts are cut from the saved file here.
async function recording(req) {
  const cache = await caches.open(AUDIO);
  let res = await cache.match(req.url, { ignoreSearch: true });
  if (!res) {
    try { res = await fetch(req.url); } catch (err) { return new Response('', { status: 504 }); }
    if (!res.ok) return res;
    await cache.put(req.url, res.clone());
  }
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!range) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
  let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : size - 1;
  start = Math.max(0, start); end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/wav', 'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } });
}
