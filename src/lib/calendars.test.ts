import { describe, expect, it } from "vitest";
import { banglaDate, dayOf, formatBangla, formatHijri, hijriDate, toBanglaDigits } from "./calendars";

describe("calendars", () => {
  it("matches the revised Bangla calendar's known days", () => {
    expect(formatBangla(banglaDate(dayOf(2026, 3, 14)))).toBe("১ বৈশাখ ১৪৩৩");
    expect(formatBangla(banglaDate(dayOf(2026, 3, 13)))).toBe("৩০ চৈত্র ১৪৩২");
    expect(formatBangla(banglaDate(dayOf(2026, 1, 21)))).toBe("৮ ফাল্গুন ১৪৩২");
    expect(formatBangla(banglaDate(dayOf(2025, 11, 16)))).toBe("১ পৌষ ১৪৩২");
    expect(formatBangla(banglaDate(dayOf(2026, 2, 26)))).toBe("১২ চৈত্র ১৪৩২");
    expect(formatBangla(banglaDate(dayOf(2026, 9, 15)))).toBe("৩০ আশ্বিন ১৪৩৩");
    // A leap February: ফাল্গুন has 30 days, চৈত্র still starts on 15 March.
    expect(formatBangla(banglaDate(dayOf(2028, 2, 14)))).toBe("৩০ ফাল্গুন ১৪৩৪");
    expect(formatBangla(banglaDate(dayOf(2028, 2, 15)))).toBe("১ চৈত্র ১৪৩৪");
  });

  it("reads Hijri dates and shifts them by the user's adjustment", () => {
    expect(formatHijri(hijriDate(dayOf(2026, 9, 15))!)).toBe("৪ জমাদিউল আউয়াল ১৪৪৮");
    expect(formatHijri(hijriDate(dayOf(2026, 2, 20))!)).toBe("১ শাওয়াল ১৪৪৭");
    expect(hijriDate(dayOf(2026, 9, 15), -1)!.day).toBe(3);
  });

  it("writes Bangla digits", () => {
    expect(toBanglaDigits(2026)).toBe("২০২৬");
  });
});
