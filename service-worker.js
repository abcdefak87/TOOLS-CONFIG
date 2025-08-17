const CACHE_NAME = 'scan-barang-cache-v1';
const CORE_ASSETS = [
	'./',
	'./index.html',
	'./style.css',
	'./script.js',
	'./manifest.json'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key))))
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request).then((response) => {
				if (!response || response.status !== 200 || response.type !== 'basic') return response;
				const responseToCache = response.clone();
				caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
				return response;
			}).catch(() => cached)
		})
	);
});