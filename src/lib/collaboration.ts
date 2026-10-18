import { z } from "zod";
import { SOLUTION_MAX } from "@/lib/preliminary";

/**
 * Pure helpers for friends, sharing and chat (docs/collaboration-plan.md). No database access here,
 * so they can be unit-tested and used on both server and client.
 */

/** A pair of users is stored once, smaller id first (Friendship, Conversation; a DB CHECK enforces it). */
export function orderPair(a: string, b: string): [string, string] {
  if (a === b) throw new Error("A pair needs two different users.");
  return a < b ? [a, b] : [b, a];
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * What a non-friend may see of someone's email: the first two letters and the domain
 * ("ra•••@gmail.com"). Friends see the full address.
 */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "•••";
  return `${name.slice(0, 2)}•••@${domain}`;
}

/** The name to show for a user: their name, else the masked (or, for friends, full) email. */
export function displayName(user: { name: string | null; email: string }, isFriend: boolean) {
  return user.name?.trim() || (isFriend ? user.email : maskEmail(user.email));
}

export const initialOf = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

/* ---------- Share payloads: a copy of the item frozen at send time ---------- */

export const SHARE_TYPES = ["NOTE", "TASK", "PRELIMINARY_SET", "SHORT_QUESTION_SET"] as const;
export type ShareType = (typeof SHARE_TYPES)[number];

const placement = { subjectName: z.string().max(200).nullable(), topicName: z.string().max(200).nullable() };

export const notePayloadSchema = z.object({
  ...placement,
  title: z.string().max(200),
  content: z.string().max(400_000),
});

export const taskPayloadSchema = z.object({
  ...placement,
  title: z.string().max(300),
  description: z.string().max(20_000).nullable(),
  estimatedMinutes: z.number().int().min(1).max(24 * 60),
  dueDate: z.string().datetime().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const preliminaryPayloadSchema = z.object({
  subjectName: placement.subjectName,
  topicName: z.string().max(160),
  date: z.string().datetime(),
  questions: z.array(z.object({
    text: z.string().max(2000),
    options: z.array(z.string().max(500)).min(4).max(5),
    correctIndex: z.number().int().min(0).max(4),
    solution: z.string().max(SOLUTION_MAX).nullish(),
    explanation: z.string().max(SOLUTION_MAX).nullish(),
  }).refine((question) => question.correctIndex < question.options.length)).min(1).max(300),
});

export const shortQuestionPayloadSchema = z.object({
  subjectName: placement.subjectName,
  topicName: z.string().max(160),
  date: z.string().datetime(),
  questions: z.array(z.object({ text: z.string().max(2000), answer: z.string().max(4000) })).min(1).max(300),
});

export const payloadSchemas = {
  NOTE: notePayloadSchema,
  TASK: taskPayloadSchema,
  PRELIMINARY_SET: preliminaryPayloadSchema,
  SHORT_QUESTION_SET: shortQuestionPayloadSchema,
} as const;

export type SharePayload = {
  NOTE: z.infer<typeof notePayloadSchema>;
  TASK: z.infer<typeof taskPayloadSchema>;
  PRELIMINARY_SET: z.infer<typeof preliminaryPayloadSchema>;
  SHORT_QUESTION_SET: z.infer<typeof shortQuestionPayloadSchema>;
};

export const shareTypeLabel: Record<ShareType, string> = {
  NOTE: "Note",
  TASK: "Task",
  PRELIMINARY_SET: "Preliminary set",
  SHORT_QUESTION_SET: "Short Question set",
};

/** Where an accepted item opens in the recipient's app. */
export function sharedItemPath(type: ShareType, itemId: string) {
  switch (type) {
    case "NOTE": return "/notes";
    case "TASK": return "/tasks";
    case "PRELIMINARY_SET": return `/preliminary/${itemId}`;
    case "SHORT_QUESTION_SET": return `/short-questions/${itemId}`;
  }
}

/** A one-line preview of a share for the accept dialog and notifications ("২০টি প্রশ্ন · বাংলা"). */
export function sharePreview(type: ShareType, payload: unknown) {
  const parsed = payloadSchemas[type].safeParse(payload);
  if (!parsed.success) return "";
  const data = parsed.data as { subjectName?: string | null; questions?: unknown[] };
  const parts = [data.questions ? `${data.questions.length}টি প্রশ্ন` : null, data.subjectName ?? null].filter(Boolean);
  return parts.join(" · ");
}

/* ---------- Chat ---------- */

export const MESSAGE_MAX = 4000;
export const MESSAGE_PAGE = 30;

/** Unread messages: from the other person, after my last read time (none read yet = all of theirs). */
export function isUnread(message: { senderId: string; createdAt: Date }, me: string, lastReadAt: Date | null) {
  return message.senderId !== me && (!lastReadAt || message.createdAt > lastReadAt);
}

/** My side of a conversation: which last-read column is mine and who the other person is. */
export function conversationSide(conversation: { userAId: string; userBId: string }, me: string) {
  if (conversation.userAId === me) return { mine: "userALastReadAt" as const, otherId: conversation.userBId };
  if (conversation.userBId === me) return { mine: "userBLastReadAt" as const, otherId: conversation.userAId };
  return null;
}

/* ---------- Group chat (docs/profile-and-group-chat-plan.md §2) ---------- */

/** A group is 3–20 people including its creator; two people use the 1:1 chat. */
export const GROUP_MIN = 3;
export const GROUP_MAX = 20;
export const GROUP_NAME_MAX = 60;

/**
 * Who becomes admin when the admin leaves: the member who joined first (ties by id, so every
 * server picks the same one). Null when nobody is left.
 */
export function nextGroupAdmin(members: Array<{ userId: string; joinedAt: Date }>) {
  const [first] = [...members].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.userId.localeCompare(b.userId));
  return first?.userId ?? null;
}

/** The people being added, cleaned: no repeats, not me, not already in; null if it breaks the size limit. */
export function membersToAdd(requested: string[], me: string, existing: string[]) {
  const have = new Set(existing);
  const adding = [...new Set(requested)].filter((id) => id !== me && !have.has(id));
  return have.size + adding.length > GROUP_MAX ? null : adding;
}
