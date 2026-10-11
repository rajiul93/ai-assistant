import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";

const requestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("verb"), word: z.string().trim().min(1).max(80) }),
  z.object({ kind: z.enum(["PREFIX", "SUFFIX"]), word: z.string().trim().min(1).max(40) }),
]);

const verbSchema = {
  type: "OBJECT",
  properties: {
    past: { type: "STRING", description: "Simple past form(s); both if two are standard, e.g. 'learnt / learned'" },
    pastParticiple: { type: "STRING", description: "Past participle form(s), same style" },
    meaning: { type: "STRING", description: "Common Bangla meaning(s), short, e.g. 'যাওয়া'" },
  },
  required: ["past", "pastParticiple", "meaning"],
};

const affixSchema = {
  type: "OBJECT",
  properties: {
    meaning: { type: "STRING", description: "Bangla meaning of the prefix/suffix, short" },
    example: { type: "STRING", description: "One or two example words with Bangla meaning, e.g. 'unhappy — অসুখী, unable — অক্ষম'" },
  },
  required: ["meaning", "example"],
};

const aiError = (blocked: string) => Response.json({ error: blocked === "quota" ? "তোমার AI plan-এর ব্যবহার শেষ।" : "AI ব্যবহার করতে একটা plan লাগবে।" }, { status: 403 });

/** Vocabulary helper: a verb's other forms and meaning, or a prefix/suffix's meaning and examples — for the user to check. */
export async function POST(request: Request) {
  const user = await requireUser();
  const { blocked } = await checkAi(user);
  if (blocked) return aiError(blocked);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "আগে শব্দটা লেখো।" }, { status: 400 });
  const input = parsed.data;

  const verb = input.kind === "verb";
  const prompt = verb
    ? `English verb: "${input.word}". এর simple past আর past participle (দুটো প্রচলিত রূপ থাকলে "learnt / learned" এভাবে দুটোই), আর বাংলা অর্থ (ছোট করে, ক্রিয়াবাচক রূপে যেমন "যাওয়া", "খাওয়া"; একাধিক প্রচলিত অর্থ হলে কমা দিয়ে)। এটা verb না হলে বা চেনা না গেলে সব ফাঁকা রাখো।`
    : `English ${input.kind === "PREFIX" ? "prefix" : "suffix"}: "${input.word}". এর বাংলা অর্থ বা কাজ ছোট করে (যেমন un- → "না/বিপরীত", -less → "হীন/ছাড়া"), আর ১–২টা উদাহরণ শব্দ বাংলা অর্থসহ ("unhappy — অসুখী" এভাবে, কমা দিয়ে)। এটা প্রচলিত ${input.kind === "PREFIX" ? "prefix" : "suffix"} না হলে সব ফাঁকা রাখো।`;
  const raw = await callAI(prompt, { responseSchema: verb ? verbSchema : affixSchema, userId: user.id, feature: "file_assistant", timeoutMs: 30_000 });
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে উত্তর দিতে পারল না।" }, { status: 502 });
  try {
    const fields = z.record(z.string(), z.string()).parse(JSON.parse(raw));
    const filled = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim().slice(0, 300)]));
    if (!filled.meaning) return Response.json({ error: `“${input.word}” চেনা গেল না।` }, { status: 422 });
    return Response.json(filled);
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না।" }, { status: 502 });
  }
}
