import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_EXCLUDED_ROUTES = new Set<string>([
  '/404',
  '/500',
  '/_error',
  '/_app',
  '/_document',
  '/_middleware',
  '/index',
  '/_not-found',
]);

const DEFAULT_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
  'https://searchadvisor.naver.com/indexnow',
];

export interface SubmitToIndexNowOptions {
  /**
   * Fully qualified base URL of your Next.js application (e.g. https://example.com)
   */
  baseUrl: string;
  /**
   * Directory that contains the compiled Next.js output. Defaults to `.next`.
   */
  nextBuildDir?: string;
  /**
   * IndexNow API key value. The matching key file must be available on your site.
   */
  key: string;
  /**
   * Optional absolute URL that points to the publicly accessible IndexNow key file.
   * Defaults to `${baseUrl}/${key}.txt` when omitted.
   */
  keyLocation?: string;
  /**
   * Overrides the list of IndexNow-compatible endpoints to notify.
   */
  endpoints?: string[];
  /**
   * Optional filter that can be used to remove URLs from the submission payload.
   */
  urlFilter?: (url: string) => boolean;
  /**
   * When true, URLs are collected but not submitted. Useful for testing locally.
   */
  dryRun?: boolean;
}

export interface SubmitToIndexNowResult {
  /** URLs that were discovered in the Next.js build output */
  urls: string[];
  /** Result of the submission attempt for each endpoint */
  responses: Record<string, { status: number; ok: boolean; body?: string }>;
}

async function readJsonIfExists<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const file = await fs.readFile(filePath, 'utf8');
    return JSON.parse(file) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function normalizeRoute(route: string): string {
  if (!route.startsWith('/')) {
    route = `/${route}`;
  }
  if (route !== '/' && route.endsWith('/')) {
    route = route.slice(0, -1);
  }
  return route;
}

function isDynamicRoute(route: string): boolean {
  return /[\[\]]/.test(route) || route.includes(':');
}

function shouldExcludeRoute(route: string): boolean {
  if (DEFAULT_EXCLUDED_ROUTES.has(route)) {
    return true;
  }
  if (route.startsWith('/_next')) {
    return true;
  }
  return false;
}

export async function collectIndexableRoutes(nextBuildDir = '.next'): Promise<string[]> {
  const resolvedDir = path.resolve(nextBuildDir);
  const discoveredRoutes = new Set<string>();

  const routesManifest = await readJsonIfExists<any>(path.join(resolvedDir, 'routes-manifest.json'));
  if (routesManifest?.staticRoutes) {
    for (const route of routesManifest.staticRoutes) {
      if (!route?.page) continue;
      const normalized = normalizeRoute(route.page);
      if (isDynamicRoute(normalized) || shouldExcludeRoute(normalized)) continue;
      discoveredRoutes.add(normalized === '/index' ? '/' : normalized);
    }
  }

  const prerenderManifest = await readJsonIfExists<any>(path.join(resolvedDir, 'prerender-manifest.json'));
  if (prerenderManifest?.routes) {
    for (const routeKey of Object.keys(prerenderManifest.routes)) {
      const normalized = normalizeRoute(routeKey);
      if (isDynamicRoute(normalized) || shouldExcludeRoute(normalized)) continue;
      discoveredRoutes.add(normalized);
    }
  }

  const pagesManifest = await readJsonIfExists<Record<string, string>>(path.join(resolvedDir, 'server', 'pages-manifest.json'));
  if (pagesManifest) {
    for (const routeKey of Object.keys(pagesManifest)) {
      const normalized = normalizeRoute(routeKey);
      if (isDynamicRoute(normalized) || shouldExcludeRoute(normalized)) continue;
      discoveredRoutes.add(normalized === '/index' ? '/' : normalized);
    }
  }

  const appPathsManifest = await readJsonIfExists<Record<string, string>>(path.join(resolvedDir, 'server', 'app-paths-manifest.json'));
  if (appPathsManifest) {
    for (const routeKey of Object.keys(appPathsManifest)) {
      const normalized = normalizeRoute(routeKey);
      if (isDynamicRoute(normalized) || shouldExcludeRoute(normalized)) continue;
      discoveredRoutes.add(normalized === '/index' ? '/' : normalized);
    }
  }

  const routes = Array.from(discoveredRoutes);
  routes.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  return routes;
}

export async function submitToIndexNow(options: SubmitToIndexNowOptions): Promise<SubmitToIndexNowResult> {
  const { baseUrl, nextBuildDir = '.next', key, keyLocation, endpoints = DEFAULT_ENDPOINTS, urlFilter, dryRun } = options;

  if (!baseUrl) {
    throw new Error('`baseUrl` must be provided.');
  }
  if (!key) {
    throw new Error('`key` must be provided.');
  }

  const url = new URL(baseUrl);
  const pathname = url.pathname.endsWith('/') && url.pathname !== '/' ? url.pathname.slice(0, -1) : url.pathname;
  const normalizedBase = `${url.origin}${pathname === '/' ? '' : pathname}`;

  const routes = await collectIndexableRoutes(nextBuildDir);
  const urls = routes
    .map((route) => (route === '/' ? normalizedBase : `${normalizedBase}${route}`))
    .filter((routeUrl) => (urlFilter ? urlFilter(routeUrl) : true));

  const submission: SubmitToIndexNowResult = {
    urls,
    responses: {},
  };

  if (dryRun) {
    return submission;
  }

  const payload = {
    host: url.host,
    key,
    keyLocation: keyLocation ?? `${normalizedBase}/${key}.txt`,
    urlList: urls,
  };

  await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const bodyText = await response.text();
        submission.responses[endpoint] = {
          status: response.status,
          ok: response.ok,
          body: bodyText || undefined,
        };
      } catch (error: any) {
        submission.responses[endpoint] = {
          status: 0,
          ok: false,
          body: error?.message,
        };
      }
    })
  );

  return submission;
}
