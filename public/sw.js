const CACHE_PREFIX = "figus-pani";
const CACHE_VERSION = "v2";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const PRECACHED_URLS = [
  "/",
  "/album",
  "/quick-entry",
  "/missing",
  "/duplicates",
  "/backup",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];
const SHELL_ROUTES = new Set([
  "/",
  "/album",
  "/quick-entry",
  "/missing",
  "/duplicates",
  "/backup",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHED_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(`${CACHE_PREFIX}-`) &&
                cacheName !== SHELL_CACHE &&
                cacheName !== RUNTIME_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request, url));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(handleAssetRequest(request));
  }
});

async function handleNavigationRequest(request, url) {
  const cache = await caches.open(SHELL_CACHE);
  const shellCacheKey = buildShellNavigationCacheKey(url);
  const cachedRoute = shellCacheKey ? await cache.match(shellCacheKey) : null;

  if (cachedRoute && shellCacheKey) {
    return cachedRoute;
  }

  try {
    const response = await fetch(request);

    if (response.ok && shellCacheKey) {
      await cache.put(shellCacheKey, response.clone());
    }

    return response;
  } catch {
    if (shellCacheKey) {
      const cachedHome = await cache.match("/");

      if (cachedHome) {
        return cachedHome;
      }
    }

    return new Response(
      "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Sin conexión</title></head><body><main><h1>Ruta no disponible sin conexión</h1><p>Volvé a abrir esta sección con conexión para dejarla disponible en este dispositivo.</p></main></body></html>",
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

function buildShellNavigationCacheKey(url) {
  if (!SHELL_ROUTES.has(url.pathname)) {
    return null;
  }

  return url.pathname;
}

async function handleAssetRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  );
}
