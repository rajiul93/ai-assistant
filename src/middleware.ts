import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// The manifest and app icons are fetched by the browser without cookies, so they must stay public.
const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/icon", "/apple-icon"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
