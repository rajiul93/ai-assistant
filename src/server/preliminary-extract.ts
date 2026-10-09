import { z } from "zod";
import { isAllowedType, MAX_ATTACHMENT_BYTES, sniffType } from "@/lib/attachments";
import { callAI } from "@/server/assistant/ai";

/** One page per request: its enlarged tiles (see lib/page-tiles), or one PDF. */
export const MAX_MCQ_FILES = 12;

export const mcqExtractRequestSchema = z.object({
  files: z.array(z.object({ name: z.string().max(200), mimeType: z.string().refine(isAllowedType), data: z.string().min(1) })).min(1).max(MAX_MCQ_FILES),
  /** How the tiles cut the page: columns × rows, left column first. Absent for a whole page/PDF. */
  layout: z.object({ columns: z.union([z.literal(1), z.literal(2)]), rows: z.number().int().min(1).max(8) }).optional(),
});

const extractedSchema = z.object({
  topic: z.string().nullish(),
  questions: z.array(z.object({
    text: z.string(),
    options: z.array(z.string()),
    correctIndex: z.number().int().min(0).max(3).nullish(),
  })).default([]),
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
          options: { type: "ARRAY", items: { type: "STRING" }, description: "Exactly four, in order ক খ গ ঘ" },
          correctIndex: { type: "INTEGER", nullable: true, description: "0-3 for the answer marked on the page; null if no answer is marked" },
        },
        required: ["text", "options", "correctIndex"],
      },
    },
  },
  required: ["questions"],
};

export const mcqPrompt = `এগুলো MCQ প্রশ্নের পাতা (বই, গাইড, প্রশ্নব্যাংক বা হাতের লেখা)। পাতার প্রতিটি প্রশ্ন বের করো, একটাও বাদ দেবে না, পাতায় যে ক্রমে আছে সেই ক্রমে (দুই কলাম হলে আগে বাঁ কলাম উপর থেকে নিচে, তারপর ডান কলাম)।
- text: প্রশ্নটা হুবহু, যেমন ছাপা আছে (উদ্ধৃতি চিহ্নসহ)। প্রশ্নে কোনো শব্দ বা অংশের নিচে দাগ (underline) থাকলে সেটা <u>…</u> দিয়ে ঘিরে লেখো — যেমন "The <u>Charity</u> of Hatem Tai is known to all." (প্রশ্নে "underlined word"/"নিম্নরেখ শব্দ" বলা থাকলে দাগটা অবশ্যই রাখবে); option-এও দাগ থাকলে একইভাবে। bold/italic বা অন্য কোনো formatting লিখবে না। প্রশ্নের নম্বর (১., ২.) আর শেষে বন্ধনীর উৎস/পরীক্ষার নাম (যেমন [৫০তম বিসিএস'২৬], [অফিসার, সমন্বিত ৯টি ব্যাংক...]) বাদ দেবে।
- options: ঠিক ৪টি, ক খ গ ঘ ক্রমে, শুধু option-এর লেখা (ক/খ চিহ্ন ছাড়া), হুবহু।
- correctIndex: পাতায় যে উত্তর চিহ্নিত করা আছে — সাধারণত প্রশ্নের শেষে/ডান পাশে কালো বা ভরাট গোলের ভেতরের অক্ষর (ক=0, খ=1, গ=2, ঘ=3), অথবা টিক দেওয়া, দাগ দেওয়া, bold করা option, বা "উত্তর: খ" লেখা। কোনো চিহ্ন না থাকলে বা পড়া না গেলে null — নিজে সমাধান করে অনুমান করবে না।
- topic: পাতার শিরোনাম/অধ্যায়ের নাম থাকলে (যেমন "বাংলা ভাষা ও সাহিত্য"), না থাকলে null।
অক্ষরে অক্ষরে নির্ভুল হতে হবে: প্রতিটি শব্দ ছবিতে যেমন ছাপা আছে ঠিক তেমন — যুক্তবর্ণ, কার, ফলা, রেফ, চন্দ্রবিন্দু, হসন্ত সব। নিজের জানা থেকে কখনো কোনো শব্দ, নাম বা option বসাবে না বা বদলাবে না (উত্তর জানা থাকলেও ছাপা option-ই লিখবে), বানান "ঠিক"ও করবে না। কোনো শব্দ অস্পষ্ট হলে আশেপাশের অক্ষর ভালো করে দেখে পড়ো। গণিতের রাশি থাকলে LaTeX-এ $…$ দিয়ে লেখো (যেমন $\\frac{1}{2}$, $x^{2}$)। পাতায় যা নেই তা বানাবে না।`;

export type ExtractedMcq = { text: string; options: [string, string, string, string]; correctIndex: number };

/** Reads MCQ pages (images/PDFs) and returns the questions, each with the answer marked on the page (or -1). */
export async function extractMcqs(input: z.infer<typeof mcqExtractRequestSchema>, userId: string): Promise<{ topic: string | null; questions: ExtractedMcq[]; dropped: number } | { error: string; status: number }> {
  const files: Array<{ mimeType: string; data: string; name: string }> = [];
  for (const file of input.files) {
    const bytes = Buffer.from(file.data, "base64");
    if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) return { error: "প্রতিটি ফাইল ১০MB-এর কম হতে হবে।", status: 400 };
    // The real type from the bytes, not the name.
    const type = sniffType(bytes);
    if (!type) return { error: "শুধু ছবি (JPG, PNG, WebP) বা PDF পড়া যায়।", status: 400 };
    files.push({ mimeType: type, data: file.data, name: file.name });
  }
  const layout = input.layout
    ? input.layout.columns === 2
      ? `\n\nপাতাটা টুকরো করে বড় করে দেওয়া হয়েছে: প্রথম ${input.layout.rows}টা ছবি বাঁ কলাম উপর থেকে নিচে, পরের ${input.layout.rows}টা ডান কলাম উপর থেকে নিচে; টুকরোর মাঝে একটু overlap আছে — একই প্রশ্ন দুবার লিখবে না।`
      : `\n\nপাতাটা উপর থেকে নিচে ${input.layout.rows}টা ফালিতে (একটু overlap রেখে) বড় করে দেওয়া হয়েছে — জোড়া দিয়ে পুরো পাতা হিসেবে পড়ো; একই প্রশ্ন দুবার লিখবে না।`
    : "";
  const raw = await callAI(mcqPrompt + layout, { responseSchema, files, userId, feature: "file_assistant", timeoutMs: 110_000 });
  if (!raw) return { error: "AI এই মুহূর্তে পাতাটা পড়তে পারল না। একটু পরে আবার চেষ্টা করো।", status: 502 };
  let parsed: z.infer<typeof extractedSchema>;
  try { parsed = extractedSchema.parse(JSON.parse(raw)); } catch { return { error: "AI-এর উত্তর বোঝা গেল না। আবার চেষ্টা করো।", status: 502 }; }
  const questions: ExtractedMcq[] = [];
  let dropped = 0;
  for (const question of parsed.questions) {
    const options = question.options.map((option) => option.trim()).slice(0, 4);
    if (!question.text.trim() || options.length < 4 || options.some((option) => !option)) { dropped++; continue; }
    questions.push({ text: question.text.trim().slice(0, 2000), options: options.map((option) => option.slice(0, 500)) as ExtractedMcq["options"], correctIndex: question.correctIndex ?? -1 });
  }
  return { topic: parsed.topic?.trim() || null, questions: questions.slice(0, 300), dropped };
}

/* ---------- A spelling check of what was read ---------- */

export const spellCheckRequestSchema = z.object({
  questions: z.array(z.object({ text: z.string().max(2000), options: z.array(z.string().max(500)).length(4) })).min(1).max(300),
});

export const spellCheckPrompt = `নিচে একটা বই/গাইডের পাতা থেকে মেশিনে পড়া MCQ প্রশ্ন আর option আছে। মেশিন কখনো কখনো একটা অক্ষর ভুল পড়ে (যেমন ই↔ঈ, র↔ব, ক্ত↔ত্ত, ঙ্গ↔ং, কার/ফলা বাদ পড়া), ফলে এমন শব্দ তৈরি হয় যা বাংলায় নেই বা এখানে খাপ খায় না।
প্রতিটি প্রশ্ন ও option দেখো এবং যেগুলোতে এমন সন্দেহজনক শব্দ আছে সেগুলো জানাও — অচেনা/অস্তিত্বহীন শব্দ, বানান যা প্রচলিত প্রমিত বানান থেকে আলাদা (যেমন "কিসের" বনাম "কীসের" — দুটোই চললেও জানাও), বা প্রশ্নের প্রসঙ্গে বেমানান শব্দ। নাম, পারিভাষিক শব্দ ঠিক মনে হলে জানাবে না। কিছু বদলাবে না, শুধু জানাবে।
<u>…</u> শুধু ছাপা দাগ (underline) বোঝায় — ওটা নিয়ে কিছু জানাবে না।
field: 0 = প্রশ্ন, 1–4 = option ক–ঘ। word: সন্দেহজনক শব্দটা।`;

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

/** Fields holding a word that doesn't look like real Bangla, for the user to check against the page. */
export async function spellCheckMcqs(input: z.infer<typeof spellCheckRequestSchema>, userId: string) {
  const list = input.questions.map((question, index) => `${index}. [0] ${question.text}\n${question.options.map((option, position) => `   [${position + 1}] ${option}`).join("\n")}`).join("\n");
  const raw = await callAI(`${spellCheckPrompt}\n\n${list}`, { responseSchema: spellCheckSchema, userId, feature: "file_assistant", timeoutMs: 40_000 });
  if (!raw) return [];
  try {
    const parsed = z.object({ suspicious: z.array(z.object({ question: z.number().int(), field: z.number().int().min(0).max(4), word: z.string() })) }).parse(JSON.parse(raw));
    return parsed.suspicious.filter((item) => item.question >= 0 && item.question < input.questions.length);
  } catch {
    return [];
  }
}
