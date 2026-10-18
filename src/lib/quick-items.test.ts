import { describe, expect, it } from "vitest";
import { cleanQuickItems, QUICK_MAX } from "./quick-items";

describe("quick items", () => {
  it("keeps known ids once, in order, up to the limit", () => {
    expect(cleanQuickItems(["/notes", "calendar", "/notes", "/nowhere", "calculator"])).toEqual(["/notes", "calendar", "calculator"]);
    expect(cleanQuickItems(["calendar", "calculator", "/tasks", "/notes", "/jobs", "/videos", "/plan"])).toHaveLength(QUICK_MAX);
  });
});
