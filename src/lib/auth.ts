import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { prisma } from "@/lib/prisma";
import { adminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { loginCookieOptions, SESSION_COOKIE } from "@/lib/session";

export { SESSION_COOKIE };

type TokenUser = {
  uid: string;
  email?: string;
  /** Roles hang on the email, so an unverified one is never accepted. */
  emailVerified?: boolean;
  name?: string;
  picture?: string;
};

async function lookupFirebaseUser(idToken: string): Promise<TokenUser> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Firebase API key is not configured.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );

  if (!response.ok) {
    throw new Error("Invalid Firebase token.");
  }

  const payload = (await response.json()) as {
    users?: Array<{
      localId: string;
      email?: string;
      emailVerified?: boolean;
      displayName?: string;
      photoUrl?: string;
    }>;
  };
  const user = payload.users?.[0];
  if (!user) {
    throw new Error("Invalid Firebase token.");
  }

  return {
    uid: user.localId,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.displayName,
    picture: user.photoUrl,
  };
}

/**
 * Verifies a Firebase ID token locally: its signature is checked against Google's public keys,
 * which firebase-admin downloads once and caches for hours. Unlike the accounts:lookup API this
 * needs no network round trip per request (that call cost ~450ms on every page) and only the
 * project ID — no service-account credentials.
 */
function tokenVerifier() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const name = "id-token-verifier";
  const app = getApps().find((existing) => existing.name === name) ?? initializeApp({ projectId }, name);
  return getAuth(app);
}

async function verifyFirebaseIdToken(idToken: string): Promise<TokenUser> {
  const verifier = tokenVerifier();
  if (!verifier) return lookupFirebaseUser(idToken);
  try {
    const decoded = await verifier.verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified, name: decoded.name as string | undefined, picture: decoded.picture };
  } catch (error) {
    // An invalid or expired token is final; anything else (e.g. couldn't fetch the keys) falls back to Google's API.
    const code = (error as { code?: string }).code ?? "";
    if (code.startsWith("auth/")) throw error;
    return lookupFirebaseUser(idToken);
  }
}

/**
 * Recently verified sessions, so most requests skip verification and the user upsert entirely.
 * Kept at most 5 minutes and never past the token's own expiry.
 */
const SESSION_CACHE_MS = 5 * 60 * 1000;
const verifiedSessions = new Map<string, { user: Awaited<ReturnType<typeof upsertUserFromToken>>; until: number }>();

function tokenExpiryMs(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** On sign-out: stop accepting this session token here right away instead of trusting the cache. */
export function forgetSession(token: string) {
  verifiedSessions.delete(token);
}

function rememberSession(token: string, user: Awaited<ReturnType<typeof upsertUserFromToken>>) {
  const expiry = tokenExpiryMs(token);
  const until = Math.min(Date.now() + SESSION_CACHE_MS, expiry ?? Date.now() + SESSION_CACHE_MS);
  if (verifiedSessions.size > 500) verifiedSessions.clear();
  verifiedSessions.set(token, { user, until });
}

/**
 * Signs a user in from a Firebase ID token. The ID token itself is the session cookie; it lasts an
 * hour and the proxy (src/proxy.ts) swaps in a new one from the refresh-token cookie before it ends.
 */
/** Google sign-ins are always verified; this blocks any other provider's unverified email. */
function requireVerifiedEmail(user: TokenUser) {
  if (user.emailVerified !== true) throw new Error("Please sign in with a verified email address.");
  return user;
}

export async function createSessionCookie(idToken: string) {
  const decoded = requireVerifiedEmail(await verifyFirebaseIdToken(idToken));
  const user = await upsertUserFromToken(decoded.uid, decoded.email, decoded.name, decoded.picture);
  if (user.status === "BLOCKED") throw new Error("This account has been blocked. Please contact the admin.");
  return idToken;
}

export async function upsertUserFromToken(
  firebaseUid: string,
  email?: string,
  name?: string,
  picture?: string,
) {
  if (!email) {
    throw new Error("Google account email is required.");
  }

  return prisma.user.upsert({
    where: { firebaseUid },
    update: {
      email,
      name: name ?? null,
      image: picture ?? null,
    },
    create: {
      firebaseUid,
      email,
      name: name ?? null,
      image: picture ?? null,
    },
  });
}

/** An ID token, or a 5-day Firebase session cookie from before the refresh-token login. */
async function verifySession(session: string): Promise<TokenUser> {
  try {
    return await verifyFirebaseIdToken(session);
  } catch (error) {
    if (!isFirebaseAdminConfigured()) throw error;
    const decoded = await adminAuth().verifySessionCookie(session, true);
    return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified, name: decoded.name as string | undefined, picture: decoded.picture };
  }
}

/** The signed-in user, verified at most once per request (React cache) and once per 5 minutes. */
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const remembered = verifiedSessions.get(session);
  if (remembered && remembered.until > Date.now()) return remembered.user;
  verifiedSessions.delete(session);

  try {
    const decoded = requireVerifiedEmail(await verifySession(session));
    const user = await upsertUserFromToken(decoded.uid, decoded.email, decoded.name, decoded.picture);
    rememberSession(session, user);
    return user;
  } catch {
    return null;
  }
});

/** Read fresh (not from the 5-minute session cache) once per request, so a block applies at once. */
const isBlocked = cache(async (userId: string) => (await prisma.user.findUnique({ where: { id: userId }, select: { status: true } }))?.status === "BLOCKED");

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (await isBlocked(user.id)) redirect("/blocked");
  return user;
}

export function sessionCookieOptions() {
  return { name: SESSION_COOKIE, ...loginCookieOptions() };
}
