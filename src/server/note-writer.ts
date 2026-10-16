import { z } from "zod";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { applyBlockEdits, splitBlocks, type BlockEdit } from "@/lib/note-blocks";
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
 * Writes the note with AI. It sees the whole note as numbered blocks and sends back only the edits
 * (replace / insert after / delete a block) for the instruction ("improve", "add examples", "make
 * a table"…); the edits are applied here and the whole updated note is returned. Not a piece to
 * append (that left two copies of everything), and not the whole note rewritten (long notes ran
 * past the time limit). With reference photos (a book page, a class sheet) it
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
  // The note as numbered blocks: the AI sends back only what changes (see lib/note-blocks), which
  // keeps long notes inside the time limit and leaves untouched parts exactly as they were.
  const blocks = empty ? [] : splitBlocks(current);
  const numbered = blocks.map((block, index) => `[${index + 1}] ${block}`).join("\n").slice(0, 60_000);
  const prompt = `তুমি একজন যত্নশীল শিক্ষক, ব্যবহারকারীর study note লিখতে সাহায্য করছো।
${noteWritingRules}
ভাষা: ${data.lang === "en" ? "English" : "সহজ বাংলা (প্রয়োজনে technical শব্দ ইংরেজিতে)"}।
Note-এর title: ${data.title || "(নেই)"}
${empty ? "Note এখন ফাঁকা।" : `Note-এ এখন যা আছে — নম্বর দেওয়া block হিসেবে (প্রতিটা block একটা শিরোনাম, অনুচ্ছেদ, পুরো তালিকা বা পুরো টেবিল):
${numbered}`}${imageRule}

ব্যবহারকারীর নির্দেশ: ${instruction}

উত্তর দেবে শুধু পরিবর্তনগুলো (edits) হিসেবে — পুরো note আবার লিখবে না:
- op "replace": block নম্বরের পুরো block-টা নতুন html দিয়ে বদলাও (উন্নত/সংশোধিত লেখা)।
- op "insert_after": block নম্বরের পরে নতুন html বসাও (০ = একদম শুরুতে)। একই জায়গায় একাধিক insert দিলে যে ক্রমে দেবে সেই ক্রমে বসবে।
- op "delete": block-টা বাদ দাও (html ফাঁকা)।
- যে block বদলানোর দরকার নেই সেটা edits-এ রাখবে না। একই কথা দুবার লিখবে না।
- html হবে note-এর নিয়ম মেনে সরল HTML (তালিকা হলে পুরো <ol>/<ul>, টেবিল হলে পুরো <table>)। Note ফাঁকা হলে পুরো note insert_after 0 দিয়ে দাও।`;
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) throw new Error(aiBlockedMessage(blocked, data.lang === "en" ? "en" : "bn"));
  const raw = await callAI(prompt, { responseSchema: editsSchema, userId: user.id, feature: "note_writer", timeoutMs: 55_000, reasoning: references.length ? "low" : undefined });
  if (!raw) throw new Error(data.lang === "en" ? "The AI isn't responding right now. Please try again in a moment." : "AI এখন সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করো।");
  let edits: BlockEdit[];
  try {
    edits = editsAnswer.parse(JSON.parse(raw)).edits.map((edit) => ({ ...edit, html: edit.op === "delete" ? "" : sanitizeNoteHtml(edit.html) }));
  } catch {
    throw new Error("AI-এর উত্তর বোঝা গেল না, আবার চেষ্টা করো।");
  }
  if (!edits.length) throw new Error("AI কোনো পরিবর্তন দরকার মনে করেনি — নির্দেশটা আরেকটু স্পষ্ট করে লেখো।");
  return applyBlockEdits(blocks, edits);
}

const editsSchema = {
  type: "OBJECT",
  properties: {
    edits: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          op: { type: "STRING", enum: ["replace", "insert_after", "delete"] },
          block: { type: "INTEGER" },
          html: { type: "STRING" },
        },
        required: ["op", "block", "html"],
      },
    },
  },
  required: ["edits"],
};

const editsAnswer = z.object({
  edits: z.array(z.object({ op: z.enum(["replace", "insert_after", "delete"]), block: z.number().int(), html: z.string().max(60_000) })).max(200),
});
