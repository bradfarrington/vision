/**
 * Returns the correct route prefix for storefront links.
 * On custom domains, routes are mounted at root (/), so no prefix needed.
 * On CRM domains (localhost / .vercel.app), routes live under /shop.
 */
export function getStorefrontBase(): string {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '/shop';
  if (hostname.endsWith('.vercel.app')) return '/shop';
  if (hostname === 'app.isobexlasers.co.uk') return '/shop';
  return '';
}

/**
 * Build a storefront-relative path.
 * e.g. sfPath('/products') → '/shop/products' on CRM, '/products' on custom domain
 */
export function sfPath(path: string): string {
  const base = getStorefrontBase();
  if (!path || path === '/') return base || '/';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
