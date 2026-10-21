/* Al día se cambió a /al-dia/. Este service worker reemplaza al antiguo de /Mis-lucas/dia/:
   se da de baja solo y recarga las pestañas abiertas para que lleguen a la redirección.
   No borra cachés: la caché vieja (aldia-v1.0.0) la limpia la app nueva. */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const ventanas = await self.clients.matchAll({ type: 'window' });
    ventanas.forEach((v) => v.navigate(v.url));
  })());
});
