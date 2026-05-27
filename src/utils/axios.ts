import axios, { type InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.BASE_URL || 'https://mangafire.to';

/**
 * CF Worker proxy URL (set via PROXY_URL env var).
 * When configured, all requests to mangafire.to are routed through the CF Worker,
 * bypassing Cloudflare managed challenges without needing a cf_clearance cookie.
 * Example: https://comick-proxy.your-name.workers.dev
 */
const PROXY_URL = (process.env.PROXY_URL || '').replace(/\/$/, '');

export const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Referer: 'https://mangafire.to/',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

if (PROXY_URL) {
  /**
   * When PROXY_URL is set, intercept every request and route it through the CF Worker.
   * The CF Worker fetches mangafire.to from inside Cloudflare's network, bypassing
   * the managed challenge that blocks direct server-side requests.
   */
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    // Build the full target URL
    const path = config.url || '';
    const targetUrl = path.startsWith('http') ? path : `${BASE_URL}${path}`;

    // Determine if this is an AJAX request
    const isAjax =
      (config.headers?.['X-Requested-With'] === 'XMLHttpRequest') ||
      targetUrl.includes('/ajax/');

    // Route through CF Worker proxy
    const proxyUrl = new URL(PROXY_URL);
    proxyUrl.searchParams.set('url', targetUrl);
    if (isAjax) proxyUrl.searchParams.set('xrw', '1');

    // Override the request URL and remove base URL prefix
    config.url = proxyUrl.toString();
    config.baseURL = undefined;

    // Remove cookie-based bypass (not needed when using CF Worker)
    if (config.headers) {
      delete config.headers['Cookie'];
    }

    return config;
  });
} else {
  // Fallback: no proxy configured — log a warning at startup
  console.warn(
    '[mangafire] PROXY_URL is not set. Requests to mangafire.to will go directly ' +
    'and may be blocked by Cloudflare. Set PROXY_URL to your CF Worker URL.'
  );
}
