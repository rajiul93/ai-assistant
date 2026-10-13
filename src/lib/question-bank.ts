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
