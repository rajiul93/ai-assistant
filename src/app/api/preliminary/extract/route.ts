import { requireUser } from "@/lib/auth";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { checkAi } from "@/server/ai-access";
import { extractMcqs, mcqExtractRequestSchema } from "@/server/preliminary-extract";

// A page of ~20 questions takes 10–30 s to read.
export const maxDuration = 120;

/** Reads one page of MCQs (its tiles, or a PDF) and returns the questions with the marked answers. */
export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  // Each page is read twice; the photo's scanId makes that one scan of the day's limit.
  const { blocked } = await checkAi(user, "scan", typeof body?.scanId === "string" ? body.scanId : undefined);
  if (blocked) return Response.json({ error: aiBlockedMessage(blocked) }, { status: 403 });
  const parsed = mcqExtractRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "শুধু ছবি (JPG, PNG, WebP) বা PDF পড়া যায়।" }, { status: 400 });
  const result = await extractMcqs(parsed.data, user.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
