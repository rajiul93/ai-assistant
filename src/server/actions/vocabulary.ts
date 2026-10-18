"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bareAffix } from "@/lib/vocabulary/affixes";
import { namesAPerson, nounKey } from "@/lib/vocabulary/nouns";
import { readSentences } from "@/lib/vocabulary/sentences";
import { hasPremium } from "@/server/premium";
import { can } from "@/server/roles";
import { userError } from "@/lib/user-error";
import { batchForNewWord, BATCH_SIZE, PASS_PERCENT } from "@/lib/vocabulary/exam";
import { getVocabStatus } from "@/server/vocab-progress";

/**
 * Vocabulary: shared tables of verbs, nouns (singular/plural) and prefixes/suffixes, all in the
 * database — the built-in rows are loaded by prisma/seed-vocabulary.ts (no userId), admins add the
 * rest. Everyone reads them and marks rows learned for themselves; only admins (and the super admin)
 * add, edit or delete, and a word already in a table can't be added again.
 */

/** The signed-in user, if they may change the vocabulary tables. */
async function requireEditor() {
  const user = await requireUser();
  if (!(await can(user, "vocabulary"))) throw userError("যোগ, বদল বা মুছতে শব্দভান্ডার permission লাগবে।");
  return user;
}

/**
 * A word's Bangla explanation and its example sentences are for paid users (and staff) only:
 * others get only whether they exist, so the text never reaches their page (owner, 2026-10-15,
 * sentences 2026-10-18).
 */
function gateExplanation<T extends { explanation: string | null; sentences: Prisma.JsonValue }>(rows: T[], premium: boolean) {
  return rows.map(({ sentences: stored, ...row }) => {
    const sentences = readSentences(stored);
    return { ...row, explanation: premium ? row.explanation : null, hasExplanation: Boolean(row.explanation), sentences: premium ? sentences : null, hasSentences: Boolean(sentences) };
  });
}

const alreadyThere = (word: string) => new Error(`“${word}” আগেই table-এ আছে।`);

/* ---------- Verbs: present · past · past participle · meaning ---------- */

const verbSchema = z.object({
  present: z.string().trim().min(1, "Present form লেখো").max(80),
  past: z.string().trim().min(1, "Past form লেখো").max(120),
  pastParticiple: z.string().trim().min(1, "Past participle লেখো").max(120),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
});

/** The same verb (any capitalisation) already in the table, other than the one being edited. */
async function verbExists(present: string, exceptId?: string) {
  return Boolean(await prisma.verbEntry.findFirst({ where: { present: { equals: present, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } }));
}

export async function listVerbs() {
  const user = await requireUser();
  const [rows, premium] = await Promise.all([prisma.verbEntry.findMany({
    orderBy: { present: "asc" },
    select: { id: true, present: true, past: true, pastParticiple: true, meaning: true, explanation: true, sentences: true, userId: true },
  }), hasPremium(user)]);
  return gateExplanation(rows, premium);
}

export async function createVerb(input: unknown) {
  const user = await requireEditor();
  const data = verbSchema.parse(input);
  if (await verbExists(data.present)) throw alreadyThere(data.present);
  await prisma.verbEntry.create({ data: { userId: user.id, ...data } });
  revalidatePath("/vocabulary");
}

export async function updateVerb(id: string, input: unknown) {
  await requireEditor();
  const data = verbSchema.parse(input);
  if (await verbExists(data.present, id)) throw alreadyThere(data.present);
  await prisma.verbEntry.update({ where: { id }, data });
  revalidatePath("/vocabulary");
}

export async function deleteVerb(id: string) {
  await requireEditor();
  await prisma.$transaction([prisma.vocabLearned.deleteMany({ where: { kind: "VERB", entryId: id } }), prisma.verbEntry.delete({ where: { id } })]);
  revalidatePath("/vocabulary");
}

/* ---------- Prefix / suffix ---------- */

const affixSchema = z.object({
  kind: z.enum(["PREFIX", "SUFFIX"]),
  affix: z.string().trim().min(1, "Prefix/Suffix লেখো").max(40),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
  example: z.string().trim().max(300),
});

/** The same prefix/suffix (ignoring case and its dashes) already in the table, other than the one being edited. */
async function affixExists(kind: "PREFIX" | "SUFFIX", affix: string, exceptId?: string) {
  const rows = await prisma.affixEntry.findMany({ where: { kind, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { affix: true } });
  return rows.some((row) => bareAffix(row.affix) === bareAffix(affix));
}

export async function listAffixes() {
  const user = await requireUser();
  const [rows, premium] = await Promise.all([prisma.affixEntry.findMany({
    orderBy: [{ kind: "asc" }, { affix: "asc" }],
    select: { id: true, kind: true, affix: true, meaning: true, example: true, explanation: true, sentences: true, userId: true },
  }), hasPremium(user)]);
  return gateExplanation(rows, premium);
}

export async function createAffix(input: unknown) {
  const user = await requireEditor();
  const data = affixSchema.parse(input);
  if (await affixExists(data.kind, data.affix)) throw alreadyThere(data.affix);
  await prisma.affixEntry.create({ data: { userId: user.id, ...data } });
  revalidatePath("/vocabulary");
}

export async function updateAffix(id: string, input: unknown) {
  await requireEditor();
  const data = affixSchema.parse(input);
  if (await affixExists(data.kind, data.affix, id)) throw alreadyThere(data.affix);
  await prisma.affixEntry.update({ where: { id }, data });
  revalidatePath("/vocabulary");
}

export async function deleteAffix(id: string) {
  await requireEditor();
  await prisma.$transaction([prisma.vocabLearned.deleteMany({ where: { kind: "AFFIX", entryId: id } }), prisma.affixEntry.delete({ where: { id } })]);
  revalidatePath("/vocabulary");
}

/* ---------- Singular / plural ---------- */

// "-" stands for "used only in the plural" (singular) or "no plural" (plural).
const nounSchema = z.object({
  singular: z.string().trim().min(1, "Singular লেখো (না থাকলে -)").max(80),
  plural: z.string().trim().min(1, "Plural লেখো (না থাকলে -)").max(120),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
}).refine((noun) => noun.singular !== "-" || noun.plural !== "-", "Singular আর Plural দুটোই ফাঁকা হতে পারে না।");

/** The same noun already in the table, other than the one being edited. */
async function nounExists(noun: { singular: string; plural: string }, exceptId?: string) {
  const rows = await prisma.nounEntry.findMany({ where: exceptId ? { id: { not: exceptId } } : {}, select: { singular: true, plural: true } });
  return rows.some((row) => nounKey(row) === nounKey(noun));
}

export async function listNouns() {
  const user = await requireUser();
  const [rows, premium] = await Promise.all([
    prisma.nounEntry.findMany({ orderBy: { singular: "asc" }, select: { id: true, singular: true, plural: true, meaning: true, person: true, explanation: true, sentences: true, userId: true } }),
    hasPremium(user),
  ]);
  return gateExplanation(rows, premium);
}

export async function createNoun(input: unknown) {
  const user = await requireEditor();
  const data = nounSchema.parse(input);
  if (await nounExists(data)) throw alreadyThere(nounKey(data));
  await prisma.nounEntry.create({ data: { userId: user.id, ...data, person: namesAPerson(data.meaning) } });
  revalidatePath("/vocabulary");
}

export async function updateNoun(id: string, input: unknown) {
  await requireEditor();
  const data = nounSchema.parse(input);
  if (await nounExists(data, id)) throw alreadyThere(nounKey(data));
  await prisma.nounEntry.update({ where: { id }, data: { ...data, person: namesAPerson(data.meaning) } });
  revalidatePath("/vocabulary");
}

export async function deleteNoun(id: string) {
  await requireEditor();
  await prisma.$transaction([prisma.vocabLearned.deleteMany({ where: { kind: "NOUN", entryId: id } }), prisma.nounEntry.delete({ where: { id } })]);
  revalidatePath("/vocabulary");
}

/* ---------- What each user has learned ---------- */

const learnedSchema = z.object({ kind: z.enum(["VERB", "NOUN", "AFFIX", "PERSON"]), entryId: z.string().min(1).max(120), learned: z.boolean() });

/** The rows this user has ticked ("KIND:id"), each with its set and whether it waits for revision; and where they stand. */
export async function getVocabState() {
  const user = await requireUser();
  const [rows, status] = await Promise.all([
    prisma.vocabLearned.findMany({ where: { userId: user.id }, select: { kind: true, entryId: true, batch: true, missedAt: true } }),
    getVocabStatus(user.id),
  ]);
  return { learned: rows.map((row) => ({ key: `${row.kind}:${row.entryId}`, batch: row.batch, missed: Boolean(row.missedAt) })), status };
}

/**
 * Ticks (or unticks) one row for the signed-in user only. A word goes into the current set of 50;
 * a full set takes no more until its three exams are passed (the person table is never locked).
 */
export async function setLearned(input: unknown) {
  const user = await requireUser();
  const { kind, entryId, learned } = learnedSchema.parse(input);
  const key = { userId_kind_entryId: { userId: user.id, kind, entryId } };
  if (!learned) {
    await prisma.vocabLearned.deleteMany({ where: { userId: user.id, kind, entryId } });
  } else if (kind === "PERSON") {
    await prisma.vocabLearned.upsert({ where: key, create: { userId: user.id, kind, entryId }, update: {} });
  } else {
    const batch = batchForNewWord(await getVocabStatus(user.id));
    if (batch === null) throw userError(`${BATCH_SIZE}টা শব্দ শেখা হয়েছে — নতুন শব্দ নিতে আগে Done-এ তিনটা exam দাও, প্রতিটায় ${PASS_PERCENT}% পেতে হবে।`);
    await prisma.vocabLearned.upsert({ where: key, create: { userId: user.id, kind, entryId, batch }, update: {} });
  }
  revalidatePath("/dashboard");
}

const examSchema = z.object({
  type: z.enum(["FORMS", "MEANING", "SPELLING"]),
  /** A revision of "ভুলগুলো": marks words but isn't stored as a set exam. */
  revision: z.boolean(),
  results: z.array(z.object({ kind: z.enum(["VERB", "NOUN", "AFFIX"]), entryId: z.string().min(1).max(120), correct: z.boolean() })).min(1).max(100),
});

/**
 * One finished exam: every word answered wrong waits in "ভুলগুলো", every word answered right leaves
 * it; a set exam's score is kept for the 80% rule.
 */
export async function finishVocabExam(input: unknown) {
  const user = await requireUser();
  const { type, revision, results } = examSchema.parse(input);
  const now = new Date();
  const mark = (correct: boolean) => results.filter((result) => result.correct === correct).map(({ kind, entryId }) => ({ kind, entryId }));
  const status = await getVocabStatus(user.id);
  const wrong = mark(false);
  const right = mark(true);
  await prisma.$transaction([
    ...(wrong.length ? [prisma.vocabLearned.updateMany({ where: { userId: user.id, OR: wrong }, data: { missedAt: now } })] : []),
    ...(right.length ? [prisma.vocabLearned.updateMany({ where: { userId: user.id, OR: right }, data: { missedAt: null } })] : []),
    ...(revision ? [] : [prisma.vocabExam.create({ data: { userId: user.id, batch: status.batch, type, score: right.length, total: results.length } })]),
  ]);
  revalidatePath("/dashboard");
  revalidatePath("/vocabulary");
}
