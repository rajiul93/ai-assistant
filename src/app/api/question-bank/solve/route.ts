import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { can } from "@/server/roles";

/** A few questions per call keeps each AI answer well inside the time limit. */
export const maxDuration = 60;
const MAX_PER_CALL = 4;

const requestSchema = z.object({
  questionIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_PER_CALL),
  /** "missing": fill only an empty solution/explanation; "all": write both again. */
  fill: z.enum(["missing", "all"]),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { id: { type: "STRING" }, solution: { type: "STRING" }, explanation: { type: "STRING" } },
        required: ["id", "solution", "explanation"],
      },
    },
  },
  required: ["questions"],
};

const writtenSchema = z.object({
  questions: z.array(z.object({ id: z.string(), solution: z.string().trim().max(5000), explanation: z.string().trim().max(5000) })),
});

const PROMPT = `তুমি বাংলাদেশের চাকরির পরীক্ষার (BCS, প্রাইমারি, ব্যাংক) অভিজ্ঞ শিক্ষক। প্রতিটা MCQ-এর জন্য বাংলায় "সমাধান" আর "ব্যাখ্যা" লেখো।

- সঠিক উত্তর দেওয়া আছে (correctOption, 1 থেকে গোনা)। সেটাই ঠিক ধরে লিখবে — অন্য option-কে কখনো সঠিক বলবে না।
- সমাধান: কেন এই উত্তর, ধাপে ধাপে। গণিত হলে প্রতিটা ধাপ আলাদা লাইনে (লাইন ভাঙতে \\n), শেষ লাইনে "∴ উত্তর: …"। তথ্যভিত্তিক প্রশ্নে ১–৩ লাইনে সরাসরি কারণ।
- ব্যাখ্যা: পরীক্ষায় কাজে লাগে এমন প্রাসঙ্গিক তথ্য, সূত্র বা মনে রাখার কৌশল, ২–৪ লাইনে। অন্য option-গুলো কেন ভুল তা দরকার হলে ছোট করে বলো।
- গণিত সবসময় LaTeX-এ, প্রতিটা রাশির শুরু আর শেষ দুই জায়গাতেই $ দিয়ে: $\\sqrt{2}$, $\\frac{1}{2}$, $x^{2}$, $a\\times b$। কোনো $ বাদ যাবে না, একা $ রাখবে না।
- নিশ্চিত না হলে বানিয়ে তথ্য দেবে না; যতটুকু নিশ্চিত ততটুকু লিখবে।
- কোনো markdown (**, #, *, -), HTML বা code fence নয়; তালিকা লাগলে লাইনের শুরুতে "• "।
- প্রতিটা প্রশ্নের id হুবহু ফেরত দেবে।

প্রশ্নগুলো (JSON):
`;

/**
 * Writes a solution and an explanation for Question Bank questions with AI, for admins. The
 * question, its options and the right answer are sent but never changed; with `fill: "missing"`
 * a solution or explanation that is already there is kept as it is.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await can(user, "question_bank"))) return Response.json({ error: "এটা করতে প্রশ্ন ব্যাংক permission লাগবে।" }, { status: 403 });
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) return Response.json({ error: "AI এখন ব্যবহার করা যাচ্ছে না।" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "কোন প্রশ্ন, বোঝা গেল না।" }, { status: 400 });
  const { questionIds, fill } = parsed.data;

  const originals = await prisma.bankQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, set: { select: { section: true } }, chapter: { select: { name: true, subject: { select: { name: true } } } } },
  });
  const wanted = fill === "all" ? originals : originals.filter((question) => !question.solution?.trim() || !question.explanation?.trim());
  if (!wanted.length) return Response.json({ results: [], skipped: 0, originals: [] });

  const input = wanted.map(({ id, text, options, correctIndex, set, chapter }) => ({ id, subject: set?.section ?? (chapter ? `${chapter.subject.name} › ${chapter.name}` : ""), question: text, options, correctOption: correctIndex + 1 }));
  const raw = await callAI(PROMPT + JSON.stringify(input), { responseSchema, userId: user.id, feature: "bank_solve", timeoutMs: 55_000, reasoning: "low" });
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে উত্তর দিতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });

  let written: z.infer<typeof writtenSchema>["questions"];
  try {
    written = writtenSchema.parse(JSON.parse(raw)).questions;
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না।" }, { status: 502 });
  }

  const byId = new Map(wanted.map((question) => [question.id, question]));
  const results = written.flatMap((item) => {
    const original = byId.get(item.id);
    if (!original) return [];
    const keep = (current: string | null, next: string) => (fill === "missing" && current?.trim() ? current : next || current);
    return [{ id: original.id, text: original.text, options: original.options, correctIndex: original.correctIndex, solution: keep(original.solution, item.solution), explanation: keep(original.explanation, item.explanation) }];
  });

  const now = new Date();
  await prisma.$transaction(results.map(({ id, solution, explanation }) => prisma.bankQuestion.update({ where: { id }, data: { solution, explanation, editedAt: now } })));
  // The originals come back too, so the page can undo a whole run.
  const undo = wanted.filter((question) => results.some((result) => result.id === question.id)).map(({ id, text, options, correctIndex, solution, explanation }) => ({ id, text, options, correctIndex, solution, explanation }));
  return Response.json({ results, skipped: wanted.length - results.length, originals: undo });
}
