import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { can } from "@/server/roles";

export const maxDuration = 60;
/** New questions per call; the page sends a set in groups of this many. */
const PER_CALL = 25;
/** The chapter's questions the AI compares against (first ones by order) — keeps the prompt sane. */
const MAX_EXISTING = 600;

const requestSchema = z.object({
  chapterId: z.string().min(1).max(64),
  questionIds: z.array(z.string().min(1).max(64)).min(1).max(PER_CALL),
  /** One id for a whole move: it counts once toward the day's AI limit. */
  batch: z.string().min(1).max(64),
});

const responseSchema = {
  type: "OBJECT",
  properties: { matches: { type: "ARRAY", items: { type: "OBJECT", properties: { n: { type: "INTEGER" }, e: { type: "INTEGER" } }, required: ["n", "e"] } } },
  required: ["matches"],
};
const answerSchema = z.object({ matches: z.array(z.object({ n: z.number().int(), e: z.number().int() })) });

const PROMPT = `দুটো MCQ তালিকা আছে: E (chapter-এ আগে থেকে আছে) আর N (নতুন, chapter-এ আনা হবে)। প্রতিটা N প্রশ্নের জন্য দেখো E-তে একই প্রশ্ন আছে কিনা।
"একই" মানে: একই জিনিস জিজ্ঞেস করছে আর উত্তরও একই — ভাষা একটু আলাদা, বানান, যতিচিহ্ন, প্রশ্নের নম্বর বা option-এর ক্রম আলাদা হলেও। শুধু বিষয় এক হলে (যেমন দুটোই "সন্ধি" নিয়ে, কিন্তু আলাদা শব্দ) একই নয়; সংখ্যা/সাল/নাম আলাদা হলে একই নয়।
প্রতিটা N-এর জন্য একটা match দাও: n = N-এর নম্বর, e = মিলে যাওয়া E-এর নম্বর, না মিললে e = 0। নিশ্চিত না হলে 0।

`;

const line = (text: string, options: string[], correctIndex: number) => `${text.replace(/\s+/g, " ").slice(0, 220)} | উত্তর: ${(options[correctIndex] ?? "").slice(0, 80)}`;

/**
 * Staff moving MCQs into a General chapter: which of them the chapter already has. Word-for-word
 * copies are found by fingerprint; the rest are compared by AI, so the same question worded a bit
 * differently is caught too. Nothing changes here — the page shows the duplicates for the admin to
 * confirm before moving (moveQuestionsToChapter).
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await can(user, "question_bank"))) return Response.json({ error: "এটা করতে প্রশ্ন ব্যাংক permission লাগবে।" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "কোন প্রশ্ন, বোঝা গেল না।" }, { status: 400 });
  const { chapterId, questionIds, batch } = parsed.data;

  const select = { id: true, text: true, options: true, correctIndex: true, fingerprint: true } as const;
  const [incoming, existing] = await Promise.all([
    prisma.bankQuestion.findMany({ where: { id: { in: questionIds } }, select }),
    prisma.bankQuestion.findMany({ where: { chapterId, id: { notIn: questionIds } }, orderBy: [{ serial: "asc" }, { id: "asc" }], take: MAX_EXISTING, select }),
  ]);
  const byPrint = new Map(existing.map((question) => [question.fingerprint, question]));
  const brief = (question: (typeof existing)[number]) => ({ id: question.id, text: question.text, answer: question.options[question.correctIndex] ?? "" });

  const results = new Map<string, { duplicateOf: ReturnType<typeof brief> | null; exact: boolean }>();
  for (const question of incoming) {
    const same = byPrint.get(question.fingerprint);
    if (same) results.set(question.id, { duplicateOf: brief(same), exact: true });
  }
  const unsure = incoming.filter((question) => !results.has(question.id));

  if (unsure.length && existing.length) {
    const { blocked } = await checkAi(user, "suggestion", `bank-dupes:${batch}`);
    if (blocked) return Response.json({ error: "AI এখন ব্যবহার করা যাচ্ছে না।" }, { status: 403 });
    const prompt = `${PROMPT}E:\n${existing.map((question, index) => `E${index + 1}: ${line(question.text, question.options, question.correctIndex)}`).join("\n")}\n\nN:\n${unsure.map((question, index) => `N${index + 1}: ${line(question.text, question.options, question.correctIndex)}`).join("\n")}`;
    const raw = await callAI(prompt, { responseSchema, userId: user.id, feature: "bank_dupes", timeoutMs: 55_000, reasoning: "low" });
    if (!raw) return Response.json({ error: "AI এই মুহূর্তে মিলিয়ে দেখতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });
    try {
      for (const match of answerSchema.parse(JSON.parse(raw)).matches) {
        const question = unsure[match.n - 1];
        const same = existing[match.e - 1];
        if (question && same && !results.has(question.id)) results.set(question.id, { duplicateOf: brief(same), exact: false });
      }
    } catch {
      return Response.json({ error: "AI-এর উত্তর বোঝা গেল না। আবার চেষ্টা করো।" }, { status: 502 });
    }
  }

  return Response.json({
    results: incoming.map((question) => ({ id: question.id, text: question.text, answer: question.options[question.correctIndex] ?? "", ...(results.get(question.id) ?? { duplicateOf: null, exact: false }) })),
  });
}
