import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isRichHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { can } from "@/server/roles";

/** A few questions per call keeps each AI answer well inside the time limit. */
export const maxDuration = 60;
const MAX_PER_CALL = 4;

const requestSchema = z.object({
  questionIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_PER_CALL),
  /** "preview": return the cleaned text for an admin to check; "save": store it at once (many at a time). */
  mode: z.enum(["preview", "save"]),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          text: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          solution: { type: "STRING", nullable: true },
          explanation: { type: "STRING", nullable: true },
        },
        required: ["id", "text", "options", "solution", "explanation"],
      },
    },
  },
  required: ["questions"],
};

const cleanedSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    text: z.string().trim().min(1).max(2000),
    options: z.array(z.string().trim().min(1).max(500)),
    solution: z.string().trim().max(5000).nullable(),
    explanation: z.string().trim().max(5000).nullable(),
  })),
});

const PROMPT = `তুমি বাংলাদেশের চাকরির পরীক্ষার MCQ পরিষ্কার করো। এগুলো কোনো ওয়েবসাইট থেকে কপি করা, তাই গণিত নষ্ট হয়ে আছে: প্রতিটা সূত্র পাশাপাশি দুই-তিনবার এসেছে — একবার সাধারণ লেখায়, একবার LaTeX-এ, আবার সাধারণ লেখায়। যেমন "x−1x=1x - \\frac{1}{x} = 1x−1​=1" আসলে একটাই সূত্র: $x-\\frac{1}{x}=1$; "6a2bc6a^2bc6a2bc" আসলে $6a^2bc$।

নিয়ম:
- প্রতিটা গাণিতিক রাশি একবারই লিখবে, LaTeX-এ, $…$-এর ভেতরে (ভগ্নাংশ \\frac{}{}, বর্গমূল \\sqrt{}, ঘাত ^{}, গুণ \\times, ভাগ \\div, তাই \\therefore)। সাধারণ সংখ্যা একা থাকলে (যেমন option "4") $ লাগবে না।
- প্রশ্ন আর option-এর ভাষা, শব্দ, সংখ্যা, অর্থ একটুও বদলাবে না — শুধু ডুপ্লিকেট সরাবে আর গণিত LaTeX-এ লিখবে। কোন option সঠিক তা বদলানো যাবে না; option-এর সংখ্যা আর ক্রম একই থাকবে।
- সমাধান: পড়ার মতো করে সাজাও — প্রতিটা ধাপ আলাদা লাইনে (লাইন ভাঙতে \\n), গণিত $…$-এ, ভাষা বাংলা। নতুন তথ্য বানাবে না, উত্তর বদলাবে না; শুধু যা আছে তা গুছিয়ে লিখবে। ভুল/অসম্পূর্ণ মনে হলে যতটুকু আছে ততটুকুই গুছাবে।
- ব্যাখ্যা থাকলে একই নিয়মে গুছাবে; না থাকলে null।
- কোনো markdown (**, #), HTML বা code fence নয়।
- প্রতিটা প্রশ্নের id হুবহু ফেরত দেবে।

প্রশ্নগুলো (JSON):
`;

/**
 * Question Bank clean-up with AI, for admins: removes the duplicated copies of each formula that
 * came from copying rendered math, writes math as LaTeX ($…$), and lays out the solution step by
 * step. The question's meaning, its options and the right answer are never changed.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await can(user, "question_bank"))) return Response.json({ error: "এটা করতে প্রশ্ন ব্যাংক permission লাগবে।" }, { status: 403 });
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) return Response.json({ error: "AI এখন ব্যবহার করা যাচ্ছে না।" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "কোন প্রশ্ন, বোঝা গেল না।" }, { status: 400 });
  const { questionIds, mode } = parsed.data;

  const originals = await prisma.bankQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true },
  });
  if (!originals.length) return Response.json({ error: "প্রশ্ন পাওয়া যায়নি।" }, { status: 404 });

  // A book-style (HTML) solution or explanation is already laid out: it is not sent, and is kept as it is.
  const plain = (value: string | null) => (value && !isRichHtml(value) ? value : null);
  const input = originals.map(({ id, text, options, correctIndex, solution, explanation }) => ({ id, text, options, correctOption: correctIndex + 1, solution: plain(solution), explanation: plain(explanation) }));
  const raw = await callAI(PROMPT + JSON.stringify(input), { responseSchema, userId: user.id, feature: "bank_beautify", timeoutMs: 55_000 });
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে উত্তর দিতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });

  let cleaned: z.infer<typeof cleanedSchema>["questions"];
  try {
    cleaned = cleanedSchema.parse(JSON.parse(raw)).questions;
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না।" }, { status: 502 });
  }

  // Only answers that keep the question's shape are used; anything odd keeps the original.
  const byId = new Map(originals.map((question) => [question.id, question]));
  const results = cleaned.flatMap((question) => {
    const original = byId.get(question.id);
    if (!original || question.options.length !== original.options.length) return [];
    // A solution or explanation the AI dropped (or was never sent) is kept as it was, never lost.
    const tidied = (current: string | null, next: string | null) => (next && (!current || plain(current)) ? next : current);
    return [{ id: original.id, text: question.text, options: question.options, correctIndex: original.correctIndex, solution: tidied(original.solution, question.solution), explanation: tidied(original.explanation, question.explanation) }];
  });
  const skipped = originals.length - results.length;

  if (mode === "save") {
    const now = new Date();
    await prisma.$transaction(results.map(({ id, ...data }) => prisma.bankQuestion.update({ where: { id }, data: { ...data, editedAt: now } })));
  }
  // The originals come back too, so the page can undo a whole run.
  return Response.json({ results, skipped, originals: mode === "save" ? originals.filter((question) => results.some((result) => result.id === question.id)) : [] });
}
