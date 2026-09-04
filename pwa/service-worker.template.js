/* global caches, self */

const CACHE_PREFIX = "__FIGUS_CACHE_PREFIX__";
const CACHE_VERSION = "__FIGUS_BUILD_ID__";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;
const CACHE_TRANSITION_URL = `${self.location.origin}/__figus-pani/cache-transition/${encodeURIComponent(CACHE_VERSION)}`;
const PRECACHED_URLS = /*__FIGUS_PRECACHED_URLS__*/ [];
const SHELL_ROUTES = new Set(/*__FIGUS_SHELL_ROUTES__*/ []);
let cacheTransitionOperation = Promise.resolve();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHED_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(runCacheTransitionOperation(prepareCacheTransition));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data && event.data.type === "CLIENT_READY" && event.source?.id) {
    event.waitUntil(
      runCacheTransitionOperation(() => confirmClientReady(event.source.id)).then(
        (cleanupComplete) => {
          event.source.postMessage({
            type: cleanupComplete
              ? "CACHE_CLEANUP_COMPLETE"
              : "CACHE_CLEANUP_PENDING",
          });
        },
      ),
    );
  }
});

async function prepareCacheTransition() {
  const [cacheNames, previousClients] = await Promise.all([
    caches.keys(),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }),
  ]);
  const obsoleteCacheNames = cacheNames.filter(isObsoleteAppCache);

  if (obsoleteCacheNames.length === 0) {
    await self.clients.claim();
    return;
  }

  if (previousClients.length === 0) {
    await deleteObsoleteCaches(obsoleteCacheNames);
    await self.clients.claim();
    return;
  }

  const runtimeCache = await caches.open(RUNTIME_CACHE);
  await runtimeCache.put(
    CACHE_TRANSITION_URL,
    new Response(
      JSON.stringify({
        obsoleteCacheNames,
        pendingClientIds: previousClients.map((client) => client.id),
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  await self.clients.claim();
}

async function confirmClientReady(clientId) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const transitionResponse = await runtimeCache.match(CACHE_TRANSITION_URL);

  if (!transitionResponse) {
    return true;
  }

  const transition = await transitionResponse.json();
  const liveClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const liveClientIds = new Set(liveClients.map((client) => client.id));
  const pendingClientIds = transition.pendingClientIds.filter(
    (pendingClientId) =>
      pendingClientId !== clientId && liveClientIds.has(pendingClientId),
  );

  if (pendingClientIds.length > 0) {
    await runtimeCache.put(
      CACHE_TRANSITION_URL,
      new Response(
        JSON.stringify({
          obsoleteCacheNames: transition.obsoleteCacheNames,
          pendingClientIds,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    return false;
  }

  await deleteObsoleteCaches(transition.obsoleteCacheNames);
  await runtimeCache.delete(CACHE_TRANSITION_URL);
  return true;
}

function isObsoleteAppCache(cacheName) {
  return (
    cacheName.startsWith(`${CACHE_PREFIX}-`) &&
    cacheName !== SHELL_CACHE &&
    cacheName !== RUNTIME_CACHE
  );
}

async function deleteObsoleteCaches(cacheNames) {
  await Promise.all(
    cacheNames.filter(isObsoleteAppCache).map((cacheName) => caches.delete(cacheName)),
  );
}

function runCacheTransitionOperation(operation) {
  const result = cacheTransitionOperation.then(operation, operation);
  cacheTransitionOperation = result.catch(() => undefined);
  return result;
}

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

  try {
    const response = await fetch(new Request(request, { cache: "no-store" }));

    if (response.ok && shellCacheKey) {
      await cache.put(shellCacheKey, response.clone());
    }

    return response;
  } catch {
    const cachedRoute = shellCacheKey ? await cache.match(shellCacheKey) : null;

    if (cachedRoute) {
      return cachedRoute;
    }

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
  const shellCache = await caches.open(SHELL_CACHE);
  const precachedResponse = await shellCache.match(request);

  if (precachedResponse) {
    return precachedResponse;
  }

  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await runtimeCache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    await runtimeCache.put(request, response.clone());
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
