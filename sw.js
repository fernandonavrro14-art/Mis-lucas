/* Service worker de Mis Lucas: deja la app funcionando sin internet.
   Si agregas archivos nuevos a la app, súmalos a SHELL y sube VERSION.
   Comparte el sitio con Al día (/dia/, con su propio service worker):
   solo toca cachés que empiezan con "mislucas-" y no atiende lo que está en /dia/. */

const VERSION = 'v1.2.1';
const CACHE = `mislucas-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// La versión nueva queda esperando hasta que toques "Actualizar" en la app
// (o hasta que la cierres del todo). La primera instalación se activa sola.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mislucas-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la red (así los cambios publicados llegan al tiro);
// si no hay internet o tarda más de 3 s, se usa la copia guardada.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.url.startsWith(new URL('./dia/', self.registration.scope).href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const red = fetch(req)
      .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => null);
    const lento = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
    const res = await Promise.race([red, lento]);
    if (res) return res;
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (cached) return cached;
    return (await red) || Response.error();
  })());
});
