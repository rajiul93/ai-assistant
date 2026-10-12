import { describe, expect, it } from "vitest";
import { matchQuickCommand } from "./quick-commands";

const pageOf = (text: string) => {
  const command = matchQuickCommand([text]);
  return command?.kind === "navigate" ? command.page : command?.kind ?? null;
};

describe("matchQuickCommand: pages that already worked", () => {
  it.each([
    ["ড্যাশবোর্ড", "dashboard"],
    ["ড্যাশ বোর্ডে যাও", "dashboard"],
    ["টাস্ক পেজ খোলো", "tasks"],
    ["সাবজেক্ট দেখাও", "subjects"],
    ["রিভিশন", "revisions"],
    ["প্রোগ্রেস দেখাও", "progress"],
    ["টাইমার খোলো", "timer"],
    ["প্ল্যান দেখাও", "plan"],
    ["নোট খোলো", "notes"],
    ["চাকরির পেজে যাও", "jobs"],
  ])("%s → %s", (text, page) => expect(pageOf(text)).toBe(page));
});

describe("matchQuickCommand: pages added later", () => {
  it.each([
    ["প্রিলিমিনারি খোলো", "preliminary"],
    ["mcq পেজে যাও", "preliminary"],
    ["শর্ট কোয়েশ্চেন খোলো", "short_questions"],
    ["শর্ট প্রশ্ন দেখাও", "short_questions"],
    ["short question page", "short_questions"],
    ["কনফিউশন দেখাও", "confusions"],
    ["ভোকাবুলারি খোলো", "vocabulary"],
    ["টাইপিং খোলো", "typing"],
    ["মেসেজ খোলো", "messages"],
    ["ম্যাসেজ দেখাও", "messages"],
    ["নোটিফিকেশন দেখাও", "notifications"],
    ["নোটিফিকেশন", "notifications"],
    ["ইউসেজ দেখাও", "usage"],
    ["বিলিং পেজ খোলো", "billing"],
    ["open vocabulary", "vocabulary"],
    ["open typing", "typing"],
  ])("%s → %s", (text, page) => expect(pageOf(text)).toBe(page));
});

describe("matchQuickCommand: words that could open the wrong page", () => {
  it("a study plan is not billing", () => expect(pageOf("প্ল্যান খোলো")).toBe("plan"));
  it("buying a package still opens the purchase box", () => expect(pageOf("প্যাকেজ কিনবো")).toBe("buy"));
  it("timer is not typing", () => expect(pageOf("টাইমার")).toBe("timer"));
  it("notes is not notifications", () => expect(pageOf("নোটস দেখাও")).toBe("notes"));
  it("asking to make a new set goes to the AI", () => expect(pageOf("নতুন প্রিলিমিনারি সেট বানাও")).toBeNull());
  it("a question about a page goes to the AI", () => expect(pageOf("ভোকাবুলারি কিভাবে শিখবো")).toBeNull());
});
