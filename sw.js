// sw.js — cache statique minimal (PWA). Ajoutez d'autres fichiers si besoin.
const CACHE = 'chrono-intervalles-v1';
const ASSETS = [
  './',
  './index.html', // si présent
  './mobile.css',
  './ergonomie.js',
  './manifest.json'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(ASSETS)));
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k===CACHE?null:caches.delete(k))))
  );
});

self.addEventListener('fetch', (e)=>{
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
