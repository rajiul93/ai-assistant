/**
 * Tells the socket.io server (realtime/) to push an event to some users' rooms. Postgres is the
 * source of truth; this only nudges open browsers to refetch or show a new message at once. Never
 * throws and gives up quickly: if the socket server is down, browsers still catch up by polling.
 */
import type { SharedTimer } from "@/lib/shared-timer";

export type RealtimeEvent =
  | { type: "notify" }
  | { type: "message"; conversationId: string; message: { id: string; senderId: string; body: string; createdAt: string } }
  | { type: "read"; conversationId: string }
  | { type: "friends" }
  | { type: "group_message"; groupId: string; message: GroupMessageEvent }
  /** Members, name or admin changed (or I was added/removed): refetch the group list and details. */
  | { type: "group_changed"; groupId: string }
  /** The shared study timer changed on one of the user's devices (null: stopped). */
  | { type: "timer"; timer: SharedTimer | null };

export type GroupMessageEvent = { id: string; senderId: string | null; kind: "TEXT" | "SYSTEM"; body: string; createdAt: string };

export async function emitTo(userIds: string[], event: RealtimeEvent) {
  const url = process.env.REALTIME_URL;
  const secret = process.env.REALTIME_SECRET;
  if (!url || !secret || !userIds.length) return;
  try {
    await fetch(`${url.replace(/\/$/, "")}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ userIds: [...new Set(userIds)], event }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // The socket server is optional: polling covers for it.
  }
}
