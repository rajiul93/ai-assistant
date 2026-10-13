import { describe, expect, it } from "vitest";
import { formatBdPhone, normalizeBdPhone } from "./phone";

describe("normalizeBdPhone", () => {
  it("accepts the common ways of writing a number", () => {
    for (const input of ["01712345678", "+8801712345678", "8801712345678", "+880 1712-345678", " 01712 345 678 ", "(017) 1234-5678", "০১৭১২৩৪৫৬৭৮"]) {
      expect(normalizeBdPhone(input)).toBe("+8801712345678");
    }
  });

  it("accepts every operator prefix 013–019", () => {
    for (const digit of "3456789") expect(normalizeBdPhone(`01${digit}12345678`)).toBe(`+8801${digit}12345678`);
  });

  it("rejects wrong lengths, prefixes and letters", () => {
    for (const input of ["", "0171234567", "017123456789", "01212345678", "02712345678", "+8701712345678", "0171234567a", "phone"]) {
      expect(normalizeBdPhone(input)).toBeNull();
    }
  });
});

describe("formatBdPhone", () => {
  it("shows the local form", () => {
    expect(formatBdPhone("+8801712345678")).toBe("01712-345678");
  });
});
