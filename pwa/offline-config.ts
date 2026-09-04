import offlineConfig from "./offline-config.json";

export const PWA_CACHE_PREFIX = offlineConfig.cachePrefix;

export const PWA_SHELL_ROUTES = offlineConfig.shellRoutes;

export const PWA_STATIC_ASSETS = offlineConfig.staticAssets;

export const PWA_PRECACHED_URLS = [...PWA_SHELL_ROUTES, ...PWA_STATIC_ASSETS] as const;

export function buildShellNavigationCacheKey(url: URL): string | null {
  if (!(PWA_SHELL_ROUTES as readonly string[]).includes(url.pathname)) {
    return null;
  }

  return url.pathname;
}
