import type { BankExam } from "@prisma/client";

/**
 * Question Bank sheet reading (docs/question-bank-plan.md). Pure, so the upload page can check a
 * sheet in the browser before anything is sent, and the server can re-check what arrives.
 */

export const BANK_EXAMS: Array<{ id: BankExam; slug: string; label: string }> = [
  { id: "BCS", slug: "bcs", label: "BCS" },
  { id: "PRIMARY", slug: "primary", label: "প্রাইমারি" },
  { id: "GRADE_11_20", slug: "grade", label: "১১–২০ গ্রেড" },
];

/** Rows per upload call: keeps each request well under the server action body limit (1 MB). */
export const BANK_IMPORT_BATCH = 150;
/** What the pre-upload check says for a question an admin edited in the app (never overwritten). */
export const BANK_EDITED = "edited";
/** Rows per "already in the bank?" check (only keys travel, so far more fit). */
export const BANK_CHECK_BATCH = 2000;

export const BANK_OPTION_LETTERS = ["ক", "খ", "গ", "ঘ", "ঙ"] as const;

/** The sheet's "পরীক্ষা (Exam)" text → a tab; null if it names none of the three. */
export function examFromText(text: string): BankExam | null {
  const value = text.toLowerCase();
  if (/bcs|বিসিএস/.test(value)) return "BCS";
  if (/primary|প্রাইমারি|প্রাথমিক/.test(value)) return "PRIMARY";
  if (/grade|গ্রেড|11\s*[-–]\s*20|১১\s*[-–]\s*২০/.test(value)) return "GRADE_11_20";
  return null;
}

const LETTERS: Record<string, number> = {
  ক: 0, খ: 1, গ: 2, ঘ: 3, ঙ: 4, a: 0, b: 1, c: 2, d: 3, e: 4,
  "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "১": 0, "২": 1, "৩": 2, "৪": 3, "৫": 4,
};

/** "ক", "(খ)", "গ.", "C", "৩" → 0-based option index; null when it isn't a letter. */
export function letterIndex(text: string): number | null {
  const letter = text.trim().replace(/^[(（]|[)）.:।]$/g, "").trim().toLowerCase();
  return letter in LETTERS ? LETTERS[letter] : null;
}

/** For comparing an option with the "answer" column: case, spaces and end punctuation don't count. */
const loose = (text: string) => text.toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?।'"“”‘’]+$/g, "").trim();

/**
 * Solutions often start by repeating the answer ("সঠিক উত্তর: is…", sometimes glued to the next
 * sentence). The answer is shown anyway, so that lead-in is dropped.
 */
export function cleanSolution(solution: string, answer: string) {
  const text = solution.trim();
  const match = /^সঠিক\s*উত্তর\s*[:：]\s*/.exec(text);
  if (!match) return text;
  const rest = text.slice(match[0].length);
  const lead = answer.trim();
  return (lead && rest.startsWith(lead) ? rest.slice(lead.length) : rest).replace(/^[\s।.,;:-]+/, "").trim();
}

/**
 * "বিগত সালের প্রশ্ন › গণপূর্ত (2025) ; English (General) › English Grammar" → the subject (and
 * topic) from the first path that isn't the set's own section. "(General)"-style tails are dropped
 * so "English (General)" lands in the user's "English".
 */
export function subjectFromSources(sources: string | null | undefined, section: string) {
  const strip = (text: string) => text.replace(/\s*\([^)]*\)\s*$/, "").trim();
  for (const path of (sources ?? "").split(/\s*;\s*/)) {
    const parts = path.split(/\s*›\s*/).map((part) => part.trim()).filter(Boolean);
    if (parts.length && parts[0] !== section.trim()) return { subject: strip(parts[0]), topic: parts[1] ? strip(parts[1]) : null };
  }
  return null;
}

/**
 * Where a copied set goes in the user's Preliminary: the subject (and topic) all its questions
 * share; a past paper mixes subjects, so it goes under its section ("বিগত সালের প্রশ্ন") instead.
 */
export function placementForSet(section: string, sources: Array<string | null>) {
  const found = sources.map((value) => subjectFromSources(value, section));
  const first = found[0];
  if (first && found.every((item) => item?.subject === first.subject)) {
    return { subjectName: first.subject, topicName: found.every((item) => item?.topic === first.topic) ? first.topic : null };
  }
  return { subjectName: section.trim() || "প্রশ্ন ব্যাংক", topicName: null };
}

/** A short, stable id for a question from its wording and options (the sheet has no ID column). */
export function questionFingerprint(text: string, options: string[]) {
  const source = [text, ...options].map((part) => loose(part).normalize("NFC")).join("␟");
  // Two 32-bit FNV-1a hashes with different seeds: plenty for the few hundred questions of one set.
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x5bd1e995) ^ (b >>> 15);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * A hash of everything else about a question (order, answer, solution, explanation, sources), so
 * the upload page can tell "already in the bank, unchanged" from "same question, edited".
 */
export function rowContentHash(row: { serial: number; correctIndex: number; solution: string | null; explanation: string | null; sources: string | null; options: string[]; text: string }) {
  return questionFingerprint(JSON.stringify([row.serial, row.correctIndex, row.solution ?? "", row.explanation ?? "", row.sources ?? "", row.text]), row.options);
}

/** Where a row goes: its set (exam + section + session) and the question inside it. */
export const rowSetKey = (row: { exam: string; section: string; session: string }) => JSON.stringify([row.exam, row.section, row.session]);

/**
 * Marks rows that repeat an earlier row of the same file (same set, same question): only the first
 * is uploaded. Returns the later rows' positions mapped to the sheet line they repeat.
 */
export function repeatsInFile(rows: Array<{ line: number; row: BankRow }>) {
  const first = new Map<string, number>();
  const repeats = new Map<number, number>();
  for (const { line, row } of rows) {
    const key = `${rowSetKey(row)}|${questionFingerprint(row.text, row.options)}`;
    const earlier = first.get(key);
    if (earlier === undefined) first.set(key, line);
    else repeats.set(line, earlier);
  }
  return repeats;
}

/* ---------- Columns ---------- */

export type BankField = "exam" | "section" | "session" | "type" | "serial" | "question" | "o1" | "o2" | "o3" | "o4" | "o5" | "letter" | "answer" | "solution" | "explanation" | "sources";

/** How each field's header is recognised (Bangla or English, as in the owner's sheets). */
const HEADER_PATTERNS: Array<[BankField, RegExp]> = [
  ["exam", /পরীক্ষা|^exam|\(exam\)/i],
  ["section", /ধরন\s*\(section\)|^ধরন$|section/i],
  ["session", /সেশন|session/i],
  ["type", /প্রশ্নের\s*ধরন|question\s*type/i],
  ["serial", /ক্রম|serial/i],
  ["question", /^প্রশ্ন\s*\(question\)|^প্রশ্ন$|^question$/i],
  ["o5", /অতিরিক্ত|extra/i],
  ["letter", /letter/i],
  ["answer", /\(answer\)|^answer$/i],
  ["solution", /সমাধান|solution/i],
  ["explanation", /ব্যাখ্যা|explanation/i],
  ["sources", /উৎস|source/i],
];
const OPTION_HEADERS: Array<[BankField, RegExp]> = [["o1", /^(ক|a|option\s*1)$/i], ["o2", /^(খ|b|option\s*2)$/i], ["o3", /^(গ|c|option\s*3)$/i], ["o4", /^(ঘ|d|option\s*4)$/i]];

export const REQUIRED_FIELDS: BankField[] = ["exam", "section", "session", "question", "o1", "o2", "o3", "o4", "letter"];
export const FIELD_LABELS: Record<BankField, string> = {
  exam: "পরীক্ষা", section: "ধরন", session: "সেশন/বিষয়", type: "প্রশ্নের ধরন", serial: "ক্রম", question: "প্রশ্ন",
  o1: "ক", o2: "খ", o3: "গ", o4: "ঘ", o5: "অতিরিক্ত অপশন", letter: "সঠিক উত্তর (Letter)", answer: "সঠিক উত্তর (Answer)",
  solution: "সমাধান", explanation: "ব্যাখ্যা", sources: "সব উৎস",
};

/** Header row → column index per field. The first header that matches a field wins. */
export function mapColumns(headers: string[]) {
  const map: Partial<Record<BankField, number>> = {};
  headers.forEach((raw, index) => {
    const header = raw.trim();
    // "প্রশ্নের ধরন" also contains "ধরন": check the more specific "type" before "section".
    const option = OPTION_HEADERS.find(([, pattern]) => pattern.test(header));
    if (option && map[option[0]] === undefined) { map[option[0]] = index; return; }
    const order: BankField[] = ["type", "exam", "section", "session", "serial", "question", "o5", "letter", "answer", "solution", "explanation", "sources"];
    for (const field of order) {
      const pattern = HEADER_PATTERNS.find(([name]) => name === field)![1];
      if (map[field] === undefined && pattern.test(header)) { map[field] = index; return; }
    }
  });
  const missing = REQUIRED_FIELDS.filter((field) => map[field] === undefined);
  return { map, missing };
}

/* ---------- Rows ---------- */

export type BankRow = {
  exam: BankExam;
  section: string;
  session: string;
  serial: number;
  text: string;
  options: string[];
  correctIndex: number;
  solution: string | null;
  explanation: string | null;
  sources: string | null;
};

export type CheckedRow = { line: number; row: BankRow | null; errors: string[]; warnings: string[]; skipped?: string };

const cell = (cells: unknown[], index: number | undefined) => (index === undefined ? "" : String(cells[index] ?? "").trim());

/** One sheet row → a question to import, or why it can't be (`line` is the sheet's row number). */
export function checkRow(cells: unknown[], map: Partial<Record<BankField, number>>, line: number): CheckedRow {
  const get = (field: BankField) => cell(cells, map[field]);
  const errors: string[] = [];
  const warnings: string[] = [];
  const type = get("type");
  // Only MCQs belong in a Preliminary set; other question types are left out on purpose.
  if (type && !/বহুনির্বাচনি|mcq|multiple/i.test(type)) return { line, row: null, errors, warnings, skipped: `MCQ নয় (${type})` };

  const exam = examFromText(get("exam"));
  if (!exam) errors.push(`পরীক্ষা চেনা যায়নি: "${get("exam") || "ফাঁকা"}"`);
  const section = get("section");
  const session = get("session");
  if (!section) errors.push("ধরন ফাঁকা");
  if (!session) errors.push("সেশন/বিষয় ফাঁকা");
  const text = get("question");
  if (!text) errors.push("প্রশ্ন ফাঁকা");

  const options = [get("o1"), get("o2"), get("o3"), get("o4")];
  options.forEach((option, index) => { if (!option) errors.push(`অপশন ${BANK_OPTION_LETTERS[index]} ফাঁকা`); });
  const extra = get("o5");
  if (extra) options.push(extra);

  const letter = get("letter");
  const correctIndex = letterIndex(letter);
  if (correctIndex === null) errors.push(`সঠিক উত্তরের অক্ষর বোঝা যায়নি: "${letter || "ফাঁকা"}"`);
  else if (correctIndex >= options.length) errors.push(`উত্তর "${letter}" কিন্তু অপশন আছে ${options.length}টি`);

  const answer = get("answer");
  if (answer && correctIndex !== null && options[correctIndex] && loose(answer) !== loose(options[correctIndex])) {
    warnings.push(`উত্তর "${letter}" = "${options[correctIndex]}", কিন্তু উত্তরের ঘরে লেখা "${answer}"`);
  }

  const serialText = get("serial").replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
  const serial = Number.parseInt(serialText, 10);
  if (serialText && !Number.isFinite(serial)) warnings.push(`ক্রম সংখ্যা নয়: "${get("serial")}"`);

  const tooLong = [text.length > 2000 && "প্রশ্ন", options.some((option) => option.length > 500) && "অপশন"].filter(Boolean);
  if (tooLong.length) errors.push(`${tooLong.join(", ")} খুব লম্বা`);

  if (errors.length || !exam || correctIndex === null) return { line, row: null, errors, warnings };
  const solution = get("solution");
  return {
    line,
    errors,
    warnings,
    row: {
      exam, section, session, text, options, correctIndex,
      serial: Number.isFinite(serial) ? serial : line,
      solution: solution ? cleanSolution(solution, options[correctIndex]).slice(0, 5000) || null : null,
      explanation: get("explanation").slice(0, 5000) || null,
      sources: get("sources").slice(0, 1000) || null,
    },
  };
}

/** Rows that are entirely blank (trailing lines in a sheet) aren't rows at all. */
export const isBlankRow = (cells: unknown[]) => cells.every((value) => String(value ?? "").trim() === "");

/* ---------- v2: years, categories, chapter sheets (docs/question-bank-v2-plan.md) ---------- */

/** The year in a set's name, "(2025)" or "(২০২৫)"; null when there is none (shown as "অন্যান্য"). */
export function yearFromName(name: string): number | null {
  const match = /(?:19[5-9]\d|20\d\d)/.exec(name.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))));
  return match ? Number(match[0]) : null;
}

/** A URL slug for an admin-added category: Latin letters/digits kept, else a short random tail. */
export function categorySlug(name: string, random = Math.random) {
  const latin = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${latin || "exam"}-${random().toString(36).slice(2, 7)}`;
}

/** Years newest first, sets without a year last ("অন্যান্য"). */
export function groupByYear<T extends { year: number | null }>(sets: T[]) {
  const groups = new Map<number | null, T[]>();
  for (const set of sets) groups.set(set.year, [...(groups.get(set.year) ?? []), set]);
  return [...groups].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b - a)).map(([year, items]) => ({ year, sets: items }));
}

export type ChapterMcqRow = { serial: number; text: string; options: string[]; correctIndex: number; solution: string | null; explanation: string | null };
export type ChapterShortRow = { serial: number; question: string; answer: string };
export type ChapterSheetKind = "mcq" | "short";
export type CheckedChapterRow<T> = { line: number; row: T | null; errors: string[] };

/**
 * A chapter's sheet: no exam/section/session columns, the chapter is the one the admin is on.
 * MCQ: প্রশ্ন, ক–ঘ (+ অতিরিক্ত), সঠিক উত্তর (letter), সমাধান, ব্যাখ্যা, ক্রম. Short: প্রশ্ন, উত্তর, ক্রম.
 */
export function mapChapterColumns(headers: string[], kind: ChapterSheetKind) {
  const map: Partial<Record<BankField, number>> = {};
  headers.forEach((raw, index) => {
    const header = raw.trim();
    const option = OPTION_HEADERS.find(([, pattern]) => pattern.test(header));
    const field: BankField | undefined = kind === "mcq" && option ? option[0]
      : /ক্রম|serial/i.test(header) ? "serial"
      : /^প্রশ্ন|^question/i.test(header) ? "question"
      : kind === "mcq" && /অতিরিক্ত|extra/i.test(header) ? "o5"
      : kind === "mcq" && /letter|সঠিক\s*উত্তর|^উত্তর$|^answer$/i.test(header) ? "letter"
      : kind === "short" && /উত্তর|answer/i.test(header) ? "answer"
      : kind === "mcq" && /সমাধান|solution/i.test(header) ? "solution"
      : kind === "mcq" && /ব্যাখ্যা|explanation/i.test(header) ? "explanation"
      : undefined;
    if (field && map[field] === undefined) map[field] = index;
  });
  const required: BankField[] = kind === "mcq" ? ["question", "o1", "o2", "o3", "o4", "letter"] : ["question", "answer"];
  return { map, missing: required.filter((field) => map[field] === undefined) };
}

function serialOf(text: string, line: number) {
  const serial = Number.parseInt(text.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))), 10);
  return Number.isFinite(serial) ? serial : line;
}

export function checkChapterMcqRow(cells: unknown[], map: Partial<Record<BankField, number>>, line: number): CheckedChapterRow<ChapterMcqRow> {
  const get = (field: BankField) => cell(cells, map[field]);
  const errors: string[] = [];
  const text = get("question");
  if (!text) errors.push("প্রশ্ন ফাঁকা");
  const options = [get("o1"), get("o2"), get("o3"), get("o4")];
  options.forEach((option, index) => { if (!option) errors.push(`অপশন ${BANK_OPTION_LETTERS[index]} ফাঁকা`); });
  if (get("o5")) options.push(get("o5"));
  const correctIndex = letterIndex(get("letter"));
  if (correctIndex === null) errors.push(`সঠিক উত্তরের অক্ষর বোঝা যায়নি: "${get("letter") || "ফাঁকা"}"`);
  else if (correctIndex >= options.length) errors.push(`উত্তর "${get("letter")}" কিন্তু অপশন আছে ${options.length}টি`);
  if (text.length > 2000 || options.some((option) => option.length > 500)) errors.push("প্রশ্ন বা অপশন খুব লম্বা");
  if (errors.length || correctIndex === null) return { line, row: null, errors };
  const solution = get("solution");
  return {
    line, errors,
    row: { serial: serialOf(get("serial"), line), text, options, correctIndex, solution: solution ? cleanSolution(solution, options[correctIndex]).slice(0, 5000) || null : null, explanation: get("explanation").slice(0, 5000) || null },
  };
}

export function checkChapterShortRow(cells: unknown[], map: Partial<Record<BankField, number>>, line: number): CheckedChapterRow<ChapterShortRow> {
  const question = cell(cells, map.question);
  const answer = cell(cells, map.answer);
  const errors = [!question && "প্রশ্ন ফাঁকা", !answer && "উত্তর ফাঁকা", (question.length > 2000 || answer.length > 10_000) && "খুব লম্বা"].filter((error): error is string => Boolean(error));
  return errors.length ? { line, row: null, errors } : { line, errors, row: { serial: serialOf(cell(cells, map.serial), line), question, answer } };
}

/**
 * Pasted text in pieces the AI can sort out within its time limit: cut at blank lines (between
 * questions), else at line ends, never inside a line unless one line is longer than `max`.
 */
export function chunkPastedText(text: string, max = 6000) {
  const chunks: string[] = [];
  let current = "";
  const push = () => { if (current.trim()) chunks.push(current.trim()); current = ""; };
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const pieces = block.length > max ? block.split("\n").flatMap((line) => (line.length > max ? line.match(new RegExp(`[\\s\\S]{1,${max}}`, "g")) ?? [] : [line])) : [block];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > max) push();
      current = current ? `${current}${block.length > max ? "\n" : "\n\n"}${piece}` : piece;
    }
  }
  push();
  return chunks;
}

/* ---------- Pasted MCQs in the exact pattern: sorted here, without AI ---------- */

const PASTE_NUMBER = /^(?:(?:প্রশ্ন|question|q)\s*)?[(（]?[\d০-৯]+\s*[.)）।:：]\s*/i;
const PASTE_ANSWER = /^(?:সঠিক\s*উত্তর|উত্তর|correct\s*answer|answer|ans)\s*[:：\-–—]\s*/i;
/** "খ", "(খ)", "খ) পরম + ঈশ" — a letter not followed by more of a word. */
const ANSWER_LETTER = /^[(（]?([কখগঘঙ]|[a-eA-E]|[1-5১-৫])(?![\p{L}\p{M}\p{N}])/u;
const PASTE_SECTION = /^(সমাধান|solution|ব্যাখ্যা|explanation)\s*[:：\-–—]\s*/i;
/** "ক)", "(খ)", "গ.", "ঘ:", "a)" … at a line start or after a space (several options may share a line). */
const PASTE_OPTION = /(?:^|\s)[(（]?([কখগঘঙ]|[a-eA-E])[)）.:।]\s*/g;
const OPTION_START = /(?:^|\s)[(（]?(?:ক|a|A)[)）.:।]/;

export type PastedMcq = Omit<ChapterMcqRow, "serial">;

/**
 * MCQs pasted in the form the dialog shows are read here, so no AI call is needed:
 *
 *   ১. ‘পরমেশ’ শব্দের সন্ধি বিচ্ছেদ কোনটি?
 *   ক) পরম + এশ  খ) পরম + ঈশ  গ) পরম + ইশ  ঘ) পরম + ঈশা
 *   উত্তর: খ            (or the option's text)
 *   সমাধান: … (optional, may run over several lines)
 *   ব্যাখ্যা: … (optional, may run over several lines)
 *
 * 4 or 5 options (ক–ঙ), one per line or on one line. `failed` lists the questions (1-based, in
 * paste order) that don't fit; the dialog sends the text to AI then rather than guessing.
 */
export function parsePastedMcqs(input: string): { items: PastedMcq[]; failed: number[] } {
  const lines = input.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim());
  // A numbered line is a new question only when options follow it before the next answer or
  // numbered line, so numbered steps inside a solution stay in that solution.
  const opensQuestion = (at: number) => {
    if (!PASTE_NUMBER.test(lines[at])) return false;
    for (let next = at; next < lines.length; next++) {
      if (next > at && (PASTE_ANSWER.test(lines[next]) || PASTE_NUMBER.test(lines[next]))) return false;
      if (OPTION_START.test(lines[next].replace(PASTE_NUMBER, ""))) return true;
    }
    return false;
  };

  const blocks: string[][] = [];
  let current: string[] = [];
  let answered = false, inSection = false, blankSince = false;
  for (const [at, line] of lines.entries()) {
    if (!line) { blankSince = true; if (current.length) current.push(""); continue; }
    // After the answer, a new question starts at a numbered line, or (unnumbered) at a plain line
    // after a blank line when no solution/explanation is still running.
    const next = answered && (opensQuestion(at) || (blankSince && !inSection && !PASTE_SECTION.test(line)));
    if (next) { blocks.push(current); current = []; answered = false; inSection = false; }
    if (PASTE_ANSWER.test(line)) answered = true;
    else if (answered && PASTE_SECTION.test(line)) inSection = true;
    current.push(line);
    blankSince = false;
  }
  if (current.some(Boolean)) blocks.push(current);

  const items: PastedMcq[] = [];
  const failed: number[] = [];
  for (const [index, block] of blocks.entries()) {
    const item = readPastedBlock(block);
    if (item) items.push(item);
    else failed.push(index + 1);
  }
  return { items, failed };
}

function readPastedBlock(block: string[]): PastedMcq | null {
  const answerAt = block.findIndex((line) => PASTE_ANSWER.test(line));
  if (answerAt < 0) return null;
  const given = block[answerAt].replace(PASTE_ANSWER, "");

  // Everything after the answer belongs to সমাধান / ব্যাখ্যা; any other line there doesn't fit.
  const parts: Record<"solution" | "explanation", string[]> = { solution: [], explanation: [] };
  let section: keyof typeof parts | null = null;
  for (const line of block.slice(answerAt + 1)) {
    const label = PASTE_SECTION.exec(line);
    if (label) {
      section = /^(সমাধান|solution)$/i.test(label[1]) ? "solution" : "explanation";
      if (parts[section].length) return null;
      parts[section].push(line.slice(label[0].length));
    } else if (section) parts[section].push(line);
    else if (line) return null;
  }
  const part = (key: keyof typeof parts) => parts[key].join("\n").replace(/\n{3,}/g, "\n\n").trim() || null;

  const body = block.slice(0, answerAt).filter(Boolean).join("\n");
  const marks = [...body.matchAll(PASTE_OPTION)];
  const first = marks.findIndex((mark) => LETTERS[mark[1].toLowerCase()] === 0);
  if (first < 0) return null;
  // Options must run ক, খ, গ, ঘ (, ঙ) in order with nothing else marked after them.
  const found = marks.slice(first);
  if (found.length < 4 || found.length > 5 || found.some((mark, at) => LETTERS[mark[1].toLowerCase()] !== at)) return null;
  const text = body.slice(0, found[0].index).replace(PASTE_NUMBER, "").replace(/\s+/g, " ").trim();
  const options = found.map((mark, at) => body.slice((mark.index ?? 0) + mark[0].length, at + 1 < found.length ? found[at + 1].index : body.length).replace(/\s+/g, " ").trim());

  // The answer as a letter, or else as the text of one option ("উত্তর: পরম + ঈশ").
  const letter = ANSWER_LETTER.exec(given);
  const answer = letter ? LETTERS[letter[1].toLowerCase()] : options.findIndex((option) => loose(option) === loose(given));
  const solution = part("solution"), explanation = part("explanation");
  if (answer < 0 || !text || text.length > 2000 || options.some((option) => !option || option.length > 500) || answer >= options.length) return null;
  if ((solution?.length ?? 0) > 5000 || (explanation?.length ?? 0) > 5000) return null;
  return { text, options, correctIndex: answer, solution, explanation };
}
