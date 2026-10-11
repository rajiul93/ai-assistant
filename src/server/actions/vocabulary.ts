"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bareAffix } from "@/lib/vocabulary/common-affixes";

/** Vocabulary: the user's own table of verbs — present, past, past participle and meaning. */

const verbSchema = z.object({
  present: z.string().trim().min(1, "Present form লেখো").max(80),
  past: z.string().trim().min(1, "Past form লেখো").max(120),
  pastParticiple: z.string().trim().min(1, "Past participle লেখো").max(120),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
});

async function ownedVerb(userId: string, id: string) {
  const verb = await prisma.verbEntry.findFirst({ where: { id, userId } });
  if (!verb) throw new Error("Verb not found.");
  return verb;
}

/** The same verb (any capitalisation) already in the table, other than the one being edited. */
async function existing(userId: string, present: string, exceptId?: string) {
  return prisma.verbEntry.findFirst({ where: { userId, present: { equals: present, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
}

export async function listVerbs() {
  const user = await requireUser();
  return prisma.verbEntry.findMany({
    where: { userId: user.id },
    orderBy: { present: "asc" },
    select: { id: true, present: true, past: true, pastParticiple: true, meaning: true },
  });
}

export async function createVerb(input: unknown) {
  const user = await requireUser();
  const data = verbSchema.parse(input);
  if (await existing(user.id, data.present)) throw new Error(`“${data.present}” আগেই table-এ আছে।`);
  await prisma.verbEntry.create({ data: { userId: user.id, ...data } });
  revalidatePath("/vocabulary");
}

export async function updateVerb(id: string, input: unknown) {
  const user = await requireUser();
  const verb = await ownedVerb(user.id, id);
  const data = verbSchema.parse(input);
  if (await existing(user.id, data.present, verb.id)) throw new Error(`“${data.present}” আগেই table-এ আছে।`);
  await prisma.verbEntry.update({ where: { id: verb.id }, data });
  revalidatePath("/vocabulary");
}

export async function deleteVerb(id: string) {
  const user = await requireUser();
  const verb = await ownedVerb(user.id, id);
  await prisma.verbEntry.delete({ where: { id: verb.id } });
  revalidatePath("/vocabulary");
}

/* ---------- Prefix / suffix table ---------- */

const affixSchema = z.object({
  kind: z.enum(["PREFIX", "SUFFIX"]),
  affix: z.string().trim().min(1, "Prefix/Suffix লেখো").max(40),
  meaning: z.string().trim().min(1, "অর্থ লেখো").max(300),
  example: z.string().trim().max(300),
});

async function ownedAffix(userId: string, id: string) {
  const affix = await prisma.affixEntry.findFirst({ where: { id, userId } });
  if (!affix) throw new Error("Entry not found.");
  return affix;
}

/** The same prefix/suffix (ignoring case and its dashes) already in the table, other than the one being edited. */
async function existingAffix(userId: string, kind: "PREFIX" | "SUFFIX", affix: string, exceptId?: string) {
  const rows = await prisma.affixEntry.findMany({ where: { userId, kind, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { affix: true } });
  return rows.some((row) => bareAffix(row.affix) === bareAffix(affix));
}

export async function listAffixes() {
  const user = await requireUser();
  return prisma.affixEntry.findMany({
    where: { userId: user.id },
    orderBy: [{ kind: "asc" }, { affix: "asc" }],
    select: { id: true, kind: true, affix: true, meaning: true, example: true },
  });
}

export async function createAffix(input: unknown) {
  const user = await requireUser();
  const data = affixSchema.parse(input);
  if (await existingAffix(user.id, data.kind, data.affix)) throw new Error(`“${data.affix}” আগেই table-এ আছে।`);
  await prisma.affixEntry.create({ data: { userId: user.id, ...data } });
  revalidatePath("/vocabulary");
}

export async function updateAffix(id: string, input: unknown) {
  const user = await requireUser();
  const entry = await ownedAffix(user.id, id);
  const data = affixSchema.parse(input);
  if (await existingAffix(user.id, data.kind, data.affix, entry.id)) throw new Error(`“${data.affix}” আগেই table-এ আছে।`);
  await prisma.affixEntry.update({ where: { id: entry.id }, data });
  revalidatePath("/vocabulary");
}

export async function deleteAffix(id: string) {
  const user = await requireUser();
  const entry = await ownedAffix(user.id, id);
  await prisma.affixEntry.delete({ where: { id: entry.id } });
  revalidatePath("/vocabulary");
}
