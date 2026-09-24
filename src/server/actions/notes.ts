"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { htmlToPlainText, noteWritingRules, sanitizeNoteHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";
import { callGemini } from "@/server/assistant/gemini";

const noteSchema = z.object({
  title: z.string().trim().max(200),
  content: z.string().max(400_000),
});

/** Sanitized content plus its plain-text copy; an empty title falls back to the first line. */
function toData(input: unknown) {
  const data = noteSchema.parse(input);
  const content = sanitizeNoteHtml(data.content);
  const plainText = htmlToPlainText(content);
  const title = data.title || plainText.split("\n")[0]?.slice(0, 80) || "Untitled note";
  return { title, content, plainText: plainText.slice(0, 100_000) };
}

async function ownedNote(userId: string, noteId: string) {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
  if (!note) throw new Error("Note not found.");
  return note;
}

export async function listNotes() {
  const user = await requireUser();
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, plainText: true, updatedAt: true },
  });
  return notes.map((note) => ({ ...note, plainText: note.plainText.slice(0, 400) }));
}

export async function getNote(noteId: string) {
  const user = await requireUser();
  return ownedNote(user.id, noteId);
}

export async function createNote(input: unknown) {
  const user = await requireUser();
  const note = await prisma.note.create({ data: { userId: user.id, ...toData(input) } });
  revalidatePath("/notes");
  return note.id;
}

export async function updateNote(noteId: string, input: unknown) {
  const user = await requireUser();
  const note = await ownedNote(user.id, noteId);
  const updated = await prisma.note.update({ where: { id: note.id }, data: toData(input) });
  return updated.updatedAt.toISOString();
}

export async function deleteNote(noteId: string) {
  const user = await requireUser();
  const note = await ownedNote(user.id, noteId);
  await prisma.note.delete({ where: { id: note.id } });
  revalidatePath("/notes");
}

/**
 * AI writing inside the note editor: returns sanitized HTML to insert at the cursor.
 * `lang` follows the assistant's language setting.
 */
export async function generateNoteContent(input: { instruction: string; title: string; currentText: string; lang?: "bn" | "en" }) {
  await requireUser();
  const data = z.object({
    instruction: z.string().trim().min(1).max(2000),
    title: z.string().max(200),
    currentText: z.string().max(20_000),
    lang: z.enum(["bn", "en"]).optional(),
  }).parse(input);
  const prompt = `তুমি একজন যত্নশীল শিক্ষক, ব্যবহারকারীর study note লিখতে সাহায্য করছো।
${noteWritingRules}
ভাষা: ${data.lang === "en" ? "English" : "সহজ বাংলা (প্রয়োজনে technical শব্দ ইংরেজিতে)"}।
Note-এর title: ${data.title || "(নেই)"}
Note-এ এখন যা আছে (নতুন লেখা এর সাথে মিলিয়ে লিখবে, পুনরাবৃত্তি করবে না):
${data.currentText.slice(0, 6000) || "(ফাঁকা)"}

ব্যবহারকারীর নির্দেশ: ${data.instruction}

শুধু note-এ বসানোর HTML দাও, আর কিছু না।`;
  const raw = await callGemini(prompt);
  if (!raw) throw new Error(data.lang === "en" ? "The AI isn't responding right now. Please try again in a moment." : "AI এখন সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করো।");
  const html = sanitizeNoteHtml(raw.replace(/^```(?:html)?\s*|\s*```$/g, ""));
  // If the model ignored the HTML rule and sent plain text, wrap its paragraphs.
  return /<(p|h[1-3]|ul|ol|blockquote)\b/i.test(html)
    ? html
    : html.split(/\n{2,}/).map((part) => `<p>${part.trim()}</p>`).join("");
}
