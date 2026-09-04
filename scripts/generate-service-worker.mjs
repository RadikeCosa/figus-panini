import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BUILD_ID_TOKEN = "__FIGUS_BUILD_ID__";
const CACHE_PREFIX_TOKEN = "__FIGUS_CACHE_PREFIX__";
const PRECACHED_URLS_MARKER = "/*__FIGUS_PRECACHED_URLS__*/ []";
const SHELL_ROUTES_MARKER = "/*__FIGUS_SHELL_ROUTES__*/ []";

export async function readBuildId(distDir) {
  let buildId;

  try {
    buildId = (await readFile(path.join(distDir, "BUILD_ID"), "utf8")).trim();
  } catch (error) {
    throw new Error(`No se pudo leer ${path.join(distDir, "BUILD_ID")}.`, {
      cause: error,
    });
  }

  if (!buildId) {
    throw new Error(`El BUILD_ID de ${distDir} está vacío.`);
  }

  return buildId;
}

export async function listNextStaticAssetUrls(staticDir) {
  let entries;

  try {
    entries = await walkFiles(staticDir, staticDir);
  } catch (error) {
    throw new Error(`No se pudo inventariar ${staticDir}.`, { cause: error });
  }

  if (entries.length === 0) {
    throw new Error(`${staticDir} no contiene assets para precachear.`);
  }

  return [...new Set(entries)].sort();
}

async function walkFiles(rootDir, currentDir) {
  const directoryEntries = await readdir(currentDir, { withFileTypes: true });
  const urls = [];

  for (const entry of directoryEntries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`No se permiten enlaces simbólicos en ${absolutePath}.`);
    }

    if (entry.isDirectory()) {
      urls.push(...(await walkFiles(rootDir, absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(rootDir, absolutePath);
    const encodedPath = relativePath
      .split(path.sep)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    urls.push(`/_next/static/${encodedPath}`);
  }

  return urls;
}

export function buildPrecachedUrls(config, nextStaticAssetUrls) {
  return [
    ...new Set([
      ...config.shellRoutes,
      ...config.staticAssets,
      ...nextStaticAssetUrls,
    ]),
  ].sort();
}

export function renderServiceWorker({ buildId, config, precachedUrls, template }) {
  assertTemplateMarker(template, BUILD_ID_TOKEN);
  assertTemplateMarker(template, CACHE_PREFIX_TOKEN);
  assertTemplateMarker(template, PRECACHED_URLS_MARKER);
  assertTemplateMarker(template, SHELL_ROUTES_MARKER);

  return template
    .replace(BUILD_ID_TOKEN, escapeJavaScriptString(buildId))
    .replace(CACHE_PREFIX_TOKEN, escapeJavaScriptString(config.cachePrefix))
    .replace(PRECACHED_URLS_MARKER, JSON.stringify(precachedUrls, null, 2))
    .replace(SHELL_ROUTES_MARKER, JSON.stringify(config.shellRoutes, null, 2));
}

function assertTemplateMarker(template, marker) {
  if (!template.includes(marker)) {
    throw new Error(`La plantilla del service worker no contiene ${marker}.`);
  }
}

function escapeJavaScriptString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export async function generateServiceWorker({
  projectDir = process.cwd(),
  check = false,
} = {}) {
  const distDir = path.join(projectDir, ".next");
  const configPath = path.join(projectDir, "pwa", "offline-config.json");
  const templatePath = path.join(projectDir, "pwa", "service-worker.template.js");
  const outputPath = path.join(projectDir, "public", "sw.js");
  const [buildId, configSource, template, nextStaticAssetUrls] = await Promise.all([
    readBuildId(distDir),
    readFile(configPath, "utf8"),
    readFile(templatePath, "utf8"),
    listNextStaticAssetUrls(path.join(distDir, "static")),
  ]);
  const config = JSON.parse(configSource);
  validateConfig(config);
  const precachedUrls = buildPrecachedUrls(config, nextStaticAssetUrls);
  const worker = renderServiceWorker({ buildId, config, precachedUrls, template });

  if (check) {
    const currentWorker = await readFile(outputPath, "utf8");

    if (currentWorker !== worker) {
      throw new Error(`${outputPath} no coincide con la build ${buildId}.`);
    }
  } else {
    await writeFile(outputPath, worker, "utf8");
  }

  return { buildId, nextStaticAssetUrls, outputPath, precachedUrls };
}

function validateConfig(config) {
  if (
    typeof config !== "object" ||
    config === null ||
    typeof config.cachePrefix !== "string" ||
    config.cachePrefix.length === 0 ||
    !isStringArray(config.shellRoutes) ||
    !isStringArray(config.staticAssets)
  ) {
    throw new Error("pwa/offline-config.json no tiene una estructura válida.");
  }
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

async function main() {
  const check = process.argv.includes("--check");
  const result = await generateServiceWorker({ check });
  const action = check ? "verificado" : "generado";

  console.log(
    `Service worker ${action}: ${result.nextStaticAssetUrls.length} assets de Next.js, build ${result.buildId}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
