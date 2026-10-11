"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bareAffix, commonAffixes } from "@/lib/vocabulary/common-affixes";
import { commonNouns, nounKey } from "@/lib/vocabulary/common-nouns";
import { commonVerbs } from "@/lib/vocabulary/common-verbs";
import { isAdminUser } from "@/server/roles";

/**
 * Vocabulary: shared tables of verbs, nouns (singular/plural) and prefixes/suffixes. Everyone sees
 * the built-in lists plus what admins have added; only admins (and the super admin) can add, edit
 * or delete. A word already in a table — built in or added — can't be added again.
 */

/** The signed-in user, if they may change the vocabulary tables. */
async function requireEditor() {
  const user = await requireUser();
  if (!(await isAdminUser(user))) throw new Error("শুধু admin এখানে যোগ, বদল বা মুছতে পারে।");
  return user;
}

const alreadyThere = (word: string) => new Error(`“${word}” আগেই table-এ আছে।`);

/* ---------- Verbs: present · past · past participle · meaning ---------- */

const verbSchema = z.object({
  present: z.string().trim().min(1, "Present form লেখো").max(80),
  past: z.string().trim().min(1, "Past form লেখো").max(120),
  pastParticiple: z.string().trim().min(1, "Past participle লেখো").max(120),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
});

/** The same verb (any capitalisation) in the built-in list or already added, other than the one being edited. */
async function verbExists(present: string, exceptId?: string) {
  if (commonVerbs.some((verb) => verb.present.toLowerCase() === present.toLowerCase())) return true;
  return Boolean(await prisma.verbEntry.findFirst({ where: { present: { equals: present, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } }));
}

export async function listVerbs() {
  await requireUser();
  return prisma.verbEntry.findMany({
    orderBy: { present: "asc" },
    select: { id: true, present: true, past: true, pastParticiple: true, meaning: true },
  });
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
  await prisma.verbEntry.delete({ where: { id } });
  revalidatePath("/vocabulary");
}

/* ---------- Prefix / suffix ---------- */

const affixSchema = z.object({
  kind: z.enum(["PREFIX", "SUFFIX"]),
  affix: z.string().trim().min(1, "Prefix/Suffix লেখো").max(40),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
  example: z.string().trim().max(300),
});

/** The same prefix/suffix (ignoring case and its dashes) built in or already added, other than the one being edited. */
async function affixExists(kind: "PREFIX" | "SUFFIX", affix: string, exceptId?: string) {
  if (commonAffixes.some((entry) => entry.kind === kind && bareAffix(entry.affix) === bareAffix(affix))) return true;
  const rows = await prisma.affixEntry.findMany({ where: { kind, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { affix: true } });
  return rows.some((row) => bareAffix(row.affix) === bareAffix(affix));
}

export async function listAffixes() {
  await requireUser();
  return prisma.affixEntry.findMany({
    orderBy: [{ kind: "asc" }, { affix: "asc" }],
    select: { id: true, kind: true, affix: true, meaning: true, example: true },
  });
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
  await prisma.affixEntry.delete({ where: { id } });
  revalidatePath("/vocabulary");
}

/* ---------- Singular / plural ---------- */

// "-" stands for "used only in the plural" (singular) or "no plural" (plural).
const nounSchema = z.object({
  singular: z.string().trim().min(1, "Singular লেখো (না থাকলে -)").max(80),
  plural: z.string().trim().min(1, "Plural লেখো (না থাকলে -)").max(120),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
}).refine((noun) => noun.singular !== "-" || noun.plural !== "-", "Singular আর Plural দুটোই ফাঁকা হতে পারে না।");

/** The same noun built in or already added, other than the one being edited. */
async function nounExists(noun: { singular: string; plural: string }, exceptId?: string) {
  if (commonNouns.some((entry) => nounKey(entry) === nounKey(noun))) return true;
  const rows = await prisma.nounEntry.findMany({ where: exceptId ? { id: { not: exceptId } } : {}, select: { singular: true, plural: true } });
  return rows.some((row) => nounKey(row) === nounKey(noun));
}

export async function listNouns() {
  await requireUser();
  return prisma.nounEntry.findMany({ orderBy: { singular: "asc" }, select: { id: true, singular: true, plural: true, meaning: true } });
}

export async function createNoun(input: unknown) {
  const user = await requireEditor();
  const data = nounSchema.parse(input);
  if (await nounExists(data)) throw alreadyThere(nounKey(data));
  await prisma.nounEntry.create({ data: { userId: user.id, ...data } });
  revalidatePath("/vocabulary");
}

export async function updateNoun(id: string, input: unknown) {
  await requireEditor();
  const data = nounSchema.parse(input);
  if (await nounExists(data, id)) throw alreadyThere(nounKey(data));
  await prisma.nounEntry.update({ where: { id }, data });
  revalidatePath("/vocabulary");
}

export async function deleteNoun(id: string) {
  await requireEditor();
  await prisma.nounEntry.delete({ where: { id } });
  revalidatePath("/vocabulary");
}
