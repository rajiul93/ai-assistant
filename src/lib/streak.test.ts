import { describe, expect, it } from "vitest";
import { studyStreak } from "./streak";

describe("studyStreak", () => {
  it("counts days in a row up to today", () => {
    expect(studyStreak(["2026-10-13", "2026-10-12", "2026-10-11", "2026-10-09"], "2026-10-13")).toBe(3);
  });
  it("still counts when today hasn't been studied yet", () => {
    expect(studyStreak(["2026-10-12", "2026-10-11"], "2026-10-13")).toBe(2);
  });
  it("is 0 after a missed day, and crosses month ends", () => {
    expect(studyStreak(["2026-10-11"], "2026-10-13")).toBe(0);
    expect(studyStreak(["2026-10-01", "2026-09-30", "2026-09-29"], "2026-10-01")).toBe(3);
  });
});
