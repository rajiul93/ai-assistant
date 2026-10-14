import { requireUser } from "@/lib/auth";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { checkAi } from "@/server/ai-access";
import { extractShortQuestions, shortExtractRequestSchema } from "@/server/short-question-extract";

// A page of ~20 questions takes 10–30 s to read.
export const maxDuration = 120;

/** Reads one page of short questions (its tiles, or a PDF) and returns each question with the answer printed on it. */
export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  // Each page is read twice; the photo's scanId makes that one scan of the day's limit.
  const { blocked } = await checkAi(user, "scan", typeof body?.scanId === "string" ? body.scanId : undefined);
  if (blocked) return Response.json({ error: aiBlockedMessage(blocked) }, { status: 403 });
  const parsed = shortExtractRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "শুধু ছবি (JPG, PNG, WebP) বা PDF পড়া যায়।" }, { status: 400 });
  const result = await extractShortQuestions(parsed.data, user.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
