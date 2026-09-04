import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { renderServiceWorker } from "../scripts/generate-service-worker.mjs";
import {
  PWA_CACHE_PREFIX,
  PWA_PRECACHED_URLS,
  PWA_SHELL_ROUTES,
  buildShellNavigationCacheKey,
} from "./offline-config";

describe("offline cache configuration", () => {
  it("covers the MVP routes required for offline use", () => {
    expect(PWA_SHELL_ROUTES).toEqual([
      "/",
      "/album",
      "/quick-entry",
      "/missing",
      "/duplicates",
      "/backup",
    ]);
  });

  it("uses the expected cache namespace", () => {
    expect(PWA_CACHE_PREFIX).toBe("figus-pani");
  });

  it("keeps stable routes and public assets in one versioned configuration", () => {
    expect(PWA_PRECACHED_URLS).toEqual([
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
    ]);
  });

  it("keeps the worker template aligned with the shell navigation contract", () => {
    const serviceWorkerSource = readFileSync(
      "pwa/service-worker.template.js",
      "utf8",
    );

    expect(serviceWorkerSource).toContain("/*__FIGUS_PRECACHED_URLS__*/ []");
    expect(serviceWorkerSource).toContain("/*__FIGUS_SHELL_ROUTES__*/ []");
    expect(serviceWorkerSource).toContain("function buildShellNavigationCacheKey(url)");
    expect(serviceWorkerSource).toContain("return url.pathname;");
  });

  it("keeps shell navigation cache keys stable while preserving the browser query string", () => {
    expect(
      buildShellNavigationCacheKey(
        new URL("https://figus.local/album?section=M%C3%A9xico"),
      ),
    ).toBe("/album");
    expect(
      buildShellNavigationCacheKey(
        new URL("https://figus.local/album?section=Corea%20del%20Sur"),
      ),
    ).toBe("/album");
    expect(
      buildShellNavigationCacheKey(
        new URL("https://figus.local/album?section=Pa%C3%ADses%20Bajos"),
      ),
    ).toBe("/album");
    expect(
      buildShellNavigationCacheKey(
        new URL(
          "https://figus.local/album?section=Rep%C3%BAblica%20Democr%C3%A1tica%20del%20Congo",
        ),
      ),
    ).toBe("/album");
  });

  it("does not treat arbitrary query strings as separate shell cache entries", () => {
    expect(
      buildShellNavigationCacheKey(
        new URL("https://figus.local/album?section=Italia&foo=bar"),
      ),
    ).toBe("/album");
    expect(
      buildShellNavigationCacheKey(new URL("https://figus.local/desconocida?x=1")),
    ).toBeNull();
  });

  it("uses network-first navigation for shell routes with cached offline fallback", () => {
    const serviceWorkerSource = readFileSync(
      "pwa/service-worker.template.js",
      "utf8",
    );
    const fetchIndex = serviceWorkerSource.indexOf(
      'const response = await fetch(new Request(request, { cache: "no-store" }))',
    );
    const cacheMatchIndex = serviceWorkerSource.indexOf(
      "const cachedRoute = shellCacheKey ? await cache.match(shellCacheKey) : null",
    );

    expect(fetchIndex).toBeGreaterThan(-1);
    expect(cacheMatchIndex).toBeGreaterThan(fetchIndex);
  });

  it("does not cache App Router RSC navigation payloads", () => {
    const serviceWorkerSource = readFileSync(
      "pwa/service-worker.template.js",
      "utf8",
    );

    expect(serviceWorkerSource).not.toContain("text/x-component");
    expect(serviceWorkerSource).not.toContain("__figus_pani_app_data");
    expect(serviceWorkerSource).not.toContain("request.headers.get(\"rsc\")");
  });

  it("waits during updates but still supports explicit activation", () => {
    const serviceWorkerSource = readFileSync(
      "pwa/service-worker.template.js",
      "utf8",
    );
    const installHandler = serviceWorkerSource.slice(
      serviceWorkerSource.indexOf('self.addEventListener("install"'),
      serviceWorkerSource.indexOf('self.addEventListener("activate"'),
    );

    expect(installHandler).not.toContain("skipWaiting");
    expect(serviceWorkerSource).toContain('event.data.type === "SKIP_WAITING"');
    expect(serviceWorkerSource).toContain("self.skipWaiting()");
  });

  it("does not reference collection storage or user data", () => {
    const serviceWorkerSource = readFileSync(
      "pwa/service-worker.template.js",
      "utf8",
    );

    expect(serviceWorkerSource).not.toContain("indexedDB");
    expect(serviceWorkerSource).not.toContain("copiesByPosition");
    expect(serviceWorkerSource).not.toContain("CollectionRepository");
  });

  it("keeps old caches until every previous client is ready or gone", async () => {
    const cacheStorage = createCacheStorage([
      "figus-pani-shell-build-old",
      "figus-pani-runtime-build-old",
      "figus-pani-shell-build-older",
      "unrelated-cache",
    ]);
    const clients = createClients(["slow-client", "ready-client"]);
    const worker = createServiceWorkerHarness({ cacheStorage, clients });
    const readyClient = { id: "ready-client", postMessage: vi.fn() };

    await worker.dispatch("install");
    await worker.dispatch("activate");

    expect(cacheStorage.names()).toContain("figus-pani-shell-build-old");
    expect(cacheStorage.names()).toContain("figus-pani-runtime-build-old");
    expect(cacheStorage.names()).toContain("figus-pani-shell-build-older");
    expect(clients.claim).toHaveBeenCalledTimes(1);

    await worker.dispatch("message", {
      data: { type: "CLIENT_READY" },
      source: readyClient,
    });

    expect(cacheStorage.names()).toContain("figus-pani-shell-build-old");
    expect(cacheStorage.names()).toContain("figus-pani-runtime-build-old");
    expect(readyClient.postMessage).toHaveBeenCalledWith({
      type: "CACHE_CLEANUP_PENDING",
    });

    clients.setIds(["ready-client"]);
    const restartedWorker = createServiceWorkerHarness({ cacheStorage, clients });
    await restartedWorker.dispatch("message", {
      data: { type: "CLIENT_READY" },
      source: readyClient,
    });

    expect(cacheStorage.names()).not.toContain("figus-pani-shell-build-old");
    expect(cacheStorage.names()).not.toContain("figus-pani-runtime-build-old");
    expect(cacheStorage.names()).not.toContain("figus-pani-shell-build-older");
    expect(cacheStorage.names()).toContain("figus-pani-shell-build-new");
    expect(cacheStorage.names()).toContain("figus-pani-runtime-build-new");
    expect(cacheStorage.names()).toContain("unrelated-cache");
    expect(readyClient.postMessage).toHaveBeenCalledWith({
      type: "CACHE_CLEANUP_COMPLETE",
    });
  });

  it("activates a first installation without skipWaiting or cache cleanup", async () => {
    const cacheStorage = createCacheStorage();
    const clients = createClients(["first-client"]);
    const worker = createServiceWorkerHarness({ cacheStorage, clients });

    await worker.dispatch("install");
    await worker.dispatch("activate");

    expect(worker.skipWaiting).not.toHaveBeenCalled();
    expect(cacheStorage.deletedNames).toEqual([]);
    expect(cacheStorage.addAll).toHaveBeenCalledWith(["/", "/album"]);
    expect(clients.claim).toHaveBeenCalledTimes(1);

    const firstClient = { id: "first-client", postMessage: vi.fn() };
    await worker.dispatch("message", {
      data: { type: "CLIENT_READY" },
      source: firstClient,
    });
    expect(firstClient.postMessage).toHaveBeenCalledWith({
      type: "CACHE_CLEANUP_COMPLETE",
    });
  });
});

function createServiceWorkerHarness({
  cacheStorage,
  clients,
}: {
  cacheStorage: ReturnType<typeof createCacheStorage>;
  clients: ReturnType<typeof createClients>;
}) {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const workerGlobal = {
    location: { origin: "https://figus.local" },
    clients,
    skipWaiting,
    addEventListener: vi.fn(
      (eventName: string, listener: (event: Record<string, unknown>) => void) => {
        listeners.set(eventName, listener);
      },
    ),
  };
  const template = readFileSync("pwa/service-worker.template.js", "utf8");
  const source = renderServiceWorker({
    buildId: "build-new",
    config: { cachePrefix: "figus-pani", shellRoutes: ["/", "/album"] },
    precachedUrls: ["/", "/album"],
    template,
  });

  runInNewContext(source, {
    self: workerGlobal,
    caches: cacheStorage,
    URL,
    Request,
    Response,
    Set,
    Promise,
    JSON,
    encodeURIComponent,
    fetch: vi.fn(),
  });

  return {
    skipWaiting,
    async dispatch(eventName: string, properties: Record<string, unknown> = {}) {
      const pendingPromises: Promise<unknown>[] = [];
      const listener = listeners.get(eventName);

      if (!listener) {
        throw new Error(`No listener registered for ${eventName}.`);
      }

      listener({
        ...properties,
        waitUntil: (promise: Promise<unknown>) => pendingPromises.push(promise),
      });
      await Promise.all(pendingPromises);
    },
  };
}

function createClients(initialIds: string[] = []) {
  let ids = initialIds;

  return {
    claim: vi.fn().mockResolvedValue(undefined),
    matchAll: vi.fn().mockImplementation(async () => ids.map((id) => ({ id }))),
    setIds(nextIds: string[]) {
      ids = nextIds;
    },
  };
}

function createCacheStorage(initialNames: string[] = []) {
  const stores = new Map<string, Map<string, Response>>(
    initialNames.map((name) => [name, new Map()]),
  );
  const deletedNames: string[] = [];
  const addAll = vi.fn().mockResolvedValue(undefined);

  return {
    addAll,
    deletedNames,
    names: () => [...stores.keys()],
    keys: vi.fn().mockImplementation(async () => [...stores.keys()]),
    delete: vi.fn().mockImplementation(async (name: string) => {
      deletedNames.push(name);
      return stores.delete(name);
    }),
    open: vi.fn().mockImplementation(async (name: string) => {
      let store = stores.get(name);

      if (!store) {
        store = new Map();
        stores.set(name, store);
      }

      return {
        addAll,
        put: async (request: string | Request, response: Response) => {
          const key = typeof request === "string" ? request : request.url;
          store?.set(key, response.clone());
        },
        match: async (request: string | Request) => {
          const key = typeof request === "string" ? request : request.url;
          return store?.get(key)?.clone();
        },
        delete: async (request: string | Request) => {
          const key = typeof request === "string" ? request : request.url;
          return store?.delete(key) ?? false;
        },
      };
    }),
  };
}
