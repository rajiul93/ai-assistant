import { requireUser } from "@/lib/auth";
import { liveCounts } from "@/server/collaboration/live";

/** Bell, Messages badge and pending requests, for the shell's polling (a fallback to socket.io pushes). */
export async function GET() {
  const user = await requireUser();
  return Response.json(await liveCounts(user.id), { headers: { "Cache-Control": "no-store" } });
}
