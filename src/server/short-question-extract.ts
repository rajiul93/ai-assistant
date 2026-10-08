import { z } from "zod";
import { MAX_ATTACHMENT_BYTES, sniffType } from "@/lib/attachments";
import { callAI } from "@/server/assistant/ai";
import { mcqExtractRequestSchema } from "@/server/preliminary-extract";

/** Same request as Preliminary: one page per request, as enlarged tiles or one PDF. */
export const shortExtractRequestSchema = mcqExtractRequestSchema;

const extractedSchema = z.object({
  topic: z.string().nullish(),
  questions: z.array(z.object({ text: z.string(), answer: z.string().nullish() })).default([]),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    topic: { type: "STRING", nullable: true, description: "The page's topic/chapter heading, if printed" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          answer: { type: "STRING", nullable: true, description: "The answer printed on the page for this question; null if none is printed" },
        },
        required: ["text", "answer"],
      },
    },
  },
  required: ["questions"],
};

export const shortPrompt = `এগুলো সংক্ষিপ্ত প্রশ্ন-উত্তরের পাতা (বই, গাইড, প্রশ্নব্যাংক, নোট বা হাতের লেখা)। পাতার প্রতিটি প্রশ্ন আর তার উত্তর বের করো, একটাও বাদ দেবে না, পাতায় যে ক্রমে আছে সেই ক্রমে (দুই কলাম হলে আগে বাঁ কলাম উপর থেকে নিচে, তারপর ডান কলাম)।
- text: প্রশ্নটা হুবহু, যেমন ছাপা আছে (উদ্ধৃতি চিহ্নসহ)। প্রশ্নের নম্বর (১., ২., প্রশ্ন-১) আর শেষে বন্ধনীর উৎস/পরীক্ষার নাম (যেমন [৪৪তম বিসিএস]) বাদ দেবে।
- answer: পাতায় এই প্রশ্নের যে উত্তর লেখা আছে — সাধারণত প্রশ্নের ঠিক পরে "উত্তর:", "উঃ", "Ans:" দিয়ে, প্রশ্নের পাশে/নিচে, বা পাতার শেষে উত্তরমালায়। হুবহু লেখো ("উত্তর:" চিহ্ন ছাড়া); কয়েক লাইনের উত্তর হলে পুরোটা, লাইন ভাঙা রেখে। পাতায় উত্তর না থাকলে null — নিজে উত্তর লিখবে বা অনুমান করবে না।
- topic: পাতার শিরোনাম/অধ্যায়ের নাম থাকলে, না থাকলে null।
অক্ষরে অক্ষরে নির্ভুল হতে হবে: প্রতিটি শব্দ ছবিতে যেমন ছাপা আছে ঠিক তেমন — যুক্তবর্ণ, কার, ফলা, রেফ, চন্দ্রবিন্দু, হসন্ত, সাল-তারিখ-সংখ্যা সব। নিজের জানা থেকে কোনো শব্দ, নাম, সাল বসাবে না বা বদলাবে না, বানান "ঠিক"ও করবে না। কোনো শব্দ অস্পষ্ট হলে আশেপাশের অক্ষর ভালো করে দেখে পড়ো। গণিতের রাশি থাকলে LaTeX-এ $…$ দিয়ে লেখো। পাতায় যা নেই তা বানাবে না।`;

export type ExtractedShort = { text: string; answer: string };

/** Reads short-question pages (images/PDFs): each question with the answer printed on the page ("" if none). */
export async function extractShortQuestions(input: z.infer<typeof shortExtractRequestSchema>, userId: string): Promise<{ topic: string | null; questions: ExtractedShort[] } | { error: string; status: number }> {
  const files: Array<{ mimeType: string; data: string; name: string }> = [];
  for (const file of input.files) {
    const bytes = Buffer.from(file.data, "base64");
    if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) return { error: "প্রতিটি ফাইল ১০MB-এর কম হতে হবে।", status: 400 };
    const type = sniffType(bytes);
    if (!type) return { error: "শুধু ছবি (JPG, PNG, WebP) বা PDF পড়া যায়।", status: 400 };
    files.push({ mimeType: type, data: file.data, name: file.name });
  }
  const layout = input.layout
    ? input.layout.columns === 2
      ? `\n\nপাতাটা টুকরো করে বড় করে দেওয়া হয়েছে: প্রথম ${input.layout.rows}টা ছবি বাঁ কলাম উপর থেকে নিচে, পরের ${input.layout.rows}টা ডান কলাম উপর থেকে নিচে; টুকরোর মাঝে একটু overlap আছে — একই প্রশ্ন দুবার লিখবে না।`
      : `\n\nপাতাটা উপর থেকে নিচে ${input.layout.rows}টা ফালিতে (একটু overlap রেখে) বড় করে দেওয়া হয়েছে — জোড়া দিয়ে পুরো পাতা হিসেবে পড়ো; একই প্রশ্ন দুবার লিখবে না।`
    : "";
  const raw = await callAI(shortPrompt + layout, { responseSchema, files, userId, feature: "file_assistant", timeoutMs: 110_000 });
  if (!raw) return { error: "AI এই মুহূর্তে পাতাটা পড়তে পারল না। একটু পরে আবার চেষ্টা করো।", status: 502 };
  let parsed: z.infer<typeof extractedSchema>;
  try { parsed = extractedSchema.parse(JSON.parse(raw)); } catch { return { error: "AI-এর উত্তর বোঝা গেল না। আবার চেষ্টা করো।", status: 502 }; }
  const questions = parsed.questions
    .map((question) => ({ text: question.text.trim().slice(0, 2000), answer: (question.answer ?? "").trim().slice(0, 4000) }))
    .filter((question) => question.text);
  return { topic: parsed.topic?.trim() || null, questions: questions.slice(0, 300) };
}

/* ---------- A spelling check of what was read ---------- */

export const shortSpellCheckRequestSchema = z.object({
  questions: z.array(z.object({ text: z.string().max(2000), answer: z.string().max(4000) })).min(1).max(300),
});

const spellCheckPrompt = `নিচে একটা বই/গাইডের পাতা থেকে মেশিনে পড়া সংক্ষিপ্ত প্রশ্ন আর উত্তর আছে। মেশিন কখনো কখনো একটা অক্ষর ভুল পড়ে (যেমন ই↔ঈ, র↔ব, ক্ত↔ত্ত, ঙ্গ↔ং, কার/ফলা বাদ পড়া, সংখ্যা ৩↔৬), ফলে এমন শব্দ তৈরি হয় যা বাংলায় নেই বা এখানে খাপ খায় না।
প্রতিটি প্রশ্ন ও উত্তর দেখো এবং যেগুলোতে এমন সন্দেহজনক শব্দ আছে সেগুলো জানাও — অচেনা/অস্তিত্বহীন শব্দ, প্রমিত বানান থেকে আলাদা বানান, বা প্রসঙ্গে বেমানান শব্দ। নাম, পারিভাষিক শব্দ ঠিক মনে হলে জানাবে না। কিছু বদলাবে না, শুধু জানাবে।
field: 0 = প্রশ্ন, 1 = উত্তর। word: সন্দেহজনক শব্দটা।`;

const spellCheckSchema = {
  type: "OBJECT",
  properties: {
    suspicious: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { question: { type: "INTEGER" }, field: { type: "INTEGER" }, word: { type: "STRING" } }, required: ["question", "field", "word"] },
    },
  },
  required: ["suspicious"],
};

/** Questions/answers holding a word that doesn't look like real Bangla, for the user to check against the page. */
export async function spellCheckShortQuestions(input: z.infer<typeof shortSpellCheckRequestSchema>, userId: string) {
  const list = input.questions.map((question, index) => `${index}. [0] ${question.text}\n   [1] ${question.answer || "—"}`).join("\n");
  const raw = await callAI(`${spellCheckPrompt}\n\n${list}`, { responseSchema: spellCheckSchema, userId, feature: "file_assistant", timeoutMs: 40_000 });
  if (!raw) return [];
  try {
    const parsed = z.object({ suspicious: z.array(z.object({ question: z.number().int(), field: z.number().int().min(0).max(1), word: z.string() })) }).parse(JSON.parse(raw));
    return parsed.suspicious.filter((item) => item.question >= 0 && item.question < input.questions.length);
  } catch {
    return [];
  }
}

/* ---------- Pasted text in any shape ---------- */

export const shortTextRequestSchema = z.object({ text: z.string().trim().min(1).max(30_000) });

const textPrompt = `নিচে কেউ সংক্ষিপ্ত প্রশ্ন আর উত্তর paste করেছে — যেকোনো ছাঁদে: এক লাইনে অনেকগুলো, "প্রশ্ন: উত্তর", "প্রশ্ন? উত্তর", "প্রশ্ন — উত্তর", পরের লাইনে উত্তর, নম্বর দিয়ে বা ছাড়া। প্রতিটি প্রশ্ন আর তার উত্তর আলাদা করে বের করো, যে ক্রমে আছে সেই ক্রমে।
- text: প্রশ্নটা হুবহু, প্রশ্নের নম্বর (১., 2), প্রশ্ন-৩) আর শেষের ":" বা "—" চিহ্ন বাদ দিয়ে।
- answer: সেই প্রশ্নের উত্তর হুবহু, "উত্তর:"/"Ans:" লেবেল বাদ দিয়ে। লেখায় উত্তর না থাকলে null।
লেখায় যা আছে শুধু তা-ই — একটা শব্দও বদলাবে না, বানান ঠিক করবে না, নিজে উত্তর লিখবে না বা অনুমান করবে না। topic: লেখায় শিরোনাম থাকলে, না থাকলে null।`;

/** Pasted text the simple parser couldn't follow → question–answer pairs, word for word ("" where no answer is given). */
export async function extractShortQuestionsFromText(text: string, userId: string): Promise<{ topic: string | null; questions: ExtractedShort[] } | { error: string; status: number }> {
  const raw = await callAI(`${textPrompt}\n\n---\n${text}`, { responseSchema, userId, feature: "file_assistant", timeoutMs: 60_000 });
  if (!raw) return { error: "AI এই মুহূর্তে লেখাটা সাজাতে পারল না। একটু পরে আবার চেষ্টা করো।", status: 502 };
  let parsed: z.infer<typeof extractedSchema>;
  try { parsed = extractedSchema.parse(JSON.parse(raw)); } catch { return { error: "AI-এর উত্তর বোঝা গেল না। আবার চেষ্টা করো।", status: 502 }; }
  const questions = parsed.questions
    .map((question) => ({ text: question.text.trim().slice(0, 2000), answer: (question.answer ?? "").trim().slice(0, 4000) }))
    .filter((question) => question.text);
  return { topic: parsed.topic?.trim() || null, questions: questions.slice(0, 300) };
}
