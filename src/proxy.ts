import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { decrypt } from "./lib/auth/session";

// next-intl middleware handles locale detection and prefix routing.
const intlMiddleware = createIntlMiddleware(routing);

// Paths that require an authenticated admin session.
const PROTECTED_PREFIXES = ["/admin", "/en/admin", "/ar/admin", "/am/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Auth guard for admin routes ───────────────────────
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected) {
    const sessionToken = request.cookies.get("session")?.value;
    const session = await decrypt(sessionToken);

    if (!session) {
      // Detect locale from the pathname prefix (e.g. /en/admin → en)
      const localeMatch = pathname.match(/^\/(en|ar|am)(\/|$)/);
      const locale = localeMatch ? localeMatch[1] : "en";
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── i18n locale routing ───────────────────────────────
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Run proxy on all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Files in /public with an extension
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.[a-z]{2,4}$).*)",
  ],
};
