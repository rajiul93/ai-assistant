import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";

/** A finished task that hasn't been revised for this many days needs revision again. */
export const STALE_DAYS = 7;

type RevisableTask = { status: string; lastRevisedAt: Date | string | null };

/** Tasks that belong in the revision list: finished, or explicitly marked "Revision". */
export function isRevisionTask(task: { status: string }) {
  return task.status === "FINISHED" || task.status === "REVISION";
}

/** Whole days since the last revision in the app timezone, or null if never revised. */
export function daysSinceRevised(lastRevisedAt: Date | string | null, todayMs: number) {
  if (!lastRevisedAt) return null;
  return dayjs(todayMs).tz(APP_TIMEZONE).startOf("day").diff(dayjs(lastRevisedAt).tz(APP_TIMEZONE).startOf("day"), "day");
}

export function needsRevision(task: RevisableTask, todayMs: number) {
  const days = daysSinceRevised(task.lastRevisedAt, todayMs);
  return days === null || days >= STALE_DAYS;
}

/** Revision tasks never revised or not revised for a week — the number shown on tabs and the dashboard. */
export function dueRevisionCount(tasks: RevisableTask[], todayMs: number) {
  return tasks.filter((task) => isRevisionTask(task) && needsRevision(task, todayMs)).length;
}

export function lastRevisedLabel(lastRevisedAt: Date | string | null, todayMs: number) {
  const days = daysSinceRevised(lastRevisedAt, todayMs);
  if (days === null) return "not revised yet";
  return days <= 0 ? "last: today" : days === 1 ? "last: yesterday" : `last: ${days} days ago`;
}
