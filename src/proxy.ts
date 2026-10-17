import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { normalizeCode, parseRefCookie, REF_COOKIE, REF_COOKIE_DAYS, REF_PARAM, refCookieValue } from "@/lib/affiliate";
import { loginCookieOptions, REFRESH_COOKIE, refreshIdToken, SESSION_COOKIE, tokenExpiry } from "@/lib/session";

// The manifest and app icons are fetched by the browser without cookies, so they must stay public;
// /api/health is pinged by an outside keep-alive cron; SSLCommerz posts its payment callbacks to
// /api/payments/sslcommerz/* without our cookies (each one validates with SSLCommerz itself).
// /api/affiliate/click is called by this proxy itself (below) to count a visit through a link.
const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/icon", "/apple-icon", "/api/health", "/api/payments/sslcommerz", "/api/affiliate/click"];
/** Pages only for signed-out visitors: the landing page and the login page. */
const SIGNED_OUT_ONLY = ["/", "/login"];
/** Refresh this long before the ID token (1 hour) expires, so a request never arrives with a dead one. */
const REFRESH_BEFORE_MS = 5 * 60 * 1000;

// Several requests often arrive together (page + data + assets); refresh once and share the result.
const inFlight = new Map<string, ReturnType<typeof refreshIdToken>>();

function refreshOnce(refreshToken: string) {
  let pending = inFlight.get(refreshToken);
  if (!pending) {
    pending = refreshIdToken(refreshToken).finally(() => setTimeout(() => inFlight.delete(refreshToken), 10_000));
    inFlight.set(refreshToken, pending);
  }
  return pending;
}

/**
 * Guards every page and keeps the login alive: a Firebase ID token lasts only an hour, so when it
 * is about to run out the refresh token (httpOnly cookie) is exchanged for a new one here, before
 * the page renders — the user is never signed out while they keep using the app.
 */
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  // "/" (the landing page) is public by exact match only; everything under it stays guarded.
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  let session = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const expiresAt = tokenExpiry(session);
  const stale = !session || (expiresAt !== null && expiresAt * 1000 - Date.now() < REFRESH_BEFORE_MS);

  let renewed: { idToken: string; refreshToken: string } | null = null;
  let dropRefresh = false;
  if (stale && refreshToken) {
    const result = await refreshOnce(refreshToken);
    if (result && "idToken" in result) {
      renewed = result;
      session = result.idToken;
      // Pass the fresh token on to this request's page/action, not just to the browser.
      request.cookies.set(SESSION_COOKIE, result.idToken);
    } else if (result && "invalid" in result && result.invalid) {
      dropRefresh = true;
    }
  }
  // An expired token that couldn't be renewed is as good as none.
  const signedIn = Boolean(session) && !(stale && !renewed && expiresAt !== null && expiresAt * 1000 <= Date.now());

  let response: NextResponse;
  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    response = NextResponse.redirect(url);
  } else if (signedIn && SIGNED_OUT_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next({ request: { headers: request.headers } });
  }

  rememberReferral(request, response, event);

  if (renewed) {
    response.cookies.set(SESSION_COOKIE, renewed.idToken, loginCookieOptions());
    response.cookies.set(REFRESH_COOKIE, renewed.refreshToken, loginCookieOptions());
  } else if (dropRefresh) {
    response.cookies.delete(REFRESH_COOKIE);
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

/**
 * An affiliate link is any page with `?ref=CODE` (docs/affiliate-plan.md). Wherever it was shared,
 * opening it lands here first: the code and the time go into a cookie (also on a redirect to
 * /login), and the visit is counted once per browser per code. Whether it still counts, and for
 * whom, is decided on the server when the visitor signs in or buys.
 */
function rememberReferral(request: NextRequest, response: NextResponse, event: NextFetchEvent) {
  const code = normalizeCode(request.nextUrl.searchParams.get(REF_PARAM));
  if (!code) return;
  if (parseRefCookie(request.cookies.get(REF_COOKIE)?.value)?.code === code) return;
  response.cookies.set(REF_COOKIE, refCookieValue(code, Date.now()), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: REF_COOKIE_DAYS * 24 * 60 * 60,
  });
  // Counted after the response is sent, so the page isn't slowed down.
  event.waitUntil(fetch(new URL("/api/affiliate/click", request.url), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => undefined));
}
