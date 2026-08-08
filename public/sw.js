/**
 * Service worker du POS Café.
 *
 * Rôle : rendre l'application installable et la garder ouvrable même si le réseau
 * hésite. Il ne met en cache que les fichiers de l'application ; les appels à la base
 * (autre domaine) passent toujours par le réseau, pour ne jamais afficher une caisse
 * périmée.
 */
const CACHE = 'cafe-pos-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Base de données, agent d'impression : jamais de cache.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/print') || url.pathname.startsWith('/health')) return

  // Navigation : le réseau d'abord, le cache seulement s'il est injoignable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? Response.error())),
    )
    return
  }

  // Fichiers de l'application : le cache d'abord, ils portent une empreinte dans leur nom.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          }
          return res
        }),
    ),
  )
})
