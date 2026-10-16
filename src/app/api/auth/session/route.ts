import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createSessionCookie, forgetSession, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginCookieOptions, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/session";
import { isFirebaseClientConfigured } from "@/lib/firebase/config";
import { DEVICE_COOKIE, deviceCookieOptions, MAX_DEVICES, registerDevice } from "@/server/devices";
import { errorMessage } from "@/lib/user-error";

/**
 * Sign in: the ID token becomes the session; the refresh token keeps it alive (see src/proxy.ts).
 * This browser also becomes one of the user's devices — at most two; on a third the user gets the
 * other two back (409 DEVICE_LIMIT) and signs in again with `replaceDeviceId` to remove one.
 */
export async function POST(request: Request) {
  if (!isFirebaseClientConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured." },
      { status: 500 },
    );
  }

  const { idToken, refreshToken, replaceDeviceId } = (await request.json()) as { idToken?: string; refreshToken?: string; replaceDeviceId?: string };
  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  try {
    const { token, userId } = await createSessionCookie(idToken);
    const cookieStore = await cookies();
    const device = await registerDevice(userId, cookieStore.get(DEVICE_COOKIE)?.value, (await headers()).get("user-agent"), typeof replaceDeviceId === "string" ? replaceDeviceId : undefined);
    if (!device.ok) {
      return NextResponse.json({ error: `একসাথে ${MAX_DEVICES}টা device-এ লগইন থাকা যায়। একটা থেকে বের হয়ে তারপর এখানে ঢোকো।`, code: "DEVICE_LIMIT", devices: device.devices }, { status: 409 });
    }
    cookieStore.set(SESSION_COOKIE, token, loginCookieOptions());
    if (refreshToken) cookieStore.set(REFRESH_COOKIE, refreshToken, loginCookieOptions());
    cookieStore.set(DEVICE_COOKIE, device.id, deviceCookieOptions());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "Authentication failed.");
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

/**
 * Sign out of this device only: its cookies go, this server stops trusting the token at once, and
 * its device row is deleted, so a copied cookie stops working too. Refresh tokens are no longer
 * revoked for the whole account — that would sign the user's other device out as well.
 */
export async function DELETE() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (session) {
    const user = await getCurrentUser().catch(() => null);
    forgetSession(session);
    if (user && deviceId) await prisma.userDevice.deleteMany({ where: { id: deviceId, userId: user.id } });
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
  cookieStore.delete(DEVICE_COOKIE);
  return NextResponse.json({ ok: true });
}
