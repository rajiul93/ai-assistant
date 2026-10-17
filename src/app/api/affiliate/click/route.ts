import { recordAffiliateClick } from "@/server/affiliate";

/**
 * One visit through an affiliate link, reported by the route guard (src/proxy.ts) — public, since
 * the visitor usually isn't signed in. Only counts for a code whose owner can earn.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  if (typeof body?.code === "string") await recordAffiliateClick(body.code).catch(() => undefined);
  return new Response(null, { status: 204 });
}
