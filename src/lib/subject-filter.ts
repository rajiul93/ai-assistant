/**
 * Filing by the user's subject → topic tree, shared by the Preliminary, Short Question and
 * Confusion boards. Items without a subject are "Other"; a subject's items without a topic are
 * "no topic". Choosing a topic also matches its sub-topics.
 */

export type TopicNode = { id: string; name: string; subjectId: string; parentId: string | null };
export type SubjectNode = { id: string; name: string };
export type Filed = { subjectId: string | null; topicId: string | null };

/** subject: a subject id, OTHER (no subject) or null (all); topic: a topic id, NO_TOPIC or null (all). */
export type FilterSelection = { subject: string | null; topic: string | null };
export const OTHER = "other";
export const NO_TOPIC = "none";

/** A topic's id and every topic below it. */
export function withDescendants(topicId: string, topics: TopicNode[]) {
  const ids = new Set([topicId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const topic of topics) if (topic.parentId && ids.has(topic.parentId) && !ids.has(topic.id)) { ids.add(topic.id); grew = true; }
  }
  return ids;
}

/** "Parent › Child" for a topic, so nested topics read clearly in a flat list. */
export function topicPath(topic: TopicNode, topics: TopicNode[]) {
  const byId = new Map(topics.map((item) => [item.id, item]));
  const names = [topic.name];
  let parent = topic.parentId ? byId.get(topic.parentId) : undefined;
  for (let guard = 0; parent && guard < 10; guard++) { names.unshift(parent.name); parent = parent.parentId ? byId.get(parent.parentId) : undefined; }
  return names.join(" › ");
}

/** A subject's topics in tree order (parents before their children), each with its path. */
export function topicsOf(subjectId: string, topics: TopicNode[]) {
  const mine = topics.filter((topic) => topic.subjectId === subjectId);
  const ordered: TopicNode[] = [];
  const visit = (parentId: string | null) => {
    for (const topic of mine.filter((item) => item.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name))) { ordered.push(topic); visit(topic.id); }
  };
  visit(null);
  // Topics whose parent is missing from the list still show.
  for (const topic of mine) if (!ordered.includes(topic)) ordered.push(topic);
  return ordered.map((topic) => ({ ...topic, path: topicPath(topic, topics) }));
}

/** Whether an item belongs to the chosen subject and topic. */
export function matchesSelection(item: Filed, selection: FilterSelection, topics: TopicNode[], subjectIds: Set<string>) {
  // An item whose subject no longer exists counts as Other.
  const subjectId = item.subjectId && subjectIds.has(item.subjectId) ? item.subjectId : null;
  if (selection.subject === OTHER) return subjectId === null;
  if (selection.subject && subjectId !== selection.subject) return false;
  if (!selection.subject || !selection.topic) return true;
  if (selection.topic === NO_TOPIC) return !item.topicId;
  return Boolean(item.topicId && withDescendants(selection.topic, topics).has(item.topicId));
}

/** The selection kept in the page URL (?subject=…&topic=…). */
export function readSelection(params: { get: (key: string) => string | null }): FilterSelection {
  const subject = params.get("subject") || null;
  return { subject, topic: subject && subject !== OTHER ? params.get("topic") || null : null };
}
