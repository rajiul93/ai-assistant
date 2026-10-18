import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { prisma } from "@/lib/prisma";
import { SENTENCE_COUNT, sentencePlan, sentenceSchema, type Sentence } from "@/lib/vocabulary/sentences";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { can } from "@/server/roles";

export const maxDuration = 60;

const requestSchema = z.object({ kind: z.enum(["VERB", "NOUN", "AFFIX"]), id: z.string().min(1).max(64) });

const responseSchema = {
  type: "OBJECT",
  properties: {
    sentences: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { form: { type: "STRING" }, en: { type: "STRING" }, bn: { type: "STRING" } }, required: ["form", "en", "bn"] },
    },
  },
  required: ["sentences"],
};

const RULES = `নিয়ম:
- ঠিক ${SENTENCE_COUNT}টা বাক্য, নিচের ক্রমে — প্রতিটা বাক্যে বলা রূপটাই (form) হুবহু ব্যবহার করবে।
- সহজ, স্বাভাবিক, ব্যাকরণে নির্ভুল English; ৬–১৪ শব্দ; প্রতিদিনের জীবন, পড়াশোনা বা চাকরির পরিবেশ থেকে। একই ধরনের বাক্য বারবার নয়।
- verb-এর past/past participle রূপ ঠিক tense-এ (past participle হলে have/has/had বা passive দিয়ে)।
- bn: বাক্যটার স্বাভাবিক, প্রমিত বাংলা অনুবাদ।
- form: বাক্যে যে রূপ/শব্দটা ব্যবহার হয়েছে, হুবহু।
- কোনো markdown, উদ্ধৃতি চিহ্ন বা নম্বর নয়।`;

/**
 * Writes six example sentences (with Bangla) for one vocabulary word with AI and saves them on the
 * word, so every paid user can read them. Staff with the Vocabulary permission only.
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
  let plan: string[] = [];
  if (kind === "VERB") {
    const verb = await prisma.verbEntry.findUnique({ where: { id }, select: { present: true, past: true, pastParticiple: true, meaning: true } });
    if (verb) {
      plan = sentencePlan({ kind, ...verb });
      about = `English verb "${verb.present}" (past: ${verb.past}, past participle: ${verb.pastParticiple}; বাংলা: ${verb.meaning})। ক্রম: ২টা "${verb.present}" দিয়ে, ২টা "${verb.past}" দিয়ে, ২টা "${verb.pastParticiple}" দিয়ে (দুই রকম রূপ থাকলে যেকোনো একটা)।`;
    }
  } else if (kind === "NOUN") {
    const noun = await prisma.nounEntry.findUnique({ where: { id }, select: { singular: true, plural: true, meaning: true } });
    if (noun) {
      plan = sentencePlan({ kind, ...noun });
      const both = new Set(plan).size > 1;
      about = `English noun (singular: ${noun.singular}, plural: ${noun.plural}; "-" মানে সেই রূপ নেই; বাংলা: ${noun.meaning})। ক্রম: ${both ? `৩টা "${plan[0]}" দিয়ে, তারপর ৩টা "${plan[3]}" দিয়ে` : `৬টাই "${plan[0]}" দিয়ে`}।`;
    }
  } else {
    const affix = await prisma.affixEntry.findUnique({ where: { id }, select: { kind: true, affix: true, meaning: true, example: true } });
    if (affix) {
      plan = sentencePlan({ kind, affix: affix.affix });
      about = `English ${affix.kind === "PREFIX" ? "prefix" : "suffix"} "${affix.affix}" (বাংলা: ${affix.meaning}; উদাহরণ: ${affix.example || "নেই"})। ৬টা আলাদা প্রচলিত শব্দ নাও যেগুলো এই ${affix.kind === "PREFIX" ? "prefix" : "suffix"} দিয়ে তৈরি — প্রতিটা দিয়ে একটা বাক্য; form-এ সেই শব্দটা।`;
    }
  }
  if (!about) return Response.json({ error: "শব্দটা পাওয়া যায়নি।" }, { status: 404 });

  const raw = await callAI(`তুমি বাংলাদেশের চাকরির পরীক্ষার English শিক্ষক। এই শব্দ দিয়ে উদাহরণ বাক্য লেখো: ${about}\n\n${RULES}`, { responseSchema, userId: user.id, feature: "vocab_explain", timeoutMs: 50_000, reasoning: "low" });
  let sentences: Sentence[] | null = null;
  try {
    const written = z.object({ sentences: z.array(sentenceSchema) }).parse(JSON.parse(raw ?? "")).sentences;
    // Verbs and nouns keep the planned form as the label; a prefix/suffix keeps the word it used.
    if (written.length >= SENTENCE_COUNT) sentences = written.slice(0, SENTENCE_COUNT).map((sentence, index) => (kind === "AFFIX" ? sentence : { ...sentence, form: plan[index] }));
  } catch {
    sentences = null;
  }
  if (!sentences) return Response.json({ error: "AI এই মুহূর্তে বাক্য লিখতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });

  const data = { sentences };
  if (kind === "VERB") await prisma.verbEntry.update({ where: { id }, data });
  else if (kind === "NOUN") await prisma.nounEntry.update({ where: { id }, data });
  else await prisma.affixEntry.update({ where: { id }, data });
  revalidatePath("/vocabulary");
  return Response.json({ sentences });
}
