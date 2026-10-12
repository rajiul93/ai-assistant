import { prisma } from "@/lib/prisma";

/**
 * Public keep-alive ping for an outside cron (e.g. cron-job.org every 4 minutes): one `SELECT 1`
 * stops Neon from scaling to zero, so the first real request doesn't wait ~3s for it to wake up.
 * It reads no user data, so it needs no sign-in.
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, dbMs: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
