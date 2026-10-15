import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, cleanPermissions, mergePermissions } from "./staff";

describe("staff permissions", () => {
  it("changes only what the manager holds", () => {
    // A manager with staff + billing can't add or remove question_bank.
    expect(mergePermissions(["question_bank"], ["billing", "question_bank", "vocabulary"], ["staff", "billing"])).toEqual(["billing", "question_bank"]);
    expect(mergePermissions(["question_bank", "billing"], [], ["staff", "billing"])).toEqual(["question_bank"]);
  });

  it("lets the super admin set anything", () => {
    expect(mergePermissions(["billing"], ["customers", "staff"], ALL_PERMISSIONS)).toEqual(["customers", "staff"]);
  });

  it("drops unknown ids from the database", () => {
    expect(cleanPermissions(["billing", "hack", "staff"])).toEqual(["billing", "staff"]);
    expect(cleanPermissions(null)).toEqual([]);
  });
});
