import { z } from "zod";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { htmlToPlainText, noteWritingRules, sanitizeNoteHtml } from "@/lib/note-html";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { hasPremium } from "@/server/premium";

export const noteWriteSchema = z.object({
  instruction: z.string().trim().max(2000),
  title: z.string().max(200),
  currentHtml: z.string().max(120_000),
  lang: z.enum(["bn", "en"]).optional(),
  /** Text read from reference photos (/api/notes/read-image), one entry per photo. */
  references: z.array(z.string().max(20_000)).max(5).default([]),
});

/**
 * Writes the note with AI. It gets the whole note as it is now and returns the whole note with the
 * instruction applied ("improve", "add examples", "make a table"…) — not a piece to append, which
 * used to leave two copies of everything. With reference photos (a book page, a class sheet) it
 * gets their text, read one photo at a time beforehand, and adds or fixes from it what the note
 * misses or gets wrong — thinking first, since that comparison has to be right. The page shows
 * the result with an undo. A paid feature (owner, 2026-10-16). Server-only: takes the user, so
 * never export it from a "use server" file.
 */
export async function writeNoteWithAi(user: { id: string; email: string }, input: unknown) {
  const data = noteWriteSchema.parse(input);
  const references = data.references.map((text) => text.trim()).filter(Boolean);
  if (!data.instruction && !references.length) throw new Error("কী করতে হবে লেখো, বা একটা ছবি দাও।");
  if (!(await hasPremium(user))) throw new Error("AI দিয়ে note লেখা paid feature — একটা plan নিলে পাবে।");
  const current = sanitizeNoteHtml(data.currentHtml);
  const empty = !htmlToPlainText(current).trim();
  const instruction = data.instruction || "ছবির লেখার সাথে মিলিয়ে note-টা সম্পূর্ণ আর সঠিক করো — যা বাদ পড়েছে যোগ করো, যা ভুল ঠিক করো।";
  const imageRule = references.length ? `

Reference: ব্যবহারকারী ${references.length}টা পাতার ছবি দিয়েছে (বই, গাইড, ক্লাসের শিট); প্রতিটার লেখা হুবহু পড়ে নিচে দেওয়া হলো — এটাই সঠিক তথ্যের উৎস।
${references.map((text, index) => `--- ছবি ${index + 1} ---\n${text.slice(0, 20_000)}`).join("\n\n")}
--- শেষ ---

কাজের আগে মিলিয়ে দেখো:
১. Reference-এর প্রতিটা বিষয়/পয়েন্ট note-এ আছে কিনা — না থাকলে note-এর ঠিক জায়গায় যোগ করো (শিরোনাম, তালিকা, টেবিল যেমন মানায়)।
২. Note-এ যা reference-এর সাথে মেলে না (সাল, নাম, সংখ্যা, নিয়ম, উদাহরণ) — reference অনুযায়ী ঠিক করো।
৩. Reference-এ টেবিল থাকলে note-এও টেবিল রাখো।
৪. হুবহু কপি নয় — note-এর ধরনে গুছিয়ে লেখো; reference-এ নেই এমন তথ্য বানাবে না; [অস্পষ্ট] অংশ বাদ দাও।
৫. শেষে আবার মিলিয়ে নাও কিছু বাদ পড়েনি তো।` : "";
  const prompt = `তুমি একজন যত্নশীল শিক্ষক, ব্যবহারকারীর study note লিখতে সাহায্য করছো।
${noteWritingRules}
ভাষা: ${data.lang === "en" ? "English" : "সহজ বাংলা (প্রয়োজনে technical শব্দ ইংরেজিতে)"}।
Note-এর title: ${data.title || "(নেই)"}
${empty ? "Note এখন ফাঁকা — নির্দেশ মতো নতুন করে লেখো।" : `Note-এ এখন যা আছে (HTML):
${current.slice(0, 40_000)}

নির্দেশটা এই note-এর ওপর প্রয়োগ করে **পুরো note-টা আবার দাও** — উন্নত/বদলানো অংশসহ, বাকি অংশ যেমন আছে তেমন রেখে। কোনো অংশ দুবার লিখবে না, পুরোনো লেখার পরে নতুন কপি জুড়বে না। নির্দেশে কিছু যোগ করতে বললে ঠিক জায়গায় বসাবে; বাদ দিতে বললে বাদ দেবে। গণিতের formula আর টেবিল আগের মতোই রাখবে।`}${imageRule}

ব্যবহারকারীর নির্দেশ: ${instruction}

শুধু পুরো note-এর HTML দাও, আর কিছু না।`;
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) throw new Error(aiBlockedMessage(blocked, data.lang === "en" ? "en" : "bn"));
  const raw = await callAI(prompt, { userId: user.id, feature: "note_writer", timeoutMs: 55_000, reasoning: references.length ? "medium" : undefined });
  if (!raw) throw new Error(data.lang === "en" ? "The AI isn't responding right now. Please try again in a moment." : "AI এখন সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করো।");
  const html = sanitizeNoteHtml(raw.replace(/^```(?:html)?\s*|\s*```$/g, ""));
  // If the model ignored the HTML rule and sent plain text, wrap its paragraphs.
  return /<(p|h[1-3]|ul|ol|blockquote|table)\b/i.test(html)
    ? html
    : html.split(/\n{2,}/).map((part) => `<p>${part.trim()}</p>`).join("");
}
