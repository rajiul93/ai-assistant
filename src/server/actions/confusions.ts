"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { htmlToPlainText, toRichHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";

/**
 * Confusion: doubts noted down to ask in class. Each one sits under Confusion until it is marked
 * Clear, optionally with what made it clear, and can be moved back if the doubt returns.
 * Both texts are rich text from the Quill editor (math as formulas); older entries are plain text.
 */

// The editor's HTML carries the drawn KaTeX of every formula (1–3 KB each), dropped on save, so the
// limits that matter are on the written text (`richText`), not on what arrives.
const confusionSchema = z.object({
  subjectId: z.string().nullable(),
  topic: z.string().trim().max(160),
  topicId: z.string().max(64).nullish(),
  text: z.string().max(200_000),
  clarification: z.string().max(400_000).optional(),
});

/** Editor HTML (or plain text) → sanitized HTML; null when nothing is written. */
function richText(value: string | undefined, maxChars: number, tooLong: string) {
  const html = toRichHtml(value);
  if (html && htmlToPlainText(html).length > maxChars) throw new Error(tooLong);
  return html;
}
const confusionText = (value: string) => {
  const html = richText(value, 4000, "Confusion ৪০০০ অক্ষরের মধ্যে লেখো।");
  if (!html) throw new Error("কী নিয়ে confusion লেখো");
  return html;
};
const clarificationText = (value: string | undefined) => richText(value, 8000, "ব্যাখ্যা ৮০০০ অক্ষরের মধ্যে লেখো।");

async function ownedConfusion(userId: string, id: string) {
  const confusion = await prisma.confusion.findFirst({ where: { id, userId } });
  if (!confusion) throw new Error("Confusion not found.");
  return confusion;
}

/** The topic, if it is the user's and sits under the chosen subject; null when none was picked. */
async function ownedTopic(userId: string, topicId: string | null | undefined, subjectId: string | null) {
  if (!topicId) return null;
  const topic = await prisma.topic.findFirst({ where: { id: topicId, userId }, select: { id: true, subjectId: true } });
  if (!topic || topic.subjectId !== subjectId) throw new Error("Topic-টা এই subject-এর না।");
  return topic.id;
}

async function ownedSubject(userId: string, subjectId: string | null) {
  if (!subjectId) return null;
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
  if (!subject) throw new Error("Subject not found.");
  return subject.id;
}

export async function listConfusions() {
  const user = await requireUser();
  return prisma.confusion.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, subjectId: true, topicId: true, topic: true, text: true, clarification: true, status: true, clearedAt: true, createdAt: true, subject: { select: { name: true } } },
  });
}

export async function createConfusion(input: unknown) {
  const user = await requireUser();
  const data = confusionSchema.parse(input);
  const subjectId = await ownedSubject(user.id, data.subjectId);
  const topicId = await ownedTopic(user.id, data.topicId, subjectId);
  await prisma.confusion.create({ data: { userId: user.id, subjectId, topicId, topic: data.topic || null, text: confusionText(data.text) } });
  revalidatePath("/confusions");
}

export async function updateConfusion(id: string, input: unknown) {
  const user = await requireUser();
  const confusion = await ownedConfusion(user.id, id);
  const data = confusionSchema.parse(input);
  const subjectId = await ownedSubject(user.id, data.subjectId);
  const topicId = await ownedTopic(user.id, data.topicId, subjectId);
  await prisma.confusion.update({
    where: { id: confusion.id },
    data: {
      subjectId,
      topicId,
      topic: data.topic || null,
      text: confusionText(data.text),
      ...(data.clarification !== undefined ? { clarification: clarificationText(data.clarification) } : {}),
    },
  });
  revalidatePath("/confusions");
}

/** Clear (with what made it clear, if written) or back to Confusion. */
export async function setConfusionStatus(id: string, status: "CONFUSION" | "CLEAR", clarification?: string) {
  const user = await requireUser();
  const confusion = await ownedConfusion(user.id, id);
  const next = z.enum(["CONFUSION", "CLEAR"]).parse(status);
  const note = z.string().max(400_000).optional().parse(clarification);
  await prisma.confusion.update({
    where: { id: confusion.id },
    data: next === "CLEAR"
      ? { status: next, clearedAt: new Date(), ...(note !== undefined ? { clarification: clarificationText(note) } : {}) }
      : { status: next, clearedAt: null },
  });
  revalidatePath("/confusions");
}

export async function deleteConfusion(id: string) {
  const user = await requireUser();
  const confusion = await ownedConfusion(user.id, id);
  await prisma.confusion.delete({ where: { id: confusion.id } });
  revalidatePath("/confusions");
}
