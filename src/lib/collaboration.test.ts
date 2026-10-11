import { describe, expect, it } from "vitest";
import { conversationSide, displayName, isUnread, maskEmail, normalizeEmail, orderPair, sharedItemPath, sharePreview } from "./collaboration";

describe("orderPair", () => {
  it("puts the smaller id first, whichever way round it is given", () => {
    expect(orderPair("b", "a")).toEqual(["a", "b"]);
    expect(orderPair("a", "b")).toEqual(["a", "b"]);
  });
  it("refuses a pair of one user", () => {
    expect(() => orderPair("a", "a")).toThrow();
  });
});

describe("emails and names", () => {
  it("normalizes case and spaces", () => expect(normalizeEmail("  Rajiul@Gmail.COM ")).toBe("rajiul@gmail.com"));
  it("masks all but two letters for non-friends", () => expect(maskEmail("rajiul@gmail.com")).toBe("ra•••@gmail.com"));
  it("shows the name first, the full email only to friends", () => {
    expect(displayName({ name: "Rahim", email: "r@x.com" }, false)).toBe("Rahim");
    expect(displayName({ name: null, email: "rahim@x.com" }, false)).toBe("ra•••@x.com");
    expect(displayName({ name: "  ", email: "rahim@x.com" }, true)).toBe("rahim@x.com");
  });
});

describe("share payloads", () => {
  const set = { subjectName: "বাংলা", topicName: "সন্ধি", date: new Date("2026-10-14").toISOString(), questions: [{ text: "q", options: ["a", "b", "c", "d"], correctIndex: 1 }] };
  it("previews question count and subject", () => expect(sharePreview("PRELIMINARY_SET", set)).toBe("1টি প্রশ্ন · বাংলা"));
  it("previews nothing for a payload of the wrong shape", () => expect(sharePreview("PRELIMINARY_SET", { title: "x" })).toBe(""));
  it("opens each type in its own section", () => {
    expect(sharedItemPath("NOTE", "n1")).toBe("/notes");
    expect(sharedItemPath("TASK", "t1")).toBe("/tasks");
    expect(sharedItemPath("PRELIMINARY_SET", "p1")).toBe("/preliminary/p1");
    expect(sharedItemPath("SHORT_QUESTION_SET", "s1")).toBe("/short-questions/s1");
  });
});

describe("chat unread", () => {
  const at = (iso: string) => new Date(iso);
  it("counts only the other person's messages after my last read", () => {
    expect(isUnread({ senderId: "them", createdAt: at("2026-10-14T10:00:00Z") }, "me", at("2026-10-14T09:00:00Z"))).toBe(true);
    expect(isUnread({ senderId: "them", createdAt: at("2026-10-14T08:00:00Z") }, "me", at("2026-10-14T09:00:00Z"))).toBe(false);
    expect(isUnread({ senderId: "me", createdAt: at("2026-10-14T10:00:00Z") }, "me", null)).toBe(false);
    expect(isUnread({ senderId: "them", createdAt: at("2026-10-14T10:00:00Z") }, "me", null)).toBe(true);
  });
  it("finds my side of a conversation, and refuses outsiders", () => {
    expect(conversationSide({ userAId: "a", userBId: "b" }, "a")).toEqual({ mine: "userALastReadAt", otherId: "b" });
    expect(conversationSide({ userAId: "a", userBId: "b" }, "b")).toEqual({ mine: "userBLastReadAt", otherId: "a" });
    expect(conversationSide({ userAId: "a", userBId: "b" }, "c")).toBeNull();
  });
});
