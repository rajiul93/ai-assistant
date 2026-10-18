import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanSolution, SOLUTION_MAX, stripCitations } from "@/lib/solution-html";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { can } from "@/server/roles";

/**
 * Each question is looked up on the web and thought through (owner, 2026-10-18: history, years and
 * examples, and they must be right), so the page sends one at a time, a few in parallel.
 */
export const maxDuration = 120;
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
  questions: z.array(z.object({ id: z.string(), solution: z.string().trim().max(SOLUTION_MAX), explanation: z.string().trim().max(SOLUTION_MAX) })),
});

const PROMPT = `তুমি বাংলাদেশের চাকরির পরীক্ষার (BCS, প্রাইমারি, ব্যাংক) অভিজ্ঞ শিক্ষক। প্রতিটা MCQ-এর জন্য বাংলায় "সমাধান" আর "ব্যাখ্যা" লেখো — বইয়ের মতো গুছিয়ে, যাতে শুধু উত্তর নয়, বিষয়টাই শেখা হয়ে যায়।

সঠিক উত্তর:
- correctOption (1 থেকে গোনা) সঠিক উত্তর। সেটাই ঠিক ধরে লিখবে — অন্য option-কে কখনো সঠিক বলবে না।

সমাধান (solution):
- কেন এই উত্তর, ধাপে ধাপে; প্রতিটা ধাপ আলাদা <p>। গণিত হলে শেষ <p>: "∴ উত্তর: …"। তথ্যভিত্তিক প্রশ্নে ১–৩ বাক্যে সরাসরি কারণ।

ব্যাখ্যা (explanation) — বইয়ের একটা ছোট অংশের মতো, উত্তরের বাইরেও পুরো বিষয়টা। নিচের অংশগুলোর মধ্যে এই প্রশ্নে যেগুলো সত্যিই খাটে শুধু সেগুলো, এই ক্রমে, প্রতিটা নিজের <h3> শিরোনামের নিচে:
- <h3>মূল কথা</h3>: বিষয়টা ২–৩ বাক্যে।
- <h3>সাল ও ইতিহাস</h3>: বিষয়ের সাথে সাল, ঘটনা, ব্যক্তি বা প্রতিষ্ঠানের ইতিহাস জড়িত থাকলে তার সময়রেখা — শুরু, গুরুত্বপূর্ণ ধাপ, শেষ বা এখনকার অবস্থা; যাচাই করা যত সাল-ঘটনা পাও (৩–৬টি) সরল টেবিলে, প্রথম সারি "সাল | ঘটনা"। ইতিহাস না থাকলে (যেমন সাধারণ গণিত) এই অংশ বাদ।
- <h3>উদাহরণ</h3>: একই পরিবারের ৩–৫টি উদাহরণ, প্রশ্নের তথ্যটা আবার না বলে — যেমন স্থপতির প্রশ্নে অন্য বিখ্যাত স্থাপনা ও তাদের স্থপতি, ব্যাকরণের নিয়মে একই নিয়মের আরও শব্দ বা বাক্য, গণিতে একই সূত্রের আরেকটা ছোট অঙ্ক।
- <h3>আরও জেনে রাখো</h3>: এই বিষয় থেকে পরীক্ষায় আসতে পারে এমন ৪–৬টি নির্দিষ্ট তথ্য (নাম, সাল, সংখ্যা, স্থান সহ), <ul><li>-তে; সাধারণ কথা নয়।
- <h3>অন্য option</h3>: অন্য option-গুলো কী বা কেন ভুল — প্রতিটার নিজের পরিচয় এক লাইনে (যেমন তিনি কীসের জন্য বিখ্যাত)।
- <h3>মনে রাখার কৌশল</h3>: সহজে মনে রাখার উপায় থাকলে।
- গুরুত্বপূর্ণ নাম, সাল আর সংখ্যা <strong>-এ।

নির্ভুলতা (সবচেয়ে জরুরি):
- নাম, সাল, তারিখ, সংখ্যা আর স্থান যাচাই করে লিখবে; দরকারে কয়েকবার খুঁজবে। যা নিশ্চিত নও তা লিখবে না — ভুল তথ্যের চেয়ে কম তথ্য ভালো।
- লেখায় কোনো link, URL বা সূত্রের তালিকা দেবে না।

লেখার ধরন:
- দুটোই Quill editor-এর সরল HTML: শুধু <h3>, <p>, <strong>, <em>, <ul>/<ol> + <li>, আর টেবিল <table><tbody><tr><td>…</td></tr></tbody></table> (শুধু <td>, ঘরে শুধু লেখা)। কোনো markdown (**, #), style, ছবি বা code fence নয়।
- গণিত সবসময় LaTeX-এ, প্রতিটা রাশির শুরু আর শেষ দুই জায়গাতেই $ দিয়ে: $\\sqrt{2}$, $\\frac{1}{2}$, $x^{2}$, $a\\times b$। কোনো $ বাদ যাবে না, একা $ রাখবে না।
- সহজ, প্রমিত বাংলা; ইংরেজি পরিভাষা দরকার হলে বন্ধনীতে।
- প্রতিটা প্রশ্নের id হুবহু ফেরত দেবে।`;

/** Facts checked on the web first; when search is unavailable, thought through without it. */
async function writeSolutions(input: unknown, userId: string) {
  const questions = `\n\nপ্রশ্নগুলো (JSON):\n${JSON.stringify(input)}`;
  return await callAI(`${PROMPT}\n- Web search দিয়ে তথ্য যাচাই করো।${questions}`, { responseSchema, search: true, userId, feature: "bank_solve", timeoutMs: 80_000, reasoning: "medium" })
    ?? await callAI(`${PROMPT}\n- Web search এখন নেই — নিজের জ্ঞান থেকে ভালো করে ভেবে লেখো; সাল, নাম বা সংখ্যায় একটুও সন্দেহ থাকলে সেটা বাদ দাও।${questions}`, { responseSchema, userId, feature: "bank_solve", timeoutMs: 35_000, reasoning: "medium" });
}

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
  const raw = await writeSolutions(input, user.id);
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
    const keep = (current: string | null, next: string) => (fill === "missing" && current?.trim() ? current : cleanSolution(stripCitations(next)) ?? current);
    return [{ id: original.id, text: original.text, options: original.options, correctIndex: original.correctIndex, solution: keep(original.solution, item.solution), explanation: keep(original.explanation, item.explanation) }];
  });

  const now = new Date();
  await prisma.$transaction(results.map(({ id, solution, explanation }) => prisma.bankQuestion.update({ where: { id }, data: { solution, explanation, editedAt: now } })));
  // The originals come back too, so the page can undo a whole run.
  const undo = wanted.filter((question) => results.some((result) => result.id === question.id)).map(({ id, text, options, correctIndex, solution, explanation }) => ({ id, text, options, correctIndex, solution, explanation }));
  return Response.json({ results, skipped: wanted.length - results.length, originals: undo });
}
