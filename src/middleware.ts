/**
 * Next.js Edge Middleware — locale detection + admin auth guard.
 * Re-exports the proxy function from proxy.ts as the default middleware export.
 *
 * Excludes /api/* routes so they are never locale-prefixed.
 */
export { proxy as middleware } from "./proxy";

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT:
     * - /api/* (must NOT be locale-prefixed — audio, media, auth routes)
     * - _next/static / _next/image (Next.js internals)
     * - favicon, sitemap, robots (static assets)
     * - Files with extensions in /public
     */
    "/((?!api/|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.[a-z]{2,4}$).*)",
  ],
};
