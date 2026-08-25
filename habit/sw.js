/* foqs.habit service worker
   Served from /habit/ on GitHub Pages. Scope is /habit/ only.
   Cache name is unique so it never collides with the Ura+ app on the same origin. */
const CACHE = 'foqs-habit-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  /* Only handle our own origin. Google Fonts, the Supabase CDN and all API
     calls go straight to the network, untouched and uncached. */
  if (url.origin !== self.location.origin) return;

  /* Only handle files inside our own /habit/ scope, so we never interfere
     with the rest of foqs.si (including /uraplus). */
  const scope = new URL('./', self.location.href).pathname;
  if (!url.pathname.startsWith(scope)) return;

  /* The page itself must never come from the browser's HTTP cache, otherwise
     a deploy can take up to 10 minutes to show up. Assets may use it. */
  const isPage = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');

  const netReq = isPage ? new Request(req.url, { cache: 'no-store' }) : req;

  /* Network first, fall back to cache when offline. */
  e.respondWith(
    fetch(netReq)
      .then(r => {
        if (r && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return r;
      })
      .catch(() =>
        caches.match(req).then(m =>
          m || (req.mode === 'navigate' ? caches.match('./') : undefined)
        )
      )
  );
});
