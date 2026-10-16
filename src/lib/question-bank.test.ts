import { describe, expect, it } from "vitest";
import { categorySlug, chunkPastedText, checkChapterMcqRow, checkChapterShortRow, checkRow, cleanSolution, examFromText, groupByYear, letterIndex, mapChapterColumns, mapColumns, placementForSet, questionFingerprint, repeatsInFile, rowContentHash, subjectFromSources, yearFromName, type BankRow } from "./question-bank";

const headers = ["#", "পরীক্ষা (Exam)", "ধরন (Section)", "সেশন/বিষয় (Session/Subject)", "প্রশ্নের ধরন", "ক্রম (Serial)", "প্রশ্ন (Question)", "ক", "খ", "গ", "ঘ", "অতিরিক্ত অপশন", "সঠিক উত্তর (Letter)", "সঠিক উত্তর (Answer)", "সমাধান (Solution)", "ব্যাখ্যা (Explanation)", "সব উৎস (All sources)"];
const sample = ["1", "Grade 11-20 Govt Jobs (General)", "বিগত সালের প্রশ্ন", "গণপূর্ত অধিদপ্তর (2025)", "বহুনির্বাচনি প্রশ্ন", "1", "Gulliver's travels _____ a famous book.", "is", "are", "has", "have", "", "ক", "is",
  "সঠিক উত্তর: isGulliver's Travels একটি বিখ্যাত বইয়ের নাম।", "কোনো বইয়ের নাম Plural-এর মতো হলেও Verb singular হয়।", "বিগত সালের প্রশ্ন › গণপূর্ত অধিদপ্তর (2025) ; English (General) › English Grammar"];

describe("reading the owner's sheet", () => {
  const { map, missing } = mapColumns(headers);

  it("finds every column by its header", () => {
    expect(missing).toEqual([]);
    expect(map).toMatchObject({ exam: 1, section: 2, session: 3, type: 4, serial: 5, question: 6, o1: 7, o2: 8, o3: 9, o4: 10, o5: 11, letter: 12, answer: 13, solution: 14, explanation: 15, sources: 16 });
  });

  it("turns the sample row into a question", () => {
    const { row, errors, warnings } = checkRow(sample, map, 2);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(row).toMatchObject({ exam: "GRADE_11_20", section: "বিগত সালের প্রশ্ন", session: "গণপূর্ত অধিদপ্তর (2025)", serial: 1, options: ["is", "are", "has", "have"], correctIndex: 0 });
    expect(row?.solution).toBe("Gulliver's Travels একটি বিখ্যাত বইয়ের নাম।");
  });

  it("uses the extra option as ঙ", () => {
    const cells = [...sample];
    cells[11] = "had";
    cells[12] = "ঙ";
    cells[13] = "had";
    expect(checkRow(cells, map, 3).row).toMatchObject({ options: ["is", "are", "has", "have", "had"], correctIndex: 4 });
  });

  it("refuses a row with an empty option or an unknown letter, and warns when the answer text disagrees", () => {
    const blank = [...sample];
    blank[9] = "";
    expect(checkRow(blank, map, 4).errors).toContain("অপশন গ ফাঁকা");
    const badLetter = [...sample];
    badLetter[12] = "ঙ";
    expect(checkRow(badLetter, map, 5).row).toBeNull();
    const disagree = [...sample];
    disagree[13] = "are";
    const checked = checkRow(disagree, map, 6);
    expect(checked.row).not.toBeNull();
    expect(checked.warnings).toHaveLength(1);
  });

  it("leaves out questions that aren't MCQs", () => {
    const written = [...sample];
    written[4] = "লিখিত প্রশ্ন";
    expect(checkRow(written, map, 7)).toMatchObject({ row: null, skipped: expect.stringContaining("MCQ নয়") });
  });
});

describe("helpers", () => {
  it("reads answer letters in every common form", () => {
    expect(["ক", "(খ)", "গ.", "D", "৫", "e"].map(letterIndex)).toEqual([0, 1, 2, 3, 4, 4]);
    expect(letterIndex("চ")).toBeNull();
  });

  it("names the tab from the exam text", () => {
    expect(examFromText("Grade 11-20 Govt Jobs (General)")).toBe("GRADE_11_20");
    expect(examFromText("৪৪তম বিসিএস")).toBe("BCS");
    expect(examFromText("প্রাথমিক শিক্ষক নিয়োগ")).toBe("PRIMARY");
    expect(examFromText("Bank job")).toBeNull();
  });

  it("drops a repeated answer at the start of a solution", () => {
    expect(cleanSolution("সঠিক উত্তর: is। কারণ…", "is")).toBe("কারণ…");
    expect(cleanSolution("Singular noun, তাই is", "is")).toBe("Singular noun, তাই is");
  });

  it("finds the subject among the sources, skipping the set's own section", () => {
    expect(subjectFromSources(sample[16], "বিগত সালের প্রশ্ন")).toEqual({ subject: "English", topic: "English Grammar" });
    expect(subjectFromSources("বিগত সালের প্রশ্ন › X", "বিগত সালের প্রশ্ন")).toBeNull();
  });

  it("files a single-subject set under that subject, a mixed past paper under its section", () => {
    const english = "বিগত সালের প্রশ্ন › A ; English (General) › English Grammar";
    const bangla = "বিগত সালের প্রশ্ন › A ; বাংলা › ব্যাকরণ";
    expect(placementForSet("বিগত সালের প্রশ্ন", [english, english])).toEqual({ subjectName: "English", topicName: "English Grammar" });
    expect(placementForSet("বিগত সালের প্রশ্ন", [english, bangla])).toEqual({ subjectName: "বিগত সালের প্রশ্ন", topicName: null });
  });

  it("gives the same fingerprint to the same question despite spacing, and a different one otherwise", () => {
    const a = questionFingerprint("Gulliver's travels  _____ a famous book.", ["is", "are", "has", "have"]);
    expect(questionFingerprint(" Gulliver's travels _____ a famous book ", ["is", "are", "has", "have"])).toBe(a);
    expect(questionFingerprint("Gulliver's travels _____ a famous book.", ["is", "are", "has", "had"])).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("uploading the same data twice", () => {
  const { map } = mapColumns(headers);
  const row = checkRow(sample, map, 2).row as BankRow;

  it("finds a question repeated inside one file, but not the same question in another set", () => {
    const otherSet = { ...row, session: "খাদ্য অধিদপ্তর (2024)" };
    const repeats = repeatsInFile([{ line: 2, row }, { line: 3, row: otherSet }, { line: 9, row: { ...row, serial: 5 } }]);
    expect([...repeats]).toEqual([[9, 2]]);
  });

  it("tells an unchanged question from an edited one", () => {
    expect(rowContentHash({ ...row })).toBe(rowContentHash(row));
    expect(rowContentHash({ ...row, solution: "নতুন সমাধান" })).not.toBe(rowContentHash(row));
    expect(rowContentHash({ ...row, correctIndex: 1 })).not.toBe(rowContentHash(row));
  });
});

describe("question bank v2 helpers", () => {
  it("reads the year from a set name", () => {
    expect(yearFromName("গণপূর্ত অধিদপ্তর (2025)")).toBe(2025);
    expect(yearFromName("৪৪তম বিসিএস (২০২৩)")).toBe(2023);
    expect(yearFromName("Model test 12")).toBeNull();
  });

  it("groups sets by year, newest first and others last", () => {
    const groups = groupByYear([{ year: 2020 }, { year: null }, { year: 2024 }, { year: 2020 }]);
    expect(groups.map((group) => [group.year, group.sets.length])).toEqual([[2024, 1], [2020, 2], [null, 1]]);
  });

  it("maps and checks a chapter MCQ sheet", () => {
    const { map, missing } = mapChapterColumns(["ক্রম", "প্রশ্ন", "ক", "খ", "গ", "ঘ", "সঠিক উত্তর", "সমাধান"], "mcq");
    expect(missing).toEqual([]);
    const checked = checkChapterMcqRow(["৩", "২+২=?", "3", "4", "5", "6", "খ", "সঠিক উত্তর: 4"], map, 2);
    expect(checked.row).toMatchObject({ serial: 3, correctIndex: 1, options: ["3", "4", "5", "6"] });
    expect(checkChapterMcqRow(["1", "", "a", "b", "c", "d", "z"], map, 3).errors.length).toBeGreaterThan(0);
  });

  it("maps and checks a short-question sheet", () => {
    const { map, missing } = mapChapterColumns(["প্রশ্ন", "উত্তর"], "short");
    expect(missing).toEqual([]);
    expect(checkChapterShortRow(["রাজধানী?", "ঢাকা"], map, 2).row).toEqual({ serial: 2, question: "রাজধানী?", answer: "ঢাকা" });
    expect(checkChapterShortRow(["রাজধানী?", ""], map, 3).row).toBeNull();
  });

  it("makes category slugs", () => {
    expect(categorySlug("Bank Job", () => 0.5)).toMatch(/^bank-job-/);
    expect(categorySlug("ব্যাংক", () => 0.5)).toMatch(/^exam-/);
  });
});

describe("chunkPastedText", () => {
  it("keeps questions whole and stays under the size", () => {
    const question = (n: number) => `${n}. প্রশ্ন ${"ক".repeat(80)}\nক) ১\nখ) ২\nগ) ৩\nঘ) ৪\nউত্তর: ক`;
    const text = Array.from({ length: 60 }, (_, index) => question(index + 1)).join("\n\n");
    const chunks = chunkPastedText(text, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true);
    expect(chunks.join("\n\n")).toBe(text);
  });

  it("splits one huge block at line ends", () => {
    const text = Array.from({ length: 50 }, (_, index) => `লাইন ${index} ${"খ".repeat(50)}`).join("\n");
    const chunks = chunkPastedText(text, 500);
    expect(chunks.every((chunk) => chunk.length <= 500)).toBe(true);
    expect(chunks.join("\n")).toBe(text);
  });
});
