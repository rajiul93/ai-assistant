import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loginCookieOptions, REFRESH_COOKIE, refreshIdToken, SESSION_COOKIE, tokenExpiry } from "@/lib/session";

// The manifest and app icons are fetched by the browser without cookies, so they must stay public.
const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/icon", "/apple-icon"];
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
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
  } else if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next({ request: { headers: request.headers } });
  }

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
