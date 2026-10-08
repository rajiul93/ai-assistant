import { requireUser } from "@/lib/auth";
import { checkAi } from "@/server/ai-access";
import { shortSpellCheckRequestSchema, spellCheckShortQuestions } from "@/server/short-question-extract";

/** After a page is read: which questions/answers hold a word that doesn't look like real Bangla. */
export async function POST(request: Request) {
  const user = await requireUser();
  if ((await checkAi(user)).blocked) return Response.json({ suspicious: [] });
  const parsed = shortSpellCheckRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json({ suspicious: await spellCheckShortQuestions(parsed.data, user.id) });
}
