import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session";

export { SESSION_COOKIE };

type TokenUser = {
  uid: string;
  email?: string;
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
    name: user.displayName,
    picture: user.photoUrl,
  };
}

export async function createSessionCookie(idToken: string) {
  if (isFirebaseAdminConfigured()) {
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
    const decoded = await adminAuth().verifyIdToken(idToken);
    await upsertUserFromToken(decoded.uid, decoded.email, decoded.name, decoded.picture);
    return sessionCookie;
  }

  const decoded = await lookupFirebaseUser(idToken);
  await upsertUserFromToken(decoded.uid, decoded.email, decoded.name, decoded.picture);
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

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    if (isFirebaseAdminConfigured()) {
      const decoded = await adminAuth().verifySessionCookie(session, true);
      return upsertUserFromToken(decoded.uid, decoded.email, decoded.name, decoded.picture);
    }

    const decoded = await lookupFirebaseUser(session);
    return upsertUserFromToken(decoded.uid, decoded.email, decoded.name, decoded.picture);
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: isFirebaseAdminConfigured() ? SESSION_MAX_AGE_MS / 1000 : 60 * 55,
  };
}
