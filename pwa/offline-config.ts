export const PWA_CACHE_PREFIX = "figus-pani";
export const PWA_CACHE_VERSION = "v1";

export const PWA_SHELL_ROUTES = [
  "/",
  "/album",
  "/quick-entry",
  "/missing",
  "/duplicates",
  "/backup",
] as const;

export const PWA_STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
] as const;

export const PWA_PRECACHED_URLS = [...PWA_SHELL_ROUTES, ...PWA_STATIC_ASSETS] as const;
