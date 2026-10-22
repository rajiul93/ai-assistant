"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MESSAGE_MAX } from "@/lib/collaboration";
import { textToFormulaHtml } from "@/lib/math";
import { toRichHtml } from "@/lib/note-html";
import { OPTION_LETTERS } from "@/lib/preliminary";
import { prisma } from "@/lib/prisma";
import { userError } from "@/lib/user-error";
import { friendIdsOf, personSelect, publicPerson } from "@/server/collaboration/people";
import { openConversation, sendMessage } from "@/server/actions/messages";
import { sendGroupMessage } from "@/server/actions/groups";

/**
 * One Preliminary question that confuses the student: noted in Confusion, or sent to friends and
 * groups in chat to ask about it. Only from the student's own set and never while it is in Testing
 * (the answer is part of what is sent). Solutions and explanations are left out: they are a paid
 * feature and stay with the set.
 */

const idSchema = z.string().min(1).max(64);
const noteSchema = z.string().trim().max(1000).optional();

async function ownQuestion(userId: string, questionId: string) {
  const question = await prisma.question.findFirst({
    where: { id: questionId, set: { userId } },
    select: { text: true, options: true, correctIndex: true, set: { select: { topicName: true, subjectId: true, topicId: true, status: true } } },
  });
  if (!question) throw userError("প্রশ্নটা পাওয়া যায়নি।");
  if (question.set.status === "TESTING") throw userError("Test চলার সময় প্রশ্ন পাঠানো যাবে না।");
  return question;
}

/** Saves the question (with its options and answer) as a new Confusion under the set's subject and topic. */
export async function questionToConfusion(input: unknown) {
  const user = await requireUser();
  const { questionId, note } = z.object({ questionId: idSchema, note: noteSchema }).parse(input);
  const question = await ownQuestion(user.id, questionId);
  const right = question.options[question.correctIndex];
  const html = toRichHtml([
    note ? `<p><strong>আমার প্রশ্ন:</strong> ${textToFormulaHtml(note)}</p>` : "",
    `<p>${textToFormulaHtml(question.text)}</p>`,
    ...question.options.map((option, index) => `<p>${OPTION_LETTERS[index]}) ${textToFormulaHtml(option)}</p>`),
    right === undefined ? "" : `<p><strong>সঠিক উত্তর:</strong> ${OPTION_LETTERS[question.correctIndex]}) ${textToFormulaHtml(right)}</p>`,
  ].join(""));
  if (!html) throw userError("প্রশ্নটা খালি।");
  await prisma.confusion.create({
    data: { userId: user.id, subjectId: question.set.subjectId, topicId: question.set.topicId, topic: question.set.topicName.slice(0, 160) || null, text: html },
  });
  revalidatePath("/confusions");
}

/** Friends and groups the question can be sent to. */
export async function chatTargets() {
  const me = await requireUser();
  const friendIds = await friendIdsOf(me.id);
  const [friends, groups] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: friendIds }, status: "ACTIVE" }, select: personSelect, orderBy: { name: "asc" } }),
    prisma.chatGroup.findMany({
      where: { members: { some: { userId: me.id } } },
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: { id: true, name: true },
    }),
  ]);
  return { friends: friends.map((user) => publicPerson(user, true)), groups };
}

/**
 * Sends the question as a chat message to each chosen friend and group. Each send goes through the
 * normal chat actions, so friendship and membership are checked there as for any message.
 */
export async function questionToChat(input: unknown) {
  const me = await requireUser();
  const { questionId, note, friendIds, groupIds } = z.object({
    questionId: idSchema,
    note: noteSchema,
    friendIds: z.array(idSchema).max(50),
    groupIds: z.array(idSchema).max(50),
  }).parse(input);
  if (!friendIds.length && !groupIds.length) throw userError("কাকে পাঠাবে বেছে নাও।");
  const question = await ownQuestion(me.id, questionId);
  const right = question.options[question.correctIndex];
  const body = [
    note ? `${note}\n` : "",
    `📘 ${question.set.topicName}`,
    question.text,
    ...question.options.map((option, index) => `${OPTION_LETTERS[index]}) ${option}`),
    right === undefined ? "" : `✅ সঠিক উত্তর: ${OPTION_LETTERS[question.correctIndex]}) ${right}`,
  ].filter(Boolean).join("\n").slice(0, MESSAGE_MAX);

  let sent = 0;
  for (const friendId of [...new Set(friendIds)]) {
    await sendMessage({ conversationId: await openConversation(friendId), body });
    sent++;
  }
  for (const groupId of [...new Set(groupIds)]) {
    await sendGroupMessage({ groupId, body });
    sent++;
  }
  return { sent };
}
