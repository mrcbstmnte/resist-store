/**
 * Order pages are reachable by anyone holding the link, so the order id in a URL
 * works like a password. Masks it before page views and vitals leave the browser.
 */
const PRIVATE_PATHS = [/^(\/orders\/)[^/]+/, /^(\/checkout\/mock\/)[^/]+/];

export function maskPrivateIds(href: string) {
  const url = new URL(href);
  for (const pattern of PRIVATE_PATHS) url.pathname = url.pathname.replace(pattern, '$1[id]');
  // /checkout/success?order=… and /checkout/cancel?order=…
  if (url.searchParams.has('order')) url.searchParams.set('order', '[id]');
  return url.toString();
}
