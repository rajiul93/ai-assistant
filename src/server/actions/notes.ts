"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { htmlToPlainText, sanitizeNoteHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { checkAi } from "@/server/ai-access";
import { hasPremium } from "@/server/premium";
import { callAI } from "@/server/assistant/ai";
import { createTask } from "@/server/actions/tasks";
import { writeNoteWithAi } from "@/server/note-writer";
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
 * Writes the note with AI; reference photos arrive as their text, read one by one beforehand
 * through /api/notes/read-image. See writeNoteWithAi.
 */
export async function generateNoteContent(input: { instruction: string; title: string; currentHtml: string; lang?: "bn" | "en"; references?: string[] }) {
  const user = await requireUser();
  return writeNoteWithAi(user, input);
}

/* ---------- Note → Preliminary set (MCQ) with AI ---------- */

export type DraftQuestion = { text: string; options: string[]; correctIndex: number; explanation: string | null };

const quizSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctOption: { type: "INTEGER", description: "1-4: which option is right" },
          explanation: { type: "STRING" },
        },
        required: ["text", "options", "correctOption", "explanation"],
      },
    },
  },
  required: ["questions"],
};

const quizAnswer = z.object({
  questions: z.array(z.object({
    text: z.string().trim().min(1).max(2000),
    options: z.array(z.string().trim().min(1).max(500)),
    correctOption: z.number().int(),
    explanation: z.string().trim().max(2000),
  })),
});

/**
 * MCQs from one of the user's notes, for a Preliminary set — only a draft: nothing is saved until
 * the user has looked at every question with its answer and approved (the page then calls
 * createQuestionSet). Questions come only from what the note says; malformed ones are dropped.
 */
export async function generateQuizFromNote(input: { noteId: string; count: number; lang?: "bn" | "en" }) {
  const user = await requireUser();
  const data = z.object({ noteId: z.string().min(1).max(64), count: z.number().int().min(3).max(50), lang: z.enum(["bn", "en"]).optional() }).parse(input);
  // A paid feature (owner, 2026-10-16): a running plan, or staff.
  if (!(await hasPremium(user))) throw new Error("Note থেকে Preliminary বানানো paid feature — একটা plan নিলে পাবে।");
  const note = await ownedNote(user.id, data.noteId);
  const text = htmlToPlainText(note.content).slice(0, 24_000);
  if (text.length < 40) throw new Error("Note-এ প্রশ্ন বানানোর মতো যথেষ্ট লেখা নেই।");
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) throw new Error(aiBlockedMessage(blocked, data.lang === "en" ? "en" : "bn"));

  // One call writes up to 20 questions in time. More (up to 50) are split over parts of the note
  // asked in parallel — each part its share — so they also cover the whole note without repeats.
  const parts = Math.ceil(data.count / 20);
  const shares = Array.from({ length: parts }, (_, index) => Math.floor(data.count / parts) + (index < data.count % parts ? 1 : 0));
  const chunks = splitText(text, parts);
  const batches = await Promise.all(chunks.map((chunk, index) => quizFromText(user.id, note.title, chunk, shares[index], data.lang, parts > 1 ? `এটা পুরো note-এর ${index + 1}/${parts} অংশ — শুধু এই অংশ থেকে প্রশ্ন করো।` : "")));
  const seen = new Set<string>();
  const questions = batches.flat().filter((question) => {
    const key = question.text.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!questions.length) throw new Error("AI কোনো ঠিকঠাক প্রশ্ন বানাতে পারেনি, আবার চেষ্টা করো।");
  return { questions, topicName: note.title || "Note থেকে প্রশ্ন", subjectId: note.subjectId, topicId: note.topicId };
}

/** The note's text in `parts` pieces of about equal length, cut at line ends. */
function splitText(text: string, parts: number) {
  if (parts <= 1) return [text];
  const lines = text.split("\n");
  const target = text.length / parts;
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current.length >= target && chunks.length < parts - 1) { chunks.push(current); current = ""; }
    current += `${line}\n`;
  }
  chunks.push(current);
  // A short note may give fewer pieces than asked: repeat the whole text so every share is asked for.
  while (chunks.length < parts) chunks.push(text);
  return chunks;
}

/** One AI call: `count` MCQs from `text`; malformed ones are dropped. */
async function quizFromText(userId: string, title: string, text: string, count: number, lang: "bn" | "en" | undefined, partNote: string): Promise<DraftQuestion[]> {
  const prompt = `তুমি বাংলাদেশের চাকরির পরীক্ষার (BCS, প্রাইমারি, ব্যাংক) প্রশ্নকর্তা। নিচের study note থেকে ঠিক ${count}টা MCQ বানাও।${partNote ? `\n${partNote}` : ""}
- প্রতিটা প্রশ্নের ঠিক ৪টা option, একটাই সঠিক (correctOption 1-4); সঠিক উত্তরের জায়গা প্রশ্নভেদে বদলাবে।
- প্রশ্ন আর উত্তর শুধু note-এ যা আছে তা থেকে; note-এ নেই এমন তথ্য বানাবে না। ভুল option-গুলো বিশ্বাসযোগ্য কিন্তু স্পষ্টভাবে ভুল।
- নানা অংশ থেকে প্রশ্ন নাও; একই কথা দুবার জিজ্ঞেস করবে না। "সবগুলো"/"কোনোটিই নয়" ধরনের option এড়াও।
- explanation: কেন এটা সঠিক, এক-দুই লাইনে।
- ভাষা: ${lang === "en" ? "English" : "note যে ভাষায় সেই ভাষায় (সাধারণত বাংলা)"}। গণিত থাকলে LaTeX $…$-এ। কোনো markdown নয়।

Note-এর শিরোনাম: ${title || "(নেই)"}
Note:
${text}`;
  const raw = await callAI(prompt, { responseSchema: quizSchema, userId, feature: "note_writer", timeoutMs: 55_000, reasoning: "low" });
  if (!raw) return [];
  try {
    return quizAnswer.parse(JSON.parse(raw)).questions
      .filter((question) => question.options.length === 4 && question.correctOption >= 1 && question.correctOption <= 4)
      .map((question) => ({ text: question.text, options: question.options, correctIndex: question.correctOption - 1, explanation: question.explanation || null }));
  } catch {
    return [];
  }
}
