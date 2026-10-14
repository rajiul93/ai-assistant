import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";

const local = (date: Date | string) => dayjs(date).tz(APP_TIMEZONE);

/** The day a message belongs to, for "a new day starts here" dividers. */
export const chatDayKey = (date: Date | string) => local(date).format("YYYY-MM-DD");

/** Time inside a bubble: "4:05 PM". */
export const bubbleTime = (date: Date | string) => local(date).format("h:mm A");

/** Divider between days: আজ, গতকাল, or the date. */
export function chatDayLabel(date: Date | string, nowMs = Date.now()) {
  const day = local(date).startOf("day");
  const today = dayjs(nowMs).tz(APP_TIMEZONE).startOf("day");
  const days = today.diff(day, "day");
  if (days === 0) return "আজ";
  if (days === 1) return "গতকাল";
  return day.format(day.year() === today.year() ? "D MMMM" : "D MMMM YYYY");
}

/** Time in the chat list, as WhatsApp does: the time today, গতকাল, the weekday this week, else the date. */
export function chatListTime(date: Date | string, nowMs = Date.now()) {
  const when = local(date);
  const days = dayjs(nowMs).tz(APP_TIMEZONE).startOf("day").diff(when.startOf("day"), "day");
  if (days === 0) return when.format("h:mm A");
  if (days === 1) return "গতকাল";
  if (days < 7) return when.format("ddd");
  return when.format("D/M/YY");
}
