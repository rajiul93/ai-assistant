import { requireUser } from "@/lib/auth";
import { signRealtimeToken } from "@/lib/realtime-token";

/**
 * A 10-minute token for the socket.io server (realtime/), proving which user this browser is.
 * Without a configured socket server the browser just polls.
 */
export async function GET() {
  const user = await requireUser();
  const secret = process.env.REALTIME_SECRET;
  const url = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (!secret || !url) return Response.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  return Response.json({ enabled: true, url, userId: user.id, token: signRealtimeToken(user.id, secret) }, { headers: { "Cache-Control": "no-store" } });
}
