import { describe, expect, it } from "vitest";
import { matchesSelection, NO_TOPIC, OTHER, readSelection, topicPath, topicsOf, withDescendants, type TopicNode } from "./subject-filter";

const topics: TopicNode[] = [
  { id: "t1", name: "ব্যাকরণ", subjectId: "bangla", parentId: null },
  { id: "t2", name: "সন্ধি", subjectId: "bangla", parentId: "t1" },
  { id: "t3", name: "স্বরসন্ধি", subjectId: "bangla", parentId: "t2" },
  { id: "t4", name: "সাহিত্য", subjectId: "bangla", parentId: null },
  { id: "e1", name: "Tense", subjectId: "english", parentId: null },
];
const subjects = new Set(["bangla", "english"]);

describe("subject → topic filter", () => {
  it("a topic includes everything below it", () => {
    expect([...withDescendants("t1", topics)].sort()).toEqual(["t1", "t2", "t3"]);
    expect([...withDescendants("t4", topics)]).toEqual(["t4"]);
  });

  it("shows nested topics with their path, in tree order", () => {
    expect(topicPath(topics[2], topics)).toBe("ব্যাকরণ › সন্ধি › স্বরসন্ধি");
    expect(topicsOf("bangla", topics).map((topic) => topic.id)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("files items without a subject (or with a deleted one) under Other", () => {
    const sel = { subject: OTHER, topic: null };
    expect(matchesSelection({ subjectId: null, topicId: null }, sel, topics, subjects)).toBe(true);
    expect(matchesSelection({ subjectId: "gone", topicId: null }, sel, topics, subjects)).toBe(true);
    expect(matchesSelection({ subjectId: "bangla", topicId: null }, sel, topics, subjects)).toBe(false);
  });

  it("filters by subject, topic (with sub-topics) and no-topic", () => {
    const item = { subjectId: "bangla", topicId: "t3" };
    expect(matchesSelection(item, { subject: null, topic: null }, topics, subjects)).toBe(true);
    expect(matchesSelection(item, { subject: "english", topic: null }, topics, subjects)).toBe(false);
    expect(matchesSelection(item, { subject: "bangla", topic: "t1" }, topics, subjects)).toBe(true);
    expect(matchesSelection(item, { subject: "bangla", topic: "t4" }, topics, subjects)).toBe(false);
    expect(matchesSelection(item, { subject: "bangla", topic: NO_TOPIC }, topics, subjects)).toBe(false);
    expect(matchesSelection({ subjectId: "bangla", topicId: null }, { subject: "bangla", topic: NO_TOPIC }, topics, subjects)).toBe(true);
  });

  it("reads the selection from the URL; Other has no topic", () => {
    const params = (entries: Record<string, string>) => ({ get: (key: string) => entries[key] ?? null });
    expect(readSelection(params({ subject: "bangla", topic: "t1" }))).toEqual({ subject: "bangla", topic: "t1" });
    expect(readSelection(params({ subject: OTHER, topic: "t1" }))).toEqual({ subject: OTHER, topic: null });
    expect(readSelection(params({}))).toEqual({ subject: null, topic: null });
  });
});
