import { requireUser } from "@/lib/auth";
import { checkAi } from "@/server/ai-access";
import { extractShortQuestionsFromText, shortTextRequestSchema } from "@/server/short-question-extract";

export const maxDuration = 60;

/** Pasted question–answer text in a shape the page's own parser couldn't follow → pairs, via AI. */
export async function POST(request: Request) {
  const user = await requireUser();
  const { blocked } = await checkAi(user);
  if (blocked) return Response.json({ error: blocked === "quota" ? "তোমার AI plan-এর ব্যবহার শেষ।" : "AI ব্যবহার করতে একটা plan লাগবে।" }, { status: 403 });
  const parsed = shortTextRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "লেখাটা খুব বড় বা খালি।" }, { status: 400 });
  const result = await extractShortQuestionsFromText(parsed.data.text, user.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
