import { describe, expect, it } from "vitest";
import { awayText } from "./timer-away";

describe("awayText", () => {
  it("seconds under a minute", () => expect(awayText(12_000)).toBe("12 সেকেন্ড"));
  it("minutes and seconds", () => expect(awayText(310_000)).toBe("5 মিনিট 10 সেকেন্ড"));
  it("hours drop the seconds", () => expect(awayText(3_725_000)).toBe("1 ঘণ্টা 2 মিনিট"));
});
