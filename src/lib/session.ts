export const SESSION_COOKIE = "prep_session";
/** Firebase refresh token: lets the server get a new ID token when the old one (1 hour) runs out. */
export const REFRESH_COOKIE = "prep_refresh";
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000;
/** Both cookies live this long; each refresh extends it, so an active user never gets signed out. */
export const LOGIN_MAX_AGE_S = 60 * 60 * 24 * 90;

/** Reads a JWT's expiry (seconds) without verifying it — only to decide when to refresh. */
export function tokenExpiry(token: string | undefined) {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Trades a Firebase refresh token for a fresh ID token (Google's securetoken API). Returns null
 * when the refresh token is no longer valid (revoked, user disabled) or the call fails.
 */
export type RefreshResult = { idToken: string; refreshToken: string } | { invalid: boolean } | null;

export async function refreshIdToken(refreshToken: string): Promise<RefreshResult> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { invalid: response.status === 400 || response.status === 401 || response.status === 403 };
    const payload = (await response.json()) as { id_token?: string; refresh_token?: string };
    return payload.id_token ? { idToken: payload.id_token, refreshToken: payload.refresh_token ?? refreshToken } : null;
  } catch {
    return null;
  }
}

export function loginCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: LOGIN_MAX_AGE_S,
  };
}
