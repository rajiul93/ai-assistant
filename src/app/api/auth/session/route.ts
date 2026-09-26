import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionCookie } from "@/lib/auth";
import { loginCookieOptions, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/session";
import { isFirebaseClientConfigured } from "@/lib/firebase/config";

/** Sign in: the ID token becomes the session; the refresh token keeps it alive (see src/proxy.ts). */
export async function POST(request: Request) {
  if (!isFirebaseClientConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured." },
      { status: 500 },
    );
  }

  const { idToken, refreshToken } = (await request.json()) as { idToken?: string; refreshToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  try {
    const sessionCookie = await createSessionCookie(idToken);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionCookie, loginCookieOptions());
    if (refreshToken) cookieStore.set(REFRESH_COOKIE, refreshToken, loginCookieOptions());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  return NextResponse.json({ ok: true });
}
