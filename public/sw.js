// Service Worker: Busana (Beauty Asana) PWA
const CACHE_NAME = 'busana-pwa-v3';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-48x48.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-16x16.png'
];

// 1. Install Event: Pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA] Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Intelligent Caching Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jangan tangkap/cache request di development (localhost / 127.0.0.1)
  // agar Turbopack HMR dan websocket dev server tidak hang atau stuck
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Hanya proses request GET dari origin yang sama atau aset font/cdn
  if (request.method !== 'GET') return;

  // Supabase API, Auth, & dynamic APIs: Selalu Network-First tanpa cache agresif
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // Next.js static chunks, fonts, icons: Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Navigasi HTML Halaman: Network-First dengan Fallback ke Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Default: Cache First dengan Network Fallback
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});

// 4. Push & Notification Click Handlers (PWA Standards)
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'Pembaruan tugas atau jadwal baru',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/favicon-48x48.png',
        vibrate: [100, 50, 100],
        data: data.data || { url: '/' }
      };
      event.waitUntil(self.registration.showNotification(data.title || 'Busana | Beauty Asana', options));
    } catch (e) {
      event.waitUntil(
        self.registration.showNotification('Busana | Beauty Asana', {
          body: event.data.text(),
          icon: '/icons/icon-192x192.png'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
