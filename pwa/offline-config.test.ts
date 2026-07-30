import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PWA_CACHE_PREFIX,
  PWA_CACHE_VERSION,
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

  it("uses a versioned cache name", () => {
    const serviceWorkerSource = readFileSync("public/sw.js", "utf8");

    expect(PWA_CACHE_PREFIX).toBe("figus-pani");
    expect(PWA_CACHE_VERSION).toBe("v3");
    expect(serviceWorkerSource).toContain(`const CACHE_VERSION = "${PWA_CACHE_VERSION}"`);
  });

  it("keeps the service worker precache list aligned with the tested config", () => {
    const serviceWorkerSource = readFileSync("public/sw.js", "utf8");

    for (const url of PWA_PRECACHED_URLS) {
      expect(serviceWorkerSource).toContain(`"${url}"`);
    }
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

  it("keeps the service worker aligned with the shell navigation cache contract", () => {
    const serviceWorkerSource = readFileSync("public/sw.js", "utf8");

    expect(serviceWorkerSource).toContain("function buildShellNavigationCacheKey(url)");
    expect(serviceWorkerSource).toContain("return url.pathname;");
  });

  it("uses network-first navigation for shell routes with cached offline fallback", () => {
    const serviceWorkerSource = readFileSync("public/sw.js", "utf8");
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
    const serviceWorkerSource = readFileSync("public/sw.js", "utf8");

    expect(serviceWorkerSource).not.toContain("text/x-component");
    expect(serviceWorkerSource).not.toContain("__figus_pani_app_data");
    expect(serviceWorkerSource).not.toContain("request.headers.get(\"rsc\")");
  });
});
