import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionCookie, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import { isFirebaseClientConfigured } from "@/lib/firebase/config";

export async function POST(request: Request) {
  if (!isFirebaseClientConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured." },
      { status: 500 },
    );
  }

  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  try {
    const sessionCookie = await createSessionCookie(idToken);
    const options = sessionCookieOptions();
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionCookie, options);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
