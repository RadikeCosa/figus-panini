import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PWA_CACHE_PREFIX,
  PWA_CACHE_VERSION,
  PWA_PRECACHED_URLS,
  PWA_SHELL_ROUTES,
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
});
