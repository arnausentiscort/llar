// Perquè s'obri sense connexió (al súper sense cobertura): primer la xarxa i, si no n'hi ha, el que es va veure
// l'últim cop. Les crides a Supabase no passen per aquí (són d'un altre lloc).
const CAIXA = 'llar-v11';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
	const url = new URL(e.request.url);
	if (e.request.method !== 'GET' || url.origin !== location.origin) return;
	e.respondWith(
		fetch(e.request, {cache: 'no-cache'})
			.then((r) => {
				const copia = r.clone();
				caches.open(CAIXA).then((c) => c.put(e.request, copia));
				return r;
			})
			.catch(() => caches.match(e.request)),
	);
});
