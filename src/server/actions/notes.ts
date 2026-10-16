"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { htmlToPlainText, noteWritingRules, sanitizeNoteHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { createTask } from "@/server/actions/tasks";
import { noteSummarySelect } from "@/server/queries";

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

const noteInclude = {
  tasks: { orderBy: { createdAt: "asc" }, select: { task: { select: { id: true, title: true, status: true } } } },
} as const;

async function ownedNote(userId: string, noteId: string) {
  const note = await prisma.note.findFirst({ where: { id: noteId, userId }, include: noteInclude });
  if (!note) throw new Error("Note not found.");
  return note;
}

export async function listNotes() {
  const user = await requireUser();
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: noteSummarySelect,
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

function revalidateNoteLinks() {
  revalidatePath("/notes");
  revalidatePath("/tasks");
}

/** Files a note under a subject and (optionally) one of its topics; empty clears it. */
export async function setNoteSubject(noteId: string, input: { subjectId?: string | null; topicId?: string | null }) {
  const user = await requireUser();
  const note = await ownedNote(user.id, noteId);
  const data = z.object({ subjectId: z.string().nullish(), topicId: z.string().nullish() }).parse(input);
  let subjectId: string | null = null;
  let topicId: string | null = null;
  if (data.topicId) {
    // A topic decides its subject, so the two can never disagree.
    const topic = await prisma.topic.findFirst({ where: { id: data.topicId, userId: user.id }, select: { id: true, subjectId: true } });
    if (!topic) throw new Error("Topic not found.");
    topicId = topic.id;
    subjectId = topic.subjectId;
  } else if (data.subjectId) {
    const subject = await prisma.subject.findFirst({ where: { id: data.subjectId, userId: user.id }, select: { id: true } });
    if (!subject) throw new Error("Subject not found.");
    subjectId = subject.id;
  }
  await prisma.note.update({ where: { id: note.id }, data: { subjectId, topicId } });
  revalidatePath("/notes");
}

/** The user's tasks to pick from when attaching a note, unfinished first. */
export async function listTaskChoices() {
  const user = await requireUser();
  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, status: true, subject: { select: { name: true } } },
    take: 500,
  });
  return [...tasks.filter((task) => task.status !== "FINISHED"), ...tasks.filter((task) => task.status === "FINISHED")];
}

export async function attachNoteToTask(noteId: string, taskId: string) {
  const user = await requireUser();
  const note = await ownedNote(user.id, noteId);
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id }, select: { id: true } });
  if (!task) throw new Error("Task not found.");
  await prisma.taskNote.upsert({ where: { taskId_noteId: { taskId: task.id, noteId: note.id } }, create: { taskId: task.id, noteId: note.id }, update: {} });
  revalidateNoteLinks();
}

export async function detachNoteFromTask(noteId: string, taskId: string) {
  const user = await requireUser();
  const note = await ownedNote(user.id, noteId);
  await prisma.taskNote.deleteMany({ where: { noteId: note.id, taskId } });
  revalidateNoteLinks();
}

/** A new task for this note: its title, subject and topic, with the note attached. */
export async function createTaskFromNote(noteId: string) {
  const user = await requireUser();
  const note = await ownedNote(user.id, noteId);
  const taskId = await createTask({
    title: note.title.slice(0, 160) || "Untitled note",
    subjectId: note.subjectId ?? "",
    topicId: note.topicId ?? "",
    estimatedMinutes: 30,
    priority: "MEDIUM",
    status: "NOT_STARTED",
    noteIds: [note.id],
  });
  revalidatePath("/notes");
  return taskId;
}

/**
 * AI writing inside the note editor: returns sanitized HTML to insert at the cursor.
 * `lang` follows the assistant's language setting.
 */
/**
 * Writes the note with AI. It gets the whole note as it is now and returns the whole note with the
 * instruction applied ("improve", "add examples", "make a table"…) — not a piece to append, which
 * used to leave two copies of everything. The page shows the result with an undo.
 */
export async function generateNoteContent(input: { instruction: string; title: string; currentHtml: string; lang?: "bn" | "en" }) {
  const user = await requireUser();
  const data = z.object({
    instruction: z.string().trim().min(1).max(2000),
    title: z.string().max(200),
    currentHtml: z.string().max(120_000),
    lang: z.enum(["bn", "en"]).optional(),
  }).parse(input);
  const current = sanitizeNoteHtml(data.currentHtml);
  const empty = !htmlToPlainText(current).trim();
  const prompt = `তুমি একজন যত্নশীল শিক্ষক, ব্যবহারকারীর study note লিখতে সাহায্য করছো।
${noteWritingRules}
ভাষা: ${data.lang === "en" ? "English" : "সহজ বাংলা (প্রয়োজনে technical শব্দ ইংরেজিতে)"}।
Note-এর title: ${data.title || "(নেই)"}
${empty ? "Note এখন ফাঁকা — নির্দেশ মতো নতুন করে লেখো।" : `Note-এ এখন যা আছে (HTML):
${current.slice(0, 40_000)}

নির্দেশটা এই note-এর ওপর প্রয়োগ করে **পুরো note-টা আবার দাও** — উন্নত/বদলানো অংশসহ, বাকি অংশ যেমন আছে তেমন রেখে। কোনো অংশ দুবার লিখবে না, পুরোনো লেখার পরে নতুন কপি জুড়বে না। নির্দেশে কিছু যোগ করতে বললে ঠিক জায়গায় বসাবে; বাদ দিতে বললে বাদ দেবে। গণিতের formula আর টেবিল আগের মতোই রাখবে।`}

ব্যবহারকারীর নির্দেশ: ${data.instruction}

শুধু পুরো note-এর HTML দাও, আর কিছু না।`;
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) throw new Error(aiBlockedMessage(blocked, data.lang === "en" ? "en" : "bn"));
  const raw = await callAI(prompt, { userId: user.id, feature: "note_writer", timeoutMs: 55_000 });
  if (!raw) throw new Error(data.lang === "en" ? "The AI isn't responding right now. Please try again in a moment." : "AI এখন সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করো।");
  const html = sanitizeNoteHtml(raw.replace(/^```(?:html)?\s*|\s*```$/g, ""));
  // If the model ignored the HTML rule and sent plain text, wrap its paragraphs.
  return /<(p|h[1-3]|ul|ol|blockquote)\b/i.test(html)
    ? html
    : html.split(/\n{2,}/).map((part) => `<p>${part.trim()}</p>`).join("");
}
