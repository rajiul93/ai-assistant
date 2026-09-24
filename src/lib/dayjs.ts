import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Dhaka";

export function now() {
  return dayjs().tz(APP_TIMEZONE);
}

export function startOfDay(date?: dayjs.ConfigType) {
  return dayjs(date).tz(APP_TIMEZONE).startOf("day");
}

export function endOfDay(date?: dayjs.ConfigType) {
  return dayjs(date).tz(APP_TIMEZONE).endOf("day");
}

export function startOfWeek(date?: dayjs.ConfigType) {
  return dayjs(date).tz(APP_TIMEZONE).startOf("week");
}

export function startOfMonth(date?: dayjs.ConfigType) {
  return dayjs(date).tz(APP_TIMEZONE).startOf("month");
}

export function formatRemaining(deadline: Date) {
  const start = now();
  const end = dayjs(deadline).tz(APP_TIMEZONE);
  if (!end.isAfter(start)) {
    return { overdue: true, label: "OVERDUE" };
  }

  const years = end.diff(start, "year");
  const afterYears = start.add(years, "year");
  const months = end.diff(afterYears, "month");
  const afterMonths = afterYears.add(months, "month");
  const days = end.diff(afterMonths, "day");

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}Y`);
  if (months > 0) parts.push(`${months}M`);
  parts.push(`${days}D`);

  return { overdue: false, label: `${parts.join(" ")} LEFT` };
}

export type CountdownParts = {
  expired: boolean;
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/**
 * Calendar-aware time from `from` to `to`: whole years and months first (so "1 month" means a real
 * calendar month in the app timezone), then the rest as days/hours/minutes/seconds.
 */
export function diffParts(from: dayjs.ConfigType, to: dayjs.ConfigType): CountdownParts {
  const start = dayjs(from).tz(APP_TIMEZONE);
  const end = dayjs(to).tz(APP_TIMEZONE);
  if (!end.isAfter(start)) {
    return { expired: true, years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const years = end.diff(start, "year");
  const afterYears = start.add(years, "year");
  const months = end.diff(afterYears, "month");
  const afterMonths = afterYears.add(months, "month");
  const restSeconds = Math.floor(end.diff(afterMonths, "millisecond") / 1000);

  return {
    expired: false,
    years,
    months,
    days: Math.floor(restSeconds / 86_400),
    hours: Math.floor((restSeconds % 86_400) / 3_600),
    minutes: Math.floor((restSeconds % 3_600) / 60),
    seconds: restSeconds % 60,
  };
}

/** Time left until `deadline`; `expired` once it has passed. */
export function countdownParts(deadline: dayjs.ConfigType, nowMs: number) {
  return diffParts(nowMs, deadline);
}

/** The day someone born on `dateOfBirth` turns `years` old (midnight, app timezone). */
export function birthdayAtAge(dateOfBirth: dayjs.ConfigType, years: number) {
  return dayjs(dateOfBirth).tz(APP_TIMEZONE).startOf("day").add(years, "year");
}

export function formatHoursMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatDurationFromSeconds(totalSeconds: number) {
  return formatHoursMinutes(Math.floor(totalSeconds / 60));
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatDate(date: Date) {
  return dayjs(date).tz(APP_TIMEZONE).format("D MMMM YYYY");
}

export function formatDateTime(date: Date) {
  return dayjs(date).tz(APP_TIMEZONE).format("D MMM YYYY, h:mm A");
}

export { dayjs };
