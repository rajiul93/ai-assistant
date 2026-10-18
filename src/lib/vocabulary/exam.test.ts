import { describe, expect, it } from "vitest";
import { affixCard, batchForNewWord, batchStatus, BATCH_SIZE, buildExam, EXAM_SIZE, nounCard, rounds, spellingMatches, splitExample, verbCard } from "./exam";

const day = (n: number) => new Date(Date.UTC(2026, 9, n));
const words = (count: number, batch = 1) => Array.from({ length: count }, (_, index) => ({ batch, createdAt: new Date(day(1).getTime() + index * 1000) }));

describe("sets of fifty", () => {
  it("is open until the set is full, then locked until all three exams reach 80%", () => {
    expect(batchForNewWord(batchStatus(words(10), []))).toBe(1);
    const full = words(BATCH_SIZE);
    expect(batchStatus(full, []).locked).toBe(true);
    expect(batchForNewWord(batchStatus(full, []))).toBeNull();
    const exams = (["FORMS", "MEANING", "SPELLING"] as const).map((type) => ({ batch: 1, type, score: 17, total: 20, createdAt: day(5) }));
    const status = batchStatus(full, exams);
    expect(status.passed).toBe(true);
    expect(batchForNewWord(status)).toBe(2);
  });

  it("counts only exams taken after the set filled up, and needs every type", () => {
    const early = (["FORMS", "MEANING", "SPELLING"] as const).map((type) => ({ batch: 1, type, score: 20, total: 20, createdAt: day(1) }));
    expect(batchStatus(words(BATCH_SIZE), early).passed).toBe(false);
    const two = (["FORMS", "MEANING"] as const).map((type) => ({ batch: 1, type, score: 20, total: 20, createdAt: day(5) }));
    const status = batchStatus(words(BATCH_SIZE), two);
    expect(status.passed).toBe(false);
    expect(status.score).toBe(67);
  });

  it("starts the next set's count afresh", () => {
    const status = batchStatus([...words(BATCH_SIZE), ...words(3, 2)], []);
    expect(status).toMatchObject({ batch: 2, inBatch: 3, locked: false });
  });
});

describe("questions", () => {
  const verbs = Array.from({ length: 30 }, (_, index) => verbCard({ id: `v${index}`, present: `go${index}`, past: `went${index}`, pastParticiple: `gone${index}`, meaning: "যাওয়া" }));

  it("asks at most twenty words, each once", () => {
    for (const type of ["FORMS", "MEANING", "SPELLING"] as const) {
      const items = buildExam(type, verbs);
      expect(items).toHaveLength(EXAM_SIZE);
      expect(new Set(items.map((item) => item.key)).size).toBe(EXAM_SIZE);
    }
  });

  it("never leaves one pair alone on the last screen", () => {
    expect(rounds([1, 2, 3, 4, 5, 6]).map((round) => round.length)).toEqual([6]);
    expect(rounds([1, 2, 3, 4, 5, 6, 7]).map((round) => round.length)).toEqual([5, 2]);
  });

  it("skips a missing noun form and reads an affix's example", () => {
    expect(nounCard({ id: "n", singular: "information", plural: "-", meaning: "তথ্য", person: false }).forms).toHaveLength(1);
    expect(splitExample("unhappy — অসুখী")).toEqual(["unhappy", "অসুখী"]);
    expect(affixCard({ id: "a", kind: "PREFIX", affix: "un-", meaning: "না", example: "unhappy — অসুখী" }).forms[1]).toMatchObject({ english: "unhappy", bangla: "অসুখী" });
  });

  it("accepts either spelling of a two-way form", () => {
    expect(spellingMatches(" Learnt ", "learned/learnt")).toBe(true);
    expect(spellingMatches("dreamed", "dreamed, dreamt")).toBe(true);
    expect(spellingMatches("lernt", "learned/learnt")).toBe(false);
    expect(spellingMatches("", "go")).toBe(false);
  });
});
