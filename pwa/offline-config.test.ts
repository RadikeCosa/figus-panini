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
    expect(PWA_CACHE_PREFIX).toBe("figus-pani");
    expect(PWA_CACHE_VERSION).toMatch(/^v\d+$/);
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
});
