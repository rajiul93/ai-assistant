import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { forgetSession, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/session";
import { DEVICE_COOKIE, deviceCookieOptions, registerDevice } from "@/server/devices";

/**
 * Where requireUser sends a browser whose device isn't (or is no longer) signed in. A browser
 * signed in before devices were counted is registered here if there is room; one that was removed
 * from the user's other device, or that has no room, is signed out and sent to the login page with
 * the reason (`?device=removed` / `?device=limit`).
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const signOut = (reason: "removed" | "limit") => {
    const session = cookieStore.get(SESSION_COOKIE)?.value;
    if (session) forgetSession(session);
    const response = NextResponse.redirect(new URL(`/login?device=${reason}`, request.url));
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    response.cookies.delete(DEVICE_COOKIE);
    return response;
  };

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  // It had a device and that device is gone: it was signed out from the other device.
  if (deviceId) {
    const still = await prisma.userDevice.findFirst({ where: { id: deviceId, userId: user.id }, select: { id: true } });
    return still ? NextResponse.redirect(new URL("/dashboard", request.url)) : signOut("removed");
  }
  const device = await registerDevice(user.id, undefined, (await headers()).get("user-agent"));
  if (!device.ok) return signOut("limit");
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(DEVICE_COOKIE, device.id, deviceCookieOptions());
  return response;
}
