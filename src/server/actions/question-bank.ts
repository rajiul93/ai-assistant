"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { now, startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { BANK_IMPORT_BATCH, placementForSet, questionFingerprint } from "@/lib/question-bank";
import { placeFor } from "@/server/collaboration/share-copy";
import { isSuperAdminEmail } from "@/server/roles";

/**
 * Question Bank (docs/question-bank-plan.md): shared sets of past exam MCQs, one set per session.
 * Everyone reads them for free and sends a copy to their own Preliminary, where they study and
 * take the exam. Only the super admin uploads (from the sheet) or deletes sets.
 */

const examSchema = z.enum(["BCS", "PRIMARY", "GRADE_11_20"]);
const idSchema = z.string().min(1).max(64);
/** Preliminary's own limit for one set. */
const SET_MAX = 300;

/** The sets of one exam tab with question counts, and whether I already sent each one. */
export async function listBankSets(exam: string) {
  const me = await requireUser();
  const sets = await prisma.bankSet.findMany({
    where: { exam: examSchema.parse(exam) },
    orderBy: [{ section: "asc" }, { name: "asc" }],
    select: { id: true, section: true, name: true, _count: { select: { questions: true } }, copies: { where: { userId: me.id }, select: { id: true } } },
  });
  return sets.map((set) => ({ id: set.id, section: set.section, name: set.name, questionCount: set._count.questions, copyId: set.copies[0]?.id ?? null }));
}

/** One set with every question, answer, solution and explanation (it's for reading). */
export async function getBankSet(id: string) {
  const me = await requireUser();
  const set = await prisma.bankSet.findUnique({
    where: { id: idSchema.parse(id) },
    select: {
      id: true, exam: true, section: true, name: true,
      questions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true } },
      copies: { where: { userId: me.id }, select: { id: true } },
    },
  });
  if (!set) return null;
  const { copies, ...rest } = set;
  return { ...rest, copyId: copies[0]?.id ?? null };
}

/**
 * Copies a bank set into my Preliminary (Todo, dated today), filed under the subject its questions
 * share (a mixed past paper goes under its section). One copy per user: sending again returns the
 * copy I already have; deleting that copy lets me send it afresh.
 */
export async function sendBankSetToPreliminary(id: string) {
  const me = await requireUser();
  const bankSetId = idSchema.parse(id);
  const existing = await prisma.questionSet.findFirst({ where: { userId: me.id, bankSetId }, select: { id: true } });
  if (existing) return { id: existing.id, alreadySent: true };

  const set = await prisma.bankSet.findUnique({
    where: { id: bankSetId },
    select: { section: true, name: true, questions: { orderBy: [{ serial: "asc" }, { id: "asc" }], select: { text: true, options: true, correctIndex: true, solution: true, explanation: true, sources: true } } },
  });
  if (!set) throw new Error("Set পাওয়া যায়নি।");
  if (!set.questions.length) throw new Error("এই set-এ কোনো প্রশ্ন নেই।");
  if (set.questions.length > SET_MAX) throw new Error(`একটা Preliminary set-এ সর্বোচ্চ ${SET_MAX}টি প্রশ্ন রাখা যায় — এখানে ${set.questions.length}টি।`);

  const place = placementForSet(set.section, set.questions.map((question) => question.sources));
  try {
    const copy = await prisma.$transaction(async (tx) => {
      const { subjectId, topicId } = await placeFor(tx, me.id, place.subjectName, place.topicName);
      return tx.questionSet.create({
        data: {
          userId: me.id, subjectId, topicId, bankSetId, topicName: set.name.slice(0, 160), date: startOfDay(now()).toDate(),
          questions: { create: set.questions.map((question, position) => ({ position, text: question.text, options: question.options, correctIndex: question.correctIndex, solution: question.solution, explanation: question.explanation })) },
        },
        select: { id: true },
      });
    });
    revalidatePath("/preliminary");
    revalidatePath("/question-bank");
    return { id: copy.id, alreadySent: false };
  } catch (error) {
    // Two taps at once: the unique (user, bank set) index lets only one copy through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const copy = await prisma.questionSet.findFirst({ where: { userId: me.id, bankSetId }, select: { id: true } });
      if (copy) return { id: copy.id, alreadySent: true };
    }
    throw error;
  }
}

/* ---------- Super admin ---------- */

async function requireSuperAdmin() {
  const me = await requireUser();
  if (!isSuperAdminEmail(me.email)) throw new Error("শুধু super admin এটা করতে পারেন।");
  return me;
}

const rowSchema = z.object({
  exam: examSchema,
  section: z.string().trim().min(1).max(200),
  session: z.string().trim().min(1).max(300),
  serial: z.number().int().min(0).max(1_000_000),
  text: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(4).max(5),
  correctIndex: z.number().int().min(0).max(4),
  solution: z.string().trim().max(5000).nullable(),
  explanation: z.string().trim().max(5000).nullable(),
  sources: z.string().trim().max(1000).nullable(),
}).refine((row) => row.correctIndex < row.options.length, { message: "উত্তরের অক্ষর অপশনের বাইরে" });

/**
 * One batch of checked sheet rows. Sets are found by exam + section + session (created when new);
 * a question is found by its fingerprint inside its set, so uploading the same sheet again updates
 * questions instead of adding them twice. Questions missing from the sheet are left as they are.
 */
export async function importBankRows(input: unknown) {
  await requireSuperAdmin();
  const rows = z.array(rowSchema).min(1).max(BANK_IMPORT_BATCH).parse(input);
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = JSON.stringify([row.exam, row.section, row.session]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  let created = 0, updated = 0, unchanged = 0;
  for (const group of groups.values()) {
    const { exam, section, session } = group[0];
    const set = await prisma.bankSet.upsert({ where: { exam_section_name: { exam, section, name: session } }, create: { exam, section, name: session }, update: {}, select: { id: true } });
    // The same question twice in one batch: the later row wins.
    const byPrint = new Map(group.map((row) => [questionFingerprint(row.text, row.options), row]));
    const existing = await prisma.bankQuestion.findMany({
      where: { setId: set.id, fingerprint: { in: [...byPrint.keys()] } },
      select: { id: true, fingerprint: true, serial: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, sources: true },
    });
    const found = new Map(existing.map((question) => [question.fingerprint, question]));
    const fresh = [...byPrint].filter(([print]) => !found.has(print));
    if (fresh.length) {
      const result = await prisma.bankQuestion.createMany({
        data: fresh.map(([fingerprint, row]) => ({ setId: set.id, fingerprint, serial: row.serial, text: row.text, options: row.options, correctIndex: row.correctIndex, solution: row.solution, explanation: row.explanation, sources: row.sources })),
        skipDuplicates: true,
      });
      created += result.count;
    }
    for (const [print, row] of byPrint) {
      const old = found.get(print);
      if (!old) continue;
      const data = { serial: row.serial, text: row.text, options: row.options, correctIndex: row.correctIndex, solution: row.solution, explanation: row.explanation, sources: row.sources };
      const same = old.serial === data.serial && old.text === data.text && old.correctIndex === data.correctIndex && old.solution === data.solution
        && old.explanation === data.explanation && old.sources === data.sources && JSON.stringify(old.options) === JSON.stringify(data.options);
      if (same) { unchanged++; continue; }
      await prisma.bankQuestion.update({ where: { id: old.id }, data });
      updated++;
    }
  }
  revalidatePath("/question-bank");
  return { created, updated, unchanged };
}

/** All sets for the admin page, every exam. */
export async function listAllBankSets() {
  await requireSuperAdmin();
  const sets = await prisma.bankSet.findMany({
    orderBy: [{ exam: "asc" }, { section: "asc" }, { name: "asc" }],
    select: { id: true, exam: true, section: true, name: true, updatedAt: true, _count: { select: { questions: true, copies: true } } },
  });
  return sets.map(({ _count, ...set }) => ({ ...set, questionCount: _count.questions, copyCount: _count.copies }));
}

/** Removes a set from the bank. Copies already in people's Preliminary stay theirs. */
export async function deleteBankSet(id: string) {
  await requireSuperAdmin();
  await prisma.bankSet.delete({ where: { id: idSchema.parse(id) } });
  revalidatePath("/question-bank");
}
