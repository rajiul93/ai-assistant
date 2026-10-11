import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived tokens that let a browser join its own room on the socket.io server (realtime/).
 * The Next app signs them (it knows who is signed in); the socket server only checks them, so it
 * needs neither the database nor Firebase. Shared by both sides — no "@/" imports here, because
 * realtime/server.ts loads this file directly with Node.
 *
 * Format: "<userId>.<expiresAtMs>.<base64url HMAC-SHA256 of the first two parts>".
 */

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signRealtimeToken(userId: string, secret: string, ttlMs = 10 * 60_000, now = Date.now()) {
  const payload = `${userId}.${now + ttlMs}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The user id inside a valid, unexpired token; null for anything else. */
export function verifyRealtimeToken(token: unknown, secret: string, now = Date.now()) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const expected = Buffer.from(sign(`${userId}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) < now) return null;
  return userId || null;
}
