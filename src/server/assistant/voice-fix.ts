import { callAI } from "@/server/assistant/ai";

/** Bangla letters, or words and symbols that suggest spoken math. */
const NEEDS_FIX = /[ঀ-৿]|[\d)a-z]\s*[\/^]\s*[\d(a-z]|\b(square|squared|cube|cubed|root|over|divided|power|fraction|equals|plus|minus)\b/i;

const rules = `তুমি বাংলা speech-to-text-এর সংশোধক। নিচের লেখাটা কেউ মুখে বলেছে আর মেশিন লিখেছে। শুধু সংশোধিত লেখাটা ফেরত দাও — কোনো ব্যাখ্যা, উদ্ধৃতি চিহ্ন বা ভূমিকা নয়।
১. প্রসঙ্গ দেখে প্রমিত বাংলা বানানে লেখো: ভাঙা বা ভুল যুক্তবর্ণ ঠিক করো (যেমন "স্ ত"→"স্ত", "ক্ ষ"→"ক্ষ", "পরিক্ষা"→"পরীক্ষা", "বিঞ্জান"→"বিজ্ঞান", "মুক্তি যুদ্ধ"→"মুক্তিযুদ্ধ"), ভুল কার/ফলা/হসন্ত আর ভুল শোনা শব্দ ঠিক করো।
২. অর্থ বা শব্দ বদলাবে না: অনুবাদ করবে না, কিছু যোগ বা বাদ দেবে না, প্রশ্নের উত্তর দেবে না। ইংরেজি শব্দ ইংরেজিতেই থাকবে। কথ্য ভঙ্গি যেমন আছে থাকবে।
৩. গণিতের কথা থাকলে শুধু সেই অংশটা LaTeX-এ $…$ দিয়ে লেখো, যেমন বইয়ে লেখা থাকে: "এক বাই দুই"/"দুই ভাগের এক"/"1/2" → $\\frac{1}{2}$, "x স্কয়ার"/"x এর বর্গ"/"x^2" → $x^{2}$, "x কিউব" → $x^{3}$, "রুট দুই" → $\\sqrt{2}$, "a প্লাস b হোল স্কয়ার" → $(a+b)^{2}$। সাধারণ সংখ্যা, তারিখ (২৬/০৩/২০২৫), সময়, টাকা, ফোন নম্বর LaTeX হবে না।
৪. কিছু ঠিক করার না থাকলে লেখাটা হুবহু ফেরত দাও।`;

export function voiceFixPrompt(text: string, context?: string) {
  return `${rules}${context ? `\n\nপ্রসঙ্গ (আগের কথা, শুধু বোঝার জন্য): ${context}` : ""}\n\nলেখা:\n${text}`;
}

/**
 * Cleans up what the mic heard, before anyone sees or saves it: correct Bangla spelling and
 * conjuncts in context, and spoken math turned into LaTeX ($\frac{1}{2}$, $x^{2}$) so it is
 * drawn and stored like a book. Falls back to the text as heard if the AI is slow or strays.
 */
export async function fixVoiceText(text: string, options: { userId: string; lang: "bn" | "en"; context?: string }) {
  if (!text.trim() || !NEEDS_FIX.test(text)) return text;
  const prompt = voiceFixPrompt(text, options.context);
  const fixed = (await callAI(prompt, { userId: options.userId, feature: "voice_fix", timeoutMs: 4_000 }).catch(() => null))?.trim().replace(/^["“”']+|["“”']+$/g, "");
  if (!fixed) return text;
  // A clean-up keeps roughly the same length; anything else means the model answered or rewrote it.
  const plain = (value: string) => value.replace(/\$[^$]*\$/g, "x").replace(/\s+/g, "");
  const ratio = plain(fixed).length / Math.max(1, plain(text).length);
  return ratio > 0.5 && ratio < 1.6 ? fixed : text;
}
