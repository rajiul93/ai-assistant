import { z } from "zod";

/**
 * Example sentences for a vocabulary word (owner, 2026-10-18): six per word, each with its Bangla —
 * a verb two with each of its three forms, a noun three with the singular and three with the
 * plural, a prefix/suffix six with words made from it. Written with AI by staff, read by paid users.
 */

export type Sentence = { form: string; en: string; bn: string };
export const SENTENCE_COUNT = 6;

export const sentenceSchema = z.object({ form: z.string().trim().min(1).max(80), en: z.string().trim().min(3).max(300), bn: z.string().trim().min(2).max(400) });

/** What is stored, read back safely: anything malformed counts as no sentences. */
export function readSentences(value: unknown): Sentence[] | null {
  const parsed = z.array(sentenceSchema).safeParse(value);
  return parsed.success && parsed.data.length ? parsed.data : null;
}

/** The forms each sentence is written for, in order (the AI is asked for exactly these). */
export function sentencePlan(word: { kind: "VERB"; present: string; past: string; pastParticiple: string } | { kind: "NOUN"; singular: string; plural: string } | { kind: "AFFIX"; affix: string }): string[] {
  if (word.kind === "VERB") return [word.present, word.present, word.past, word.past, word.pastParticiple, word.pastParticiple];
  if (word.kind === "NOUN") {
    const forms = [word.singular, word.plural].filter((form) => form.trim() && form.trim() !== "-");
    return forms.length === 1 ? Array(SENTENCE_COUNT).fill(forms[0]) : [...Array(3).fill(forms[0]), ...Array(3).fill(forms[1])];
  }
  return Array(SENTENCE_COUNT).fill(word.affix);
}
