import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { can } from "@/server/roles";

/** One piece of pasted text (lib/question-bank `chunkPastedText`) per call keeps each answer inside the limit. */
export const maxDuration = 60;

const requestSchema = z.object({
  kind: z.enum(["mcq", "short"]),
  text: z.string().trim().min(1).max(8000),
  /** The same id for every piece of one paste: it counts once toward the day's AI limit. */
  batch: z.string().min(1).max(64),
});

const mcqSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          solution: { type: "STRING", nullable: true },
          explanation: { type: "STRING", nullable: true },
        },
        required: ["text", "options", "correctIndex", "solution", "explanation"],
      },
    },
  },
  required: ["questions"],
};

const shortSchema = {
  type: "OBJECT",
  properties: {
    questions: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, answer: { type: "STRING" } }, required: ["question", "answer"] } },
  },
  required: ["questions"],
};

const mcqAnswer = z.object({
  questions: z.array(z.object({
    text: z.string(),
    options: z.array(z.string()),
    correctIndex: z.number().int(),
    solution: z.string().nullable(),
    explanation: z.string().nullable(),
  })).max(300),
});
const shortAnswer = z.object({ questions: z.array(z.object({ question: z.string(), answer: z.string() })).max(300) });

const MCQ_PROMPT = `নিচের লেখাটা কেউ কোনো বই, গাইড বা ওয়েবসাইট থেকে কপি করে paste করেছে — এতে MCQ প্রশ্ন আছে, যেকোনো ছাঁদে (নম্বর দিয়ে বা ছাড়া; option ক/খ/গ/ঘ, a/b/c/d, 1/2/3/4, এক লাইনে বা আলাদা লাইনে; উত্তর "উত্তর: খ", "Ans: b", "সঠিক উত্তর: …", option-এর পাশে ✓ বা টিক, বা শেষে উত্তরমালা)। প্রতিটা প্রশ্ন আলাদা করে বের করো, যে ক্রমে আছে সেই ক্রমে, একটাও বাদ দেবে না।
- text: প্রশ্নটা হুবহু, শুরুর নম্বর (১., 2), প্রশ্ন-৩) বাদ দিয়ে।
- options: ৪টা (থাকলে ৫টা) option হুবহু, "ক)"/"(a)" জাতীয় লেবেল বাদ দিয়ে।
- correctIndex: লেখায় যে উত্তর দেওয়া আছে সেটা কোন option (০ থেকে গোনা)। লেখায় উত্তর না থাকলে -1 — নিজে উত্তর ঠিক করবে না।
- solution / explanation: লেখায় সমাধান বা ব্যাখ্যা থাকলে হুবহু (ধাপগুলো আলাদা লাইনে, \\n দিয়ে), না থাকলে null। "সঠিক উত্তর: …" লাইনটা সমাধানে রাখবে না।
- ওয়েবসাইট থেকে কপি করা গণিত প্রায়ই দুই-তিনবার পাশাপাশি আসে (যেমন "x2x^2x2") — সেটা একবার, LaTeX-এ $…$-এর ভেতরে লিখবে ($x^2$, $\\frac{1}{2}$, $\\sqrt{3}$)।
- এ ছাড়া একটা শব্দও বদলাবে না, বানান ঠিক করবে না, নতুন কিছু বানাবে না। যা MCQ নয় (শিরোনাম, বিজ্ঞাপন, পাতার নম্বর) বাদ দেবে। কোনো markdown বা HTML নয়।

লেখা:
`;

const SHORT_PROMPT = `নিচের লেখাটা কেউ কপি করে paste করেছে — এতে সংক্ষিপ্ত প্রশ্ন আর উত্তর আছে, যেকোনো ছাঁদে: "প্রশ্ন: উত্তর", "প্রশ্ন? উত্তর", "প্রশ্ন — উত্তর", পরের লাইনে উত্তর, নম্বর দিয়ে বা ছাড়া, এক লাইনে অনেকগুলো। প্রতিটা প্রশ্ন আর তার উত্তর আলাদা করে বের করো, যে ক্রমে আছে সেই ক্রমে, একটাও বাদ দেবে না।
- question: প্রশ্নটা হুবহু, নম্বর আর শেষের ":"/"—" বাদ দিয়ে।
- answer: তার উত্তর হুবহু, "উত্তর:"/"Ans:" লেবেল বাদ দিয়ে (কয়েক লাইনের হলে লাইন ভাঙা রেখে, \\n দিয়ে)। লেখায় উত্তর না থাকলে "" — নিজে উত্তর লিখবে না।
- গণিত থাকলে $…$-এর ভেতরে LaTeX-এ, একবারই। এ ছাড়া একটা শব্দও বদলাবে না, বানান ঠিক করবে না। প্রশ্ন নয় এমন লেখা (শিরোনাম, পাতার নম্বর) বাদ দেবে। কোনো markdown বা HTML নয়।

লেখা:
`;

/**
 * Staff on a General chapter: pasted MCQs or short questions, in whatever shape they were copied,
 * sorted into fields by AI (word for word; an answer that isn't in the text stays empty for the
 * admin to pick). Nothing is saved here — the page shows them for checking, then imports them.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await can(user, "question_bank"))) return Response.json({ error: "এটা করতে প্রশ্ন ব্যাংক permission লাগবে।" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "লেখাটা খালি বা খুব বড়।" }, { status: 400 });
  const { kind, text, batch } = parsed.data;
  const { blocked } = await checkAi(user, "suggestion", `bank-paste:${batch}`);
  if (blocked) return Response.json({ error: "AI এখন ব্যবহার করা যাচ্ছে না।" }, { status: 403 });

  const raw = await callAI((kind === "mcq" ? MCQ_PROMPT : SHORT_PROMPT) + text, { responseSchema: kind === "mcq" ? mcqSchema : shortSchema, userId: user.id, feature: "bank_paste", timeoutMs: 55_000 });
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে লেখাটা সাজাতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });
  try {
    if (kind === "mcq") {
      const questions = mcqAnswer.parse(JSON.parse(raw)).questions
        .map((question) => ({
          text: question.text.trim().slice(0, 2000),
          options: question.options.map((option) => option.trim().slice(0, 500)).filter(Boolean).slice(0, 5),
          correctIndex: question.correctIndex,
          solution: question.solution?.trim().slice(0, 5000) || null,
          explanation: question.explanation?.trim().slice(0, 5000) || null,
        }))
        .filter((question) => question.text && question.options.length >= 4)
        .map((question) => ({ ...question, correctIndex: question.correctIndex >= 0 && question.correctIndex < question.options.length ? question.correctIndex : -1 }));
      return Response.json({ questions });
    }
    const questions = shortAnswer.parse(JSON.parse(raw)).questions
      .map((short) => ({ question: short.question.trim().slice(0, 2000), answer: short.answer.trim().slice(0, 4000) }))
      .filter((short) => short.question);
    return Response.json({ questions });
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না। আবার চেষ্টা করো।" }, { status: 502 });
  }
}
