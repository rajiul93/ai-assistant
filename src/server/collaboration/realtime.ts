/**
 * Tells the socket.io server (realtime/) to push an event to some users' rooms. Postgres is the
 * source of truth; this only nudges open browsers to refetch or show a new message at once. Never
 * throws and gives up quickly: if the socket server is down, browsers still catch up by polling.
 */
export type RealtimeEvent =
  | { type: "notify" }
  | { type: "message"; conversationId: string; message: { id: string; senderId: string; body: string; createdAt: string } }
  | { type: "read"; conversationId: string }
  | { type: "friends" };

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
