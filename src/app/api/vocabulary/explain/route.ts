import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { prisma } from "@/lib/prisma";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { can } from "@/server/roles";

export const maxDuration = 60;

const requestSchema = z.object({ kind: z.enum(["VERB", "NOUN", "AFFIX"]), id: z.string().min(1).max(64) });

const RULES = `- বাংলায় লেখো, ছাত্রছাত্রী যেন সহজে বোঝে; English শব্দ English-এই রাখো।
- প্রথম লাইনে মূল অর্থ (একাধিক প্রচলিত অর্থ থাকলে কোনটা কখন)।
- তারপর কখন/কীভাবে ব্যবহার হয়, ২–৩ লাইনে।
- ২টা উদাহরণ বাক্য: প্রতিটা "• English sentence — বাংলা অনুবাদ" এভাবে।
- দরকার হলে সমার্থক/বিপরীত শব্দ, বা পরীক্ষায় যে ভুলটা বেশি হয়, এক লাইনে।
- মোট ৮ লাইনের মধ্যে। কোনো markdown (**, #), HTML বা শিরোনাম নয়; লাইন ভাঙতে নতুন লাইন।`;

/**
 * Explains one vocabulary word in Bangla with AI and saves it on the word, so every paid user can
 * read it (the list hides it from others). Staff with the Vocabulary permission only.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await can(user, "vocabulary"))) return Response.json({ error: "এটা করতে শব্দভান্ডার permission লাগবে।" }, { status: 403 });
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) return Response.json({ error: aiBlockedMessage(blocked) }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "কোন শব্দ, বোঝা গেল না।" }, { status: 400 });
  const { kind, id } = parsed.data;

  let about: string | null = null;
  if (kind === "VERB") {
    const verb = await prisma.verbEntry.findUnique({ where: { id }, select: { present: true, past: true, pastParticiple: true, meaning: true } });
    if (verb) about = `English verb "${verb.present}" (past: ${verb.past}, past participle: ${verb.pastParticiple}; বাংলা: ${verb.meaning})। এর তিন রূপ কখন ব্যবহার হয় তাও এক লাইনে বলো।`;
  } else if (kind === "NOUN") {
    const noun = await prisma.nounEntry.findUnique({ where: { id }, select: { singular: true, plural: true, meaning: true } });
    if (noun) about = `English noun "${noun.singular === "-" ? noun.plural : noun.singular}" (singular: ${noun.singular}, plural: ${noun.plural}; "-" মানে সেই রূপ নেই; বাংলা: ${noun.meaning})। plural-এর নিয়মটাও এক লাইনে বলো।`;
  } else {
    const affix = await prisma.affixEntry.findUnique({ where: { id }, select: { kind: true, affix: true, meaning: true, example: true } });
    if (affix) about = `English ${affix.kind === "PREFIX" ? "prefix" : "suffix"} "${affix.affix}" (বাংলা: ${affix.meaning}; উদাহরণ: ${affix.example || "নেই"})। উদাহরণ বাক্যের বদলে ৩–৪টা শব্দ এই ${affix.kind === "PREFIX" ? "prefix" : "suffix"} দিয়ে, বাংলা অর্থসহ দাও।`;
  }
  if (!about) return Response.json({ error: "শব্দটা পাওয়া যায়নি।" }, { status: 404 });

  const raw = await callAI(`তুমি বাংলাদেশের চাকরির পরীক্ষার English শিক্ষক। এই শব্দটা বুঝিয়ে দাও: ${about}\n\n${RULES}`, { userId: user.id, feature: "vocab_explain", timeoutMs: 45_000 });
  const explanation = raw?.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim().slice(0, 3000);
  if (!explanation) return Response.json({ error: "AI এই মুহূর্তে উত্তর দিতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });

  const data = { explanation };
  if (kind === "VERB") await prisma.verbEntry.update({ where: { id }, data });
  else if (kind === "NOUN") await prisma.nounEntry.update({ where: { id }, data });
  else await prisma.affixEntry.update({ where: { id }, data });
  revalidatePath("/vocabulary");
  return Response.json({ explanation });
}
