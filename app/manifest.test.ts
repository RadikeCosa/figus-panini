import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("defines installable app metadata", () => {
    expect(manifest()).toMatchObject({
      name: "Álbum de Pedro",
      short_name: "Figuritas",
      description: "Gestión local de figuritas del Mundial 2026",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f4f4f5",
      theme_color: "#064e3b",
    });
  });

  it("includes required PWA icons", () => {
    const icons = manifest().icons ?? [];

    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        }),
      ]),
    );
  });
});
