import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPrecachedUrls,
  generateServiceWorker,
  listNextStaticAssetUrls,
  readBuildId,
  renderServiceWorker,
} from "./generate-service-worker.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("service worker build inventory", () => {
  it("reads and trims BUILD_ID", async () => {
    const projectDir = await createTemporaryProject();
    await writeFile(path.join(projectDir, ".next", "BUILD_ID"), "build-123\n");

    await expect(readBuildId(path.join(projectDir, ".next"))).resolves.toBe(
      "build-123",
    );
  });

  it("fails clearly when BUILD_ID is missing", async () => {
    const projectDir = await createTemporaryProject();

    await expect(readBuildId(path.join(projectDir, ".next"))).rejects.toThrow(
      "No se pudo leer",
    );
  });

  it("walks nested directories with stable, unique build URLs", async () => {
    const projectDir = await createTemporaryProject();
    const staticDir = path.join(projectDir, ".next", "static");
    await mkdir(path.join(staticDir, "chunks", "nested"), { recursive: true });
    await mkdir(path.join(staticDir, "media"), { recursive: true });
    await writeFile(path.join(staticDir, "chunks", "z.js"), "z");
    await writeFile(path.join(staticDir, "chunks", "nested", "a.js"), "a");
    await writeFile(path.join(staticDir, "media", "font name.woff2"), "font");
    await writeFile(path.join(projectDir, ".next", "outside.js"), "outside");

    await expect(listNextStaticAssetUrls(staticDir)).resolves.toEqual([
      "/_next/static/chunks/nested/a.js",
      "/_next/static/chunks/z.js",
      "/_next/static/media/font%20name.woff2",
    ]);
  });

  it("fails clearly when .next/static is missing", async () => {
    const projectDir = await createTemporaryProject();

    await expect(
      listNextStaticAssetUrls(path.join(projectDir, ".next", "static")),
    ).rejects.toThrow("No se pudo inventariar");
  });

  it("deduplicates and sorts the complete precache list", () => {
    expect(
      buildPrecachedUrls(
        {
          shellRoutes: ["/", "/album"],
          staticAssets: ["/manifest.webmanifest", "/album"],
        },
        ["/_next/static/z.js", "/_next/static/a.js", "/_next/static/a.js"],
      ),
    ).toEqual([
      "/",
      "/_next/static/a.js",
      "/_next/static/z.js",
      "/album",
      "/manifest.webmanifest",
    ]);
  });
});

describe("service worker generation pipeline", () => {
  it("renders the build version, stable routes and generated assets", () => {
    const worker = renderServiceWorker({
      buildId: "build-123",
      config: {
        cachePrefix: "figus-pani",
        shellRoutes: ["/", "/missing"],
      },
      precachedUrls: ["/", "/missing", "/_next/static/chunk.js"],
      template: [
        'const prefix = "__FIGUS_CACHE_PREFIX__";',
        'const version = "__FIGUS_BUILD_ID__";',
        "const assets = /*__FIGUS_PRECACHED_URLS__*/ [];",
        "const routes = /*__FIGUS_SHELL_ROUTES__*/ [];",
      ].join("\n"),
    });

    expect(worker).toContain('const prefix = "figus-pani"');
    expect(worker).toContain('const version = "build-123"');
    expect(worker).toContain('"/_next/static/chunk.js"');
    expect(worker).toContain('"/missing"');
  });

  it("writes public/sw.js from every fixture asset and validates it", async () => {
    const projectDir = await createCompleteFixture();
    const result = await generateServiceWorker({ projectDir });
    const worker = await readFile(path.join(projectDir, "public", "sw.js"), "utf8");

    expect(result.buildId).toBe("fixture-build");
    expect(result.nextStaticAssetUrls).toEqual([
      "/_next/static/chunks/app.js",
      "/_next/static/media/font.woff2",
    ]);
    expect(worker).toContain('const CACHE_VERSION = "fixture-build"');
    expect(worker).toContain('"/_next/static/chunks/app.js"');
    expect(worker).toContain('"/_next/static/media/font.woff2"');
    await expect(
      generateServiceWorker({ projectDir, check: true }),
    ).resolves.toMatchObject({ buildId: "fixture-build" });
  });

  it("detects when public/sw.js is absent or does not match the build", async () => {
    const projectDir = await createCompleteFixture();

    await expect(
      generateServiceWorker({ projectDir, check: true }),
    ).rejects.toThrow();

    await generateServiceWorker({ projectDir });
    await writeFile(path.join(projectDir, "public", "sw.js"), "stale worker");

    await expect(
      generateServiceWorker({ projectDir, check: true }),
    ).rejects.toThrow("no coincide con la build fixture-build");
  });
});

async function createTemporaryProject() {
  const projectDir = await mkdtemp(path.join(tmpdir(), "figus-pani-sw-test-"));
  temporaryDirectories.push(projectDir);
  await mkdir(path.join(projectDir, ".next"), { recursive: true });
  return projectDir;
}

async function createCompleteFixture() {
  const projectDir = await createTemporaryProject();
  await mkdir(path.join(projectDir, ".next", "static", "chunks"), {
    recursive: true,
  });
  await mkdir(path.join(projectDir, ".next", "static", "media"), {
    recursive: true,
  });
  await mkdir(path.join(projectDir, "pwa"), { recursive: true });
  await mkdir(path.join(projectDir, "public"), { recursive: true });
  await writeFile(path.join(projectDir, ".next", "BUILD_ID"), "fixture-build\n");
  await writeFile(path.join(projectDir, ".next", "static", "chunks", "app.js"), "app");
  await writeFile(
    path.join(projectDir, ".next", "static", "media", "font.woff2"),
    "font",
  );
  await writeFile(
    path.join(projectDir, "pwa", "offline-config.json"),
    JSON.stringify({
      cachePrefix: "figus-pani",
      shellRoutes: ["/", "/album"],
      staticAssets: ["/manifest.webmanifest"],
    }),
  );
  await writeFile(
    path.join(projectDir, "pwa", "service-worker.template.js"),
    await readFile(
      path.join(process.cwd(), "pwa", "service-worker.template.js"),
      "utf8",
    ),
  );
  return projectDir;
}
