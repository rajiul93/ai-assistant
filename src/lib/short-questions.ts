import { likeness, normalizeForMatch, sameText } from "@/lib/preliminary";

/** Short Question: a question and its written answer (no options). */
export type DraftShortQuestion = { text: string; answer: string };

/** Where the two AI readings of a page disagree, or the spelling check doubts a word. */
export type ShortReview = {
  text?: string[];
  answer?: string[];
  onlyOnce?: boolean;
  /** Field (0 = question, 1 = answer) → a word the spelling check doubts. */
  words?: Record<number, string>;
};
export type ReviewedShortQuestion = DraftShortQuestion & { review?: ShortReview };

export type ShortAttemptDetail = { text: string; answer: string; given: string; right: boolean | null };

/** Same wording of question and answer, however it was spaced or punctuated. */
export const shortQuestionKey = (question: DraftShortQuestion) => `${normalizeForMatch(question.text)}\u0000${normalizeForMatch(question.answer)}`;

/** Keeps the first copy of every question. */
export function withoutDuplicateShorts<T extends DraftShortQuestion>(questions: T[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = shortQuestionKey(question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A written answer that says exactly the answer (ignoring spacing and punctuation) is marked right without asking. */
export const answersMatch = (given: string, answer: string) => Boolean(given.trim()) && normalizeForMatch(given) === normalizeForMatch(answer);

const ANSWER_START = /^(?:\*\*)?\s*(?:উত্তর|উঃ|উ:|answer|ans)\s*(?:\*\*)?\s*[:：.\-–—)]\s*(?:\*\*)?\s*/i;
const QUESTION_START = /^(?:\*\*)?\s*(?:(?:প্রশ্ন|প্রঃ|question|q)\s*[\d০-৯]*\s*[:：.)]|[\d০-৯]+\s*[.)।])\s*(?:\*\*)?\s*/i;

/**
 * Many question–answer pairs pasted as text → questions. Each question is followed by its answer
 * on a line starting "উত্তর:" / "Ans:"; a new numbered line or "প্রশ্ন:" starts the next one.
 *
 *   ১. বাংলা একাডেমি কবে প্রতিষ্ঠিত হয়?
 *   উত্তর: ৩ ডিসেম্বর ১৯৫৫
 */
export function parseShortText(input: string): { questions: DraftShortQuestion[]; skipped: number } {
  const questions: DraftShortQuestion[] = [];
  let skipped = 0;
  let current: { text: string[]; answer: string[] | null } | null = null;
  const flush = () => {
    if (!current) return;
    const text = current.text.join(" ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    const answer = (current.answer ?? []).join("\n").replace(/\*\*/g, "").trim();
    if (text && answer) questions.push({ text, answer });
    else if (text || answer) skipped++;
    current = null;
  };
  for (const raw of input.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { if (current?.answer?.length) flush(); continue; }
    // "প্রশ্ন … উত্তর: …" on one line.
    const inline = /^(.*?\S)\s+(?:উত্তর|answer|ans)\s*[:：]\s*(.+)$/i.exec(line);
    if (inline && !ANSWER_START.test(line)) {
      flush();
      current = { text: [inline[1].replace(QUESTION_START, "")], answer: [inline[2]] };
      continue;
    }
    if (ANSWER_START.test(line)) {
      current ??= { text: [], answer: null };
      current.answer = [...(current.answer ?? []), line.replace(ANSWER_START, "")];
      continue;
    }
    if (QUESTION_START.test(line) || current?.answer?.length) flush();
    current ??= { text: [], answer: null };
    if (current.answer) current.answer.push(line);
    else current.text.push(line.replace(QUESTION_START, ""));
  }
  flush();
  return { questions, skipped };
}

const SPOKEN_ANSWER = /^(?:সঠিক\s*)?(?:উত্তর|answer)\s*(?:হলো|হল|হচ্ছে|is)?\s*[:：,।-]?\s*(\S.*)$/i;

/** One dictated sentence → a line parseShortText understands: "উত্তর হলো ঢাকা" → "উত্তর: ঢাকা" (and a blank line after). */
export function spokenShortLine(sentence: string) {
  const answer = SPOKEN_ANSWER.exec(sentence.trim());
  return answer ? `উত্তর: ${answer[1].replace(/[।.]$/, "")}\n` : sentence.trim();
}

export type ExtractedShortQuestion = { text: string; answer: string };

/**
 * Two independent readings of the same page → one list. Fields both read the same are trusted;
 * where they differ both readings are kept for the user to pick; a question only one found is flagged.
 */
export function mergeShortReadings(first: ExtractedShortQuestion[], second: ExtractedShortQuestion[]): ReviewedShortQuestion[] {
  const used = new Set<number>();
  const merged: ReviewedShortQuestion[] = [];
  for (const [index, question] of first.entries()) {
    let match = second[index] && likeness(question.text, second[index].text) > 0.5 ? index : -1;
    if (match < 0) {
      let best = 0.5;
      second.forEach((other, position) => { const score = likeness(question.text, other.text); if (!used.has(position) && score > best) { best = score; match = position; } });
    }
    if (match < 0 || used.has(match)) { merged.push({ ...question, review: { onlyOnce: true } }); continue; }
    used.add(match);
    const other = second[match];
    const review: ShortReview = {};
    if (!sameText(question.text, other.text)) review.text = [question.text, other.text];
    if (!sameText(question.answer, other.answer)) review.answer = [question.answer, other.answer].filter(Boolean);
    merged.push({ text: question.text, answer: question.answer || other.answer, ...(Object.keys(review).length ? { review } : {}) });
  }
  second.forEach((question, position) => { if (!used.has(position)) merged.push({ ...question, review: { onlyOnce: true } }); });
  return merged;
}

/** Adds the spelling check's doubts, naming the doubtful word (both readings can make the same mistake). */
export function addShortDoubts(questions: ReviewedShortQuestion[], doubts: Array<{ question: number; field: number; word: string }>): ReviewedShortQuestion[] {
  return questions.map((question, index) => {
    const mine = doubts.filter((doubt) => doubt.question === index);
    if (!mine.length) return question;
    const review: ShortReview = { ...question.review, words: { ...question.review?.words } };
    for (const doubt of mine) {
      if (doubt.field === 0) review.text ??= [question.text];
      else review.answer ??= [question.answer];
      review.words![doubt.field] = doubt.word;
    }
    return { ...question, review };
  });
}

/** How many fields still wait for the user to check. */
export const shortReviewCount = (questions: ReviewedShortQuestion[]) =>
  questions.reduce((total, question) => total + (question.review ? (question.review.onlyOnce ? 1 : 0) + (question.review.text ? 1 : 0) + (question.review.answer ? 1 : 0) : 0), 0);
