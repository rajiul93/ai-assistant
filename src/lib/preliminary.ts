import type { QuestionSetStatus } from "@prisma/client";

export const OPTION_LETTERS = ["ক", "খ", "গ", "ঘ"] as const;

export const statusInfo: Record<QuestionSetStatus, { label: string; hint: string; tone: string; dot: string }> = {
  TODO: { label: "Todo", hint: "নতুন set, এখনো পড়া শুরু হয়নি", tone: "text-zinc-700", dot: "bg-zinc-400" },
  DOING: { label: "Doing", hint: "পড়ার সময় — উত্তর দেখা যায়", tone: "text-sky-700", dot: "bg-sky-500" },
  TESTING: { label: "Testing", hint: "Exam — উত্তর লুকানো", tone: "text-amber-700", dot: "bg-amber-500" },
  DONE: { label: "Done", hint: "Test শেষ", tone: "text-emerald-700", dot: "bg-emerald-500" },
};

export const statusOrder: QuestionSetStatus[] = ["TODO", "DOING", "TESTING", "DONE"];

export type DraftQuestion = { text: string; options: [string, string, string, string]; correctIndex: number };

const LETTER_INDEX: Record<string, number> = { ক: 0, খ: 1, গ: 2, ঘ: 3, a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3, "১": 0, "২": 1, "৩": 2, "৪": 3 };
/** "ক)", "(খ)", "গ.", "ঘ:", "a)", "B." … at the start of a line (or inside one, for options on one line). */
const OPTION_MARK = /(?:^|\s)[(（]?([কখগঘ]|[a-dA-D])[)）.:।]\s*/g;
const ANSWER_LINE = /^(?:\*\*)?\s*(?:correct\s*answer|answer|ans|সঠিক\s*উত্তর|উত্তর)\s*(?:\*\*)?\s*[:：\-–—]\s*(?:\*\*)?\s*[(（]?([কখগঘ]|[a-dA-D]|[1-4১-৪])/i;

/**
 * Many MCQs pasted as text → questions. Understands the usual book/handout shape:
 *
 *   ‘পরমেশ’ শব্দটির সঠিক সন্ধি বিচ্ছেদ কোনটি?
 *   ক) পরম + এশ   খ) পরম + ঈশ   গ) পরম + ইশ   ঘ) পরম + ঈশা
 *   Correct Answer: খ) পরম + ঈশ
 *
 * Questions whose four options or answer can't be found are reported back instead of guessed.
 */
export function parseMcqText(input: string): { questions: DraftQuestion[]; skipped: number } {
  const lines = input.replace(/\r/g, "").split("\n").map((line) => line.trim());
  const blocks: string[][] = [];
  let current: string[] = [];
  const flush = () => { if (current.some(Boolean)) blocks.push(current.filter(Boolean)); current = []; };
  for (const line of lines) {
    // A blank line after an answer, or a new "প্রশ্ন:"/"Q1." line, starts the next question.
    const startsQuestion = /^(?:\*\*)?\s*(?:প্রশ্ন|question|q)\s*[\d০-৯]*\s*[:：.)]/i.test(line) || /^[\d০-৯]+\s*[.)।]\s+\S/.test(line);
    if (startsQuestion && current.some((item) => ANSWER_LINE.test(item))) flush();
    if (!line && current.some((item) => ANSWER_LINE.test(item))) { flush(); continue; }
    current.push(line);
  }
  flush();

  const questions: DraftQuestion[] = [];
  let skipped = 0;
  for (const block of blocks) {
    let answer = -1;
    const body: string[] = [];
    for (const line of block) {
      const match = ANSWER_LINE.exec(line);
      if (match) answer = LETTER_INDEX[match[1].toLowerCase()] ?? LETTER_INDEX[match[1]] ?? -1;
      else body.push(line);
    }
    // Options may be one per line or several on a line: split the whole body at the option marks.
    const joined = body.join("\n");
    const marks = [...joined.matchAll(OPTION_MARK)];
    const first = marks.findIndex((mark) => (LETTER_INDEX[mark[1].toLowerCase()] ?? LETTER_INDEX[mark[1]]) === 0);
    const found = first >= 0 ? marks.slice(first, first + 4) : [];
    if (found.length < 4 || answer < 0) { skipped++; continue; }
    // The question is what comes before the options — after a "প্রশ্ন:"/"Q1." label if there is one.
    const before = joined.slice(0, found[0].index);
    const labels = [...before.matchAll(/(?:^|\n)(?:\*\*)?\s*(?:প্রশ্ন|question|q)\s*[\d০-৯]*\s*[:：.)](?:\*\*)?[^\S\n]*/gi)];
    const afterLabel = labels.length ? before.slice((labels.at(-1)!.index ?? 0) + labels.at(-1)![0].length) : before;
    const text = afterLabel.replace(/^\s*[\d০-৯]+\s*[.)।]\s*/, "").replace(/\*\*/g, "").trim();
    const options = found.map((mark, index) => {
      const start = (mark.index ?? 0) + mark[0].length;
      const end = index < 3 ? found[index + 1].index : joined.length;
      return joined.slice(start, end).replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
    }) as [string, string, string, string];
    if (!text || options.some((option) => !option)) { skipped++; continue; }
    questions.push({ text, options, correctIndex: answer });
  }
  return { questions, skipped };
}

/* ---------- Reading a page twice and checking one reading against the other ---------- */

export type ExtractedQuestion = { text: string; options: string[]; correctIndex: number };

/** Where the two AI readings disagree: every reading of that field, for the user to pick or fix. */
export type Review = {
  text?: string[];
  options?: Array<string[] | undefined>;
  onlyOnce?: boolean;
  /** Field (0 = question, 1–4 = option ক–ঘ) → a word the spelling check doubts. */
  words?: Record<number, string>;
};
export type ReviewedQuestion = DraftQuestion & { review?: Review };

/** Same text, ignoring spacing, quote and dash styles (which differ between readings but not in meaning). */
export const sameText = (a: string, b: string) => {
  const clean = (value: string) => value.normalize("NFC").replace(/[‘’'`"“”]/g, "'").replace(/[–—-]/g, "-").replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();
  return clean(a) === clean(b);
};

/** How alike two texts are (0–1), for pairing up the questions of two readings. */
function likeness(a: string, b: string) {
  const pairs = (value: string) => { const text = value.replace(/\s+/g, ""); return new Set(Array.from({ length: Math.max(0, text.length - 1) }, (_, index) => text.slice(index, index + 2))); };
  const left = pairs(a), right = pairs(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const pair of left) if (right.has(pair)) shared++;
  return (2 * shared) / (left.size + right.size);
}

const asDraft = (question: ExtractedQuestion): DraftQuestion => ({ text: question.text, options: [0, 1, 2, 3].map((index) => question.options[index] ?? "") as DraftQuestion["options"], correctIndex: question.correctIndex });

/**
 * Two independent readings of the same page → one list. Where both read a field the same it is
 * trusted; where they differ it is flagged with both readings; a question only one reading found is
 * flagged whole. An answer counts only when both readings saw the same mark.
 */
export function mergeReadings(first: ExtractedQuestion[], second: ExtractedQuestion[]): ReviewedQuestion[] {
  const used = new Set<number>();
  const merged: ReviewedQuestion[] = [];
  for (const [index, question] of first.entries()) {
    // The same position first, then the most alike question not taken yet.
    let match = second[index] && !used.has(index) && likeness(question.text, second[index].text) > 0.5 ? index : -1;
    if (match < 0) {
      let best = 0.5;
      second.forEach((other, position) => { const score = likeness(question.text, other.text); if (!used.has(position) && score > best) { best = score; match = position; } });
    }
    if (match < 0) { merged.push({ ...asDraft(question), correctIndex: -1, review: { onlyOnce: true } }); continue; }
    used.add(match);
    const other = asDraft(second[match]);
    const draft = asDraft(question);
    const review: Review = {};
    if (!sameText(draft.text, other.text)) review.text = [draft.text, other.text];
    const options = draft.options.map((option, position) => (sameText(option, other.options[position]) ? undefined : [option, other.options[position]].filter(Boolean)));
    if (options.some(Boolean)) review.options = options;
    merged.push({ ...draft, correctIndex: draft.correctIndex === other.correctIndex ? draft.correctIndex : -1, ...(Object.keys(review).length ? { review } : {}) });
  }
  // Questions only the second reading found, kept in place order at the end.
  second.forEach((question, position) => { if (!used.has(position)) merged.push({ ...asDraft(question), correctIndex: -1, review: { onlyOnce: true } }); });
  return merged;
}

/**
 * Adds the spelling check's doubts: a field both readings agreed on can still hold a misread word
 * (both made the same mistake), so it is flagged too, with the doubtful word named.
 */
export function addDoubts(questions: ReviewedQuestion[], doubts: Array<{ question: number; field: number; word: string }>): ReviewedQuestion[] {
  return questions.map((question, index) => {
    const mine = doubts.filter((doubt) => doubt.question === index);
    if (!mine.length) return question;
    const review: Review = { ...question.review, words: { ...question.review?.words } };
    for (const doubt of mine) {
      if (doubt.field === 0) review.text ??= [question.text];
      else {
        const options = review.options ? [...review.options] : [undefined, undefined, undefined, undefined];
        options[doubt.field - 1] ??= [question.options[doubt.field - 1]];
        review.options = options;
      }
      review.words![doubt.field] = doubt.word;
    }
    return { ...question, review };
  });
}

/** How many fields still wait for the user to check. */
export const reviewCount = (questions: ReviewedQuestion[]) => questions.reduce((total, question) => total + (question.review ? (question.review.onlyOnce ? 1 : 0) + (question.review.text ? 1 : 0) + (question.review.options?.filter(Boolean).length ?? 0) : 0), 0);
