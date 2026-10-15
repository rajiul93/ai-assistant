/**
 * The three calendars people in Bangladesh read side by side: English (Gregorian), Bangla
 * (বঙ্গাব্দ, the revised Bangladesh calendar) and Arabic (হিজরি). Dates are calendar days; build
 * them at local noon (`dayOf`) so no time zone moves a day across midnight.
 */

export const toBanglaDigits = (value: number | string) => String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);

export const ENGLISH_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
export const BANGLA_MONTHS = ["বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"];
export const HIJRI_MONTHS = ["মুহাররম", "সফর", "রবিউল আউয়াল", "রবিউস সানি", "জমাদিউল আউয়াল", "জমাদিউস সানি", "রজব", "শাবান", "রমজান", "শাওয়াল", "জিলকদ", "জিলহজ"];
export const HIJRI_MONTHS_ARABIC = ["مُحَرَّم", "صَفَر", "رَبِيع الأَوَّل", "رَبِيع الآخِر", "جُمَادَى الأُولَى", "جُمَادَى الآخِرَة", "رَجَب", "شَعْبَان", "رَمَضَان", "شَوَّال", "ذُو القَعْدَة", "ذُو الحِجَّة"];
export const WEEKDAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
export const WEEKDAYS_LONG = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

export type CalendarDate = { year: number; month: number; day: number };

/** A calendar day at local noon. */
export const dayOf = (year: number, month: number, day: number) => new Date(year, month, day, 12);

const DAY_MS = 86_400_000;
const daysBetween = (from: Date, to: Date) => Math.round((dayOf(to.getFullYear(), to.getMonth(), to.getDate()).getTime() - dayOf(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / DAY_MS);

/**
 * Bangla date by the calendar Bangladesh revised in 2019: the year starts on 14 April; বৈশাখ to
 * আশ্বিন have 31 days, কার্তিক to মাঘ and চৈত্র 30, ফাল্গুন 29 (30 when that February has 29 days),
 * so ফাল্গুন always starts on 14 February (২১ ফেব্রুয়ারি = ৮ ফাল্গুন, ১৬ ডিসেম্বর = ১ পৌষ).
 */
export function banglaDate(date: Date): CalendarDate {
  const gregorianYear = date.getFullYear();
  const startYear = daysBetween(dayOf(gregorianYear, 3, 14), date) >= 0 ? gregorianYear : gregorianYear - 1;
  let offset = daysBetween(dayOf(startYear, 3, 14), date);
  const leap = (startYear + 1) % 4 === 0 && ((startYear + 1) % 100 !== 0 || (startYear + 1) % 400 === 0);
  const lengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, leap ? 30 : 29, 30];
  let month = 0;
  while (offset >= lengths[month]) { offset -= lengths[month]; month += 1; }
  return { year: startYear - 593, month, day: offset + 1 };
}

const hijriFormat = typeof Intl !== "undefined" ? new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }) : null;

/**
 * Hijri date from the Umm al-Qura tables the browser knows. Bangladesh starts months on its own
 * moon sighting, often a day after Saudi Arabia, so `adjust` (−2…+2 days) lets the user match it.
 */
export function hijriDate(date: Date, adjust = 0): CalendarDate | null {
  if (!hijriFormat) return null;
  const shifted = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + adjust, 12));
  const parts = Object.fromEntries(hijriFormat.formatToParts(shifted).map((part) => [part.type, part.value]));
  const [year, month, day] = [Number.parseInt(parts.year, 10), Number(parts.month), Number(parts.day)];
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
}

/** "১ কার্তিক ১৪৩৩" */
export const formatBangla = (value: CalendarDate) => `${toBanglaDigits(value.day)} ${BANGLA_MONTHS[value.month]} ${toBanglaDigits(value.year)}`;
/** "২৩ রবিউস সানি ১৪৪৮" */
export const formatHijri = (value: CalendarDate) => `${toBanglaDigits(value.day)} ${HIJRI_MONTHS[value.month]} ${toBanglaDigits(value.year)}`;
/** "১৫ অক্টোবর ২০২৬" */
export const formatEnglish = (date: Date) => `${toBanglaDigits(date.getDate())} ${ENGLISH_MONTHS[date.getMonth()]} ${toBanglaDigits(date.getFullYear())}`;
