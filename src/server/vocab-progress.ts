import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { batchStatus } from "@/lib/vocabulary/exam";

/**
 * A user's vocabulary set and exam standing (src/lib/vocabulary/exam.ts). Server-only and keyed by
 * user id — never export it from a "use server" file.
 */
export const getVocabStatus = cache(async (userId: string) => {
  const [learned, exams] = await Promise.all([
    prisma.vocabLearned.findMany({ where: { userId, kind: { not: "PERSON" } }, select: { batch: true, createdAt: true } }),
    prisma.vocabExam.findMany({ where: { userId }, select: { batch: true, type: true, score: true, total: true, createdAt: true } }),
  ]);
  return { ...batchStatus(learned, exams), learned: learned.length };
});

/** Words in the tables (verbs, nouns, prefixes/suffixes), for "learned of all". */
export async function countVocabWords() {
  const [verbs, nouns, affixes] = await Promise.all([prisma.verbEntry.count(), prisma.nounEntry.count(), prisma.affixEntry.count()]);
  return verbs + nouns + affixes;
}
