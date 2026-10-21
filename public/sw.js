// Retirement worker for existing installations of the former offline worker.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('sultan-offline-')).map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
})()));
// No fetch handler, cached navigation, or background submission.
