// AKS TIZIM — ilova o'rnatilishi uchun minimal xizmat (hech narsa saqlamaydi, har doim yangi ma'lumot)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
