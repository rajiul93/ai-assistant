import { describe, expect, it } from "vitest";
import { affiliateLink, commissionFor, makeCode, normalizeCode, parseRefCookie, refCookieValue, shareTargets, withinWindow } from "./affiliate";

describe("affiliate helpers", () => {
  it("accepts only clean codes", () => {
    expect(normalizeCode(" abc123 ")).toBe("ABC123");
    expect(normalizeCode("ab")).toBeNull();
    expect(normalizeCode("ABC-123")).toBeNull();
    expect(normalizeCode(null)).toBeNull();
    expect(makeCode(() => 0.5)).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("round-trips the cookie and checks the window", () => {
    const value = refCookieValue("ABC123", 1_000);
    expect(parseRefCookie(value)).toEqual({ code: "ABC123", at: 1_000 });
    expect(parseRefCookie("junk")).toBeNull();
    const day = 24 * 60 * 60 * 1000;
    expect(withinWindow(0, 30 * day, 30)).toBe(true);
    expect(withinWindow(0, 31 * day, 30)).toBe(false);
    expect(withinWindow(10, 5, 30)).toBe(false);
  });

  it("works out commissions", () => {
    expect(commissionFor({ commissionMode: "PERCENT", percent: 20, fixedBdt: 0 }, 499)).toEqual({ amountBdt: 99, rule: "20%" });
    expect(commissionFor({ commissionMode: "FIXED", percent: 0, fixedBdt: 50 }, 499)).toEqual({ amountBdt: 50, rule: "৳50" });
    expect(commissionFor({ commissionMode: "FIXED", percent: 0, fixedBdt: 50 }, 30).amountBdt).toBe(30);
    expect(commissionFor({ commissionMode: "PERCENT", percent: 20, fixedBdt: 0 }, 0).amountBdt).toBe(0);
  });

  it("builds the link and share targets", () => {
    const link = affiliateLink("https://prep.app/", "ABC123");
    expect(link).toBe("https://prep.app/?ref=ABC123");
    const targets = shareTargets(link, "Prep");
    expect(targets.map((target) => target.id)).toEqual(["facebook", "messenger", "whatsapp", "telegram", "email", "sms"]);
    expect(targets.every((target) => target.href.includes(encodeURIComponent(link)))).toBe(true);
  });
});
