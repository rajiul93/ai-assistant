import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Signed-in devices (owner, 2026-10-15): a user may be signed in on at most MAX_DEVICES browsers
 * or phones at once. Each one keeps its UserDevice id in the httpOnly DEVICE_COOKIE; a third
 * sign-in is refused until the user removes one of the others, and a removed device is signed out
 * on its next request (requireUser). Devices unused for STALE_DAYS stop counting.
 */
export const DEVICE_COOKIE = "prep_device";
export const MAX_DEVICES = 2;
const STALE_DAYS = 30;
// lastSeenAt is written at most this often per device, not on every request.
const TOUCH_EVERY_MS = 60 * 60 * 1000;

export type DeviceInfo = { id: string; label: string; lastSeenAt: string };

/** "Chrome · Android" — enough to tell two devices apart, from the user agent. */
export function deviceLabel(userAgent: string | null) {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "অজানা";
  return `${browser} · ${os}`;
}

/** The user's devices that still count (stale ones are removed first), newest use first. */
export async function liveDevices(userId: string): Promise<DeviceInfo[]> {
  await prisma.userDevice.deleteMany({ where: { userId, lastSeenAt: { lt: new Date(Date.now() - STALE_DAYS * 86_400_000) } } });
  const rows = await prisma.userDevice.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" }, select: { id: true, label: true, lastSeenAt: true } });
  return rows.map((row) => ({ id: row.id, label: row.label, lastSeenAt: row.lastSeenAt.toISOString() }));
}

/**
 * Signs this browser in as a device: keeps its own id if still valid, else adds one when there is
 * room (after removing `replaceId`, one of the user's other devices, if asked). Over the limit it
 * returns the devices to choose from instead.
 */
export async function registerDevice(userId: string, currentId: string | undefined, userAgent: string | null, replaceId?: string) {
  if (currentId && await prisma.userDevice.findFirst({ where: { id: currentId, userId }, select: { id: true } })) {
    await prisma.userDevice.update({ where: { id: currentId }, data: { lastSeenAt: new Date() } });
    return { ok: true as const, id: currentId };
  }
  if (replaceId) await prisma.userDevice.deleteMany({ where: { id: replaceId, userId } });
  const devices = await liveDevices(userId);
  if (devices.length >= MAX_DEVICES) return { ok: false as const, devices };
  const created = await prisma.userDevice.create({ data: { userId, label: deviceLabel(userAgent) }, select: { id: true } });
  return { ok: true as const, id: created.id };
}

/**
 * Whether this browser's device is still signed in — read once per request. Also notes that the
 * device was used (at most hourly), which keeps it from going stale.
 */
export const deviceIsValid = cache(async (userId: string, deviceId: string | undefined) => {
  if (!deviceId) return false;
  const device = await prisma.userDevice.findFirst({ where: { id: deviceId, userId }, select: { lastSeenAt: true } });
  if (!device) return false;
  if (Date.now() - device.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await prisma.userDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return true;
});

export function deviceCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 400 };
}
