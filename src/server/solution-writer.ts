import { z } from "zod";
import { SOLUTION_MAX } from "@/lib/solution-html";
import { callAI, type AiFeature } from "@/server/assistant/ai";

/**
 * AI-written solutions and explanations for MCQs (owner, 2026-10-18). Shared by the Question Bank
 * (staff) and Preliminary sets (a user's own, 2026-10-19). Server-only.
 *
 * Kept cheap (owner, 2026-10-19): the full "book page" with web search and medium reasoning cost
 * ~17k tokens a question (2.8M on 18 Oct, mostly search results read as input). Now: a short
 * explanation (মূল কথা, অন্য option, মনে রাখার কৌশল), low reasoning, a few questions per call so
 * the instructions are paid once, and web search only when a question is about years or history.
 */

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

export const writtenSolutionsSchema = z.object({
  questions: z.array(z.object({ id: z.string(), solution: z.string().trim().max(SOLUTION_MAX), explanation: z.string().trim().max(SOLUTION_MAX) })),
});

const PROMPT = `তুমি বাংলাদেশের চাকরির পরীক্ষার (BCS, প্রাইমারি, ব্যাংক) অভিজ্ঞ শিক্ষক। প্রতিটা MCQ-এর জন্য বাংলায় ছোট, গোছানো "সমাধান" আর "ব্যাখ্যা" লেখো।

সঠিক উত্তর:
- correctOption (1 থেকে গোনা) সঠিক উত্তর। সেটাই ঠিক ধরে লিখবে — অন্য option-কে কখনো সঠিক বলবে না।

সমাধান (solution):
- কেন এই উত্তর, ধাপে ধাপে; প্রতিটা ধাপ আলাদা <p>। গণিত হলে শেষ <p>: "∴ উত্তর: …"। তথ্যভিত্তিক প্রশ্নে ১–৩ বাক্যে সরাসরি কারণ।

ব্যাখ্যা (explanation) — ছোট রাখো, শুধু এই তিনটা অংশ, এই ক্রমে, প্রতিটা নিজের <h3> শিরোনামের নিচে (যেটা এই প্রশ্নে খাটে না সেটা বাদ):
- <h3>মূল কথা</h3>: বিষয়টা ২–৩ বাক্যে।
- <h3>অন্য option</h3>: অন্য option-গুলো কী বা কেন ভুল — প্রতিটা এক লাইনে, <ul><li>-তে।
- <h3>মনে রাখার কৌশল</h3>: সহজে মনে রাখার উপায় থাকলে, এক–দুই লাইনে।
- গুরুত্বপূর্ণ নাম, সাল আর সংখ্যা <strong>-এ।

নির্ভুলতা (সবচেয়ে জরুরি):
- নাম, সাল, তারিখ, সংখ্যা আর স্থান মিলিয়ে লিখবে। যা নিশ্চিত নও তা লিখবে না — ভুল তথ্যের চেয়ে কম তথ্য ভালো।
- লেখায় কোনো link, URL বা সূত্রের তালিকা দেবে না।

লেখার ধরন:
- দুটোই Quill editor-এর সরল HTML: শুধু <h3>, <p>, <strong>, <em>, <ul>/<ol> + <li>। কোনো টেবিল, markdown (**, #), style, ছবি বা code fence নয়।
- গণিত সবসময় LaTeX-এ, প্রতিটা রাশির শুরু আর শেষ দুই জায়গাতেই $ দিয়ে: $\\sqrt{2}$, $\\frac{1}{2}$, $x^{2}$, $a\\times b$। কোনো $ বাদ যাবে না, একা $ রাখবে না।
- সহজ, প্রমিত বাংলা; ইংরেজি পরিভাষা দরকার হলে বন্ধনীতে।
- প্রতিটা প্রশ্নের id হুবহু ফেরত দেবে।`;

/** A question as the AI gets it: the right answer is given (1-based) and never changed. */
export type SolveInput = { id: string; subject: string; question: string; options: string[]; correctOption: number };

// Years, history and "who/when" facts are where a model's memory slips; only those are searched.
const LOOKUP = /(১[৬-৯]|২০)[০-৯]{2}|\b(1[6-9]|20)\d{2}\b|সাল|কবে|কত সালে|ইতিহাস|প্রতিষ্ঠ|স্থাপিত|যুদ্ধ|চুক্তি|আন্দোলন|বিদ্রোহ|শাসন|রাজা|সম্রাট|নবাব|গভর্নর|প্রথম|সর্বশেষ|বর্তমান|founded|history|when|treaty|war/i;

/** Whether any of these questions is about years or history, so worth a web search. */
export function needsLookup(input: SolveInput[]) {
  return input.some((item) => LOOKUP.test(`${item.question} ${item.options[item.correctOption - 1] ?? ""}`));
}

/** How many questions go in one call: the instructions are sent (and paid) once per call. */
export const SOLVE_PER_CALL = 4;

/**
 * Writes the solution and explanation (short Quill HTML, as JSON) for up to SOLVE_PER_CALL MCQs.
 * Questions about years or history are checked on the web first (falling back to thinking without
 * it); the rest are written straight away. Low reasoning either way.
 */
export async function writeSolutions(input: SolveInput[], userId: string, feature: AiFeature) {
  const questions = `\n\nপ্রশ্নগুলো (JSON):\n${JSON.stringify(input)}`;
  const plain = () => callAI(`${PROMPT}\n- নিজের জ্ঞান থেকে লেখো; সাল, নাম বা সংখ্যায় একটুও সন্দেহ থাকলে সেটা বাদ দাও।${questions}`, { responseSchema, userId, feature, timeoutMs: 55_000, reasoning: "low" });
  if (!needsLookup(input)) return await plain();
  return await callAI(`${PROMPT}\n- সাল, নাম আর সংখ্যা web search দিয়ে যাচাই করো।${questions}`, { responseSchema, search: true, userId, feature, timeoutMs: 55_000, reasoning: "low" })
    ?? await plain();
}
