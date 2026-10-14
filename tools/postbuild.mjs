// After `astro build`: the service worker (every built file precached, so the app and the engine work offline;
// it also shows the daily reminder), the sitemap and robots.txt. Run by `npm run build`.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = 'dist';
const SITE = process.env.SITE_URL || 'https://shah-trajneri.pages.dev';

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(dist)
  .map((p) => '/' + relative(dist, p).split(sep).join('/'))
  .filter((u) => !u.endsWith('.map') && u !== '/sw.js' && u !== '/_headers' && u !== '/_redirects' && !u.endsWith('COPYING.txt') && u !== '/og.png');
// pages are cached by their folder URL, the way they are visited
const urls = files.map((u) => (u.endsWith('/index.html') ? u.slice(0, -'index.html'.length) : u));
const hash = createHash('sha256');
for (const u of files) hash.update(u).update(readFileSync(join(dist, u)));
const version = hash.digest('hex').slice(0, 12);

writeFileSync(
  join(dist, 'sw.js'),
  `// Shah offline: every file of this build is cached on install; pages answer from the network when it is there.
const VERSION = '${version}';
const FILES = ${JSON.stringify(urls)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // pages: fresh when online, the cached copy when not
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || caches.match('/404.html'))),
    );
    return;
  }
  // assets have hashed names: the cache first
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((r) => r || fetch(req)));
});
// the daily reminder from Shah's server; a tap opens today's puzzle (in the open app if there is one)
self.addEventListener('push', (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(m.title || 'Shah', {
      body: m.body || 'Ushtrimi i ditës të pret.',
      icon: '/icon-192.png',
      tag: m.tag || 'daily',
      lang: 'sq',
      data: { url: m.url || '/ushtrime/?tema=dita' },
    }),
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).origin === location.origin);
      if (open) return open.navigate(url).then((c) => (c || open).focus()).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    }),
  );
});
`,
);

// pages marked noindex (the online page before the server exists) stay out of the sitemap
const pages = urls.filter((u) => u.endsWith('/') && !u.includes('404') && !/<meta name="robots" content="noindex"/.test(readFileSync(join(dist, u, 'index.html'), 'utf8')));
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n') +
    `\n</urlset>\n`,
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`sw.js (${urls.length} files, version ${version}), sitemap.xml (${pages.length} pages), robots.txt`);
