import { banglaVerbForms } from "@/lib/vocabulary/bangla-verb";
import { banglaPlural } from "@/lib/vocabulary/nouns";

/**
 * Learned words, flashcards and exams (owner, 2026-10-18). A word the user ticks leaves the lists
 * and goes to "Done". Words are learned in sets of 50: once a set is full, ticking more waits until
 * all three exams on that set (taken after it filled up) reach 80%. A word answered wrong waits in
 * "ভুলগুলো" until it is answered right. The questions come from the tables themselves — no AI.
 */

export const BATCH_SIZE = 50;
export const PASS_PERCENT = 80;
/** Words asked in one exam. */
export const EXAM_SIZE = 20;
/** Pairs on one drag-and-drop screen. */
export const ROUND_SIZE = 5;

export type ExamType = "FORMS" | "MEANING" | "SPELLING";
export type WordKind = "VERB" | "NOUN" | "AFFIX";

export const EXAM_TYPES: Array<{ type: ExamType; title: string; hint: string }> = [
  { type: "FORMS", title: "রূপ মেলাও", hint: "একটা রূপ দেওয়া — অন্যটা টেনে বসাও (go → went)" },
  { type: "MEANING", title: "অর্থ মেলাও", hint: "ইংরেজি শব্দের পাশে বাংলা অর্থ টেনে বসাও" },
  { type: "SPELLING", title: "বানান", hint: "বাংলা দেখে আর শুনে ইংরেজি বানান লেখো" },
];

export type CardForm = { label: string; english: string; bangla: string };
/** A learned word as a flashcard: the word, its meaning and its other forms. */
export type VocabCard = { key: string; kind: WordKind; entryId: string; word: string; meaning: string; forms: CardForm[] };

const present = (value: string) => value.trim() && value.trim() !== "-";

export function verbCard(verb: { id: string; present: string; past: string; pastParticiple: string; meaning: string }): VocabCard {
  const bangla = banglaVerbForms(verb.meaning, verb.present);
  return {
    key: `VERB:${verb.id}`, kind: "VERB", entryId: verb.id, word: verb.present, meaning: verb.meaning,
    forms: [
      { label: "Present", english: verb.present, bangla: verb.meaning },
      { label: "Past", english: verb.past, bangla: bangla.past },
      { label: "Past participle", english: verb.pastParticiple, bangla: bangla.pastParticiple },
    ],
  };
}

export function nounCard(noun: { id: string; singular: string; plural: string; meaning: string; person: boolean }): VocabCard {
  const forms: CardForm[] = [];
  if (present(noun.singular)) forms.push({ label: "Singular", english: noun.singular, bangla: noun.meaning });
  if (present(noun.plural)) forms.push({ label: "Plural", english: noun.plural, bangla: present(noun.singular) ? banglaPlural(noun.meaning, noun.person) : noun.meaning });
  return { key: `NOUN:${noun.id}`, kind: "NOUN", entryId: noun.id, word: present(noun.singular) ? noun.singular : noun.plural, meaning: noun.meaning, forms };
}

/** "unhappy — অসুখী" → ["unhappy", "অসুখী"]. */
export function splitExample(example: string): [english: string, bangla: string] {
  const [english = "", ...rest] = example.split(/\s[—–-]\s|—|–/);
  return [english.trim(), rest.join(" ").trim()];
}

export function affixCard(affix: { id: string; kind: "PREFIX" | "SUFFIX"; affix: string; meaning: string; example: string }): VocabCard {
  const [english, bangla] = splitExample(affix.example);
  const forms: CardForm[] = [{ label: affix.kind === "PREFIX" ? "Prefix" : "Suffix", english: affix.affix, bangla: affix.meaning }];
  if (/^[A-Za-z][A-Za-z' -]*$/.test(english)) forms.push({ label: "উদাহরণ", english, bangla });
  return { key: `AFFIX:${affix.id}`, kind: "AFFIX", entryId: affix.id, word: affix.affix, meaning: affix.meaning, forms };
}

/** A drag-and-drop pair: the prompt stays, the answer is dragged onto it. */
export type MatchItem = { key: string; prompt: string; label: string; answer: string };
/** A spelling question: the Bangla (and the word it comes from) shown, the English typed. */
export type SpellItem = { key: string; prompt: string; label: string; given: string; answer: string };

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

const pick = <T,>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)];

/** Given one form, the other: verbs present → past or past participle, nouns singular ↔ plural, affix → example. */
export function formItem(card: VocabCard, random: () => number = Math.random): MatchItem | null {
  if (card.forms.length < 2) return null;
  const [first, ...others] = card.forms;
  const target = pick(others, random);
  // A noun is asked either way round.
  if (card.kind === "NOUN" && random() < 0.5) return { key: card.key, prompt: target.english, label: `${first.label}?`, answer: first.english };
  return { key: card.key, prompt: first.english, label: `${target.label}?`, answer: target.english };
}

export const meaningItem = (card: VocabCard): MatchItem => ({ key: card.key, prompt: card.word, label: "অর্থ?", answer: card.meaning });

export function spellItem(card: VocabCard, random: () => number = Math.random): SpellItem | null {
  const forms = card.kind === "AFFIX" ? card.forms.slice(1) : card.forms;
  const form = forms.length ? pick(forms, random) : null;
  if (!form || !form.bangla) return null;
  const base = card.forms[0];
  // A verb's past form is asked from its present ("go → Past"), the rest from the Bangla alone.
  const fromBase = card.kind === "VERB" && form !== base;
  return { key: card.key, prompt: form.bangla, label: form.label, given: fromBase ? base.english : "", answer: form.english };
}

/** An exam's questions: up to `EXAM_SIZE` words, in a random order. */
export function buildExam(type: ExamType, cards: readonly VocabCard[], random: () => number = Math.random) {
  const chosen = shuffle(cards, random);
  const items: Array<MatchItem | SpellItem> = [];
  for (const card of chosen) {
    if (items.length >= EXAM_SIZE) break;
    const item = type === "FORMS" ? formItem(card, random) : type === "MEANING" ? meaningItem(card) : spellItem(card, random);
    if (item) items.push(item);
  }
  return items;
}

/** Splits drag-and-drop items into screens of `ROUND_SIZE`, never leaving one lonely pair at the end. */
export function rounds<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += ROUND_SIZE) out.push(items.slice(start, start + ROUND_SIZE));
  if (out.length > 1 && out[out.length - 1].length === 1) out[out.length - 2].push(...out.pop()!);
  return out;
}

const normal = (text: string) => text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

/** A typed spelling against the answer; "learned/learnt" or "dreamed, dreamt" accept either. */
export function spellingMatches(typed: string, answer: string) {
  const want = normal(typed);
  return Boolean(want) && answer.split(/\/|,|\bor\b/).some((option) => normal(option) === want);
}

/** A dragged answer against the slot's: the same text counts, even if it came from another pair. */
export const matchCorrect = (placed: string | undefined, answer: string) => placed !== undefined && normal(placed) === normal(answer);

export type BatchStatus = {
  batch: number;
  inBatch: number;
  full: boolean;
  /** Best score (0–100) per exam on this set — after it filled up, once it is full. */
  best: Record<ExamType, number | null>;
  passed: boolean;
  /** Full and not yet passed: no more ticks until the exams are passed. */
  locked: boolean;
  /** The three best scores averaged (a missing exam counts 0): the home page's bar. */
  score: number;
};

/**
 * Where a user stands with their current set. `learned` are their word ticks (not the person
 * table); `exams` their stored exams.
 */
export function batchStatus(learned: ReadonlyArray<{ batch: number; createdAt: Date }>, exams: ReadonlyArray<{ batch: number; type: ExamType; score: number; total: number; createdAt: Date }>): BatchStatus {
  const batch = learned.reduce((most, row) => Math.max(most, row.batch), 1);
  const rows = learned.filter((row) => row.batch === batch).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const full = rows.length >= BATCH_SIZE;
  // Exams count only once the set was complete: a quick pass on ten words doesn't open the next fifty.
  const since = full ? rows[BATCH_SIZE - 1].createdAt.getTime() : 0;
  const best = { FORMS: null, MEANING: null, SPELLING: null } as Record<ExamType, number | null>;
  for (const exam of exams) {
    if (exam.batch !== batch || exam.createdAt.getTime() < since || !exam.total) continue;
    const percent = Math.round((exam.score / exam.total) * 100);
    best[exam.type] = Math.max(best[exam.type] ?? 0, percent);
  }
  const passed = full && EXAM_TYPES.every(({ type }) => (best[type] ?? 0) >= PASS_PERCENT);
  const score = Math.round(EXAM_TYPES.reduce((sum, { type }) => sum + (best[type] ?? 0), 0) / EXAM_TYPES.length);
  return { batch, inBatch: rows.length, full, best, passed, locked: full && !passed, score };
}

/** The set a new tick goes into, or null while the current one is locked. */
export const batchForNewWord = (status: BatchStatus) => (status.passed ? status.batch + 1 : status.locked ? null : status.batch);
