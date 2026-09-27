/**
 * Numbers written the way a Bangladeshi says them, for the Bangla voice. Text-to-speech reads
 * "২০২৫" or "1971" digit by digit or in English; here years become "দুই হাজার পঁচিশ" /
 * "উনিশশো একাত্তর", and other numbers, dates, times, taka and percentages become Bangla words.
 */

const UNDER_100 = [
  "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চোদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ",
  "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আটাশ", "ঊনত্রিশ",
  "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ",
  "চল্লিশ", "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ",
  "পঞ্চাশ", "একান্ন", "বাহান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট",
  "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর",
  "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি",
  "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "অষ্টআশি", "ঊননব্বই",
  "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
];

const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
// Keys are NFC-normalized, like the text they are matched against ("য়" has two spellings).
const ORDINALS = new Map(Object.entries({ "1ম": "প্রথম", "2য়": "দ্বিতীয়", "3য়": "তৃতীয়", "4র্থ": "চতুর্থ", "5ম": "পঞ্চম", "6ষ্ঠ": "ষষ্ঠ", "7ম": "সপ্তম", "8ম": "অষ্টম", "9ম": "নবম", "10ম": "দশম" }).map(([key, word]) => [key.normalize("NFC"), word]));
const ORDINAL_PATTERN = new RegExp(`\\b(${[...ORDINALS.keys()].sort((a, b) => b.length - a.length).join("|")})`, "g");

/** Month names (Bangla and English) that tell a following four-digit number is a year. */
const MONTH_WORDS = /(জানুয়ারি|জানুয়ারী|ফেব্রুয়ারি|ফেব্রুয়ারী|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর|বৈশাখ|জ্যৈষ্ঠ|আষাঢ়|শ্রাবণ|ভাদ্র|আশ্বিন|কার্তিক|অগ্রহায়ণ|পৌষ|মাঘ|ফাল্গুন|চৈত্র|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s*,?\s*$/i;
/** Words after a number that make it a year. */
const YEAR_AFTER = /^\s*-?\s*(সাল|সালে|সালের|সন|সনে|সনের|খ্রিস্টাব্দ|খ্রিষ্টাব্দ|খ্রি\.|বঙ্গাব্দ|হিজরি)/;
/** Words after a number that make it a count or an amount, never a year. */
const COUNT_AFTER = /^\s*-?\s*(টাকা|টি|টা|জন|বার|দিন|মাস|বছর|ঘণ্টা|ঘন্টা|মিনিট|সেকেন্ড|নম্বর|পৃষ্ঠা|পাতা|কিমি|কিলো|গ্রাম|লিটার|শতাংশ|%|tk|taka)/i;

const toLatinDigits = (text: string) => text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));

/** 0 – 99,99,99,999 in words (Bangladeshi system: শো, হাজার, লাখ, কোটি). */
export function banglaNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) return String(value);
  if (value < 100) return UNDER_100[value];
  const parts: string[] = [];
  let rest = Math.floor(value);
  const take = (size: number, name: string) => {
    const count = Math.floor(rest / size);
    if (count) { parts.push(`${banglaNumber(count)} ${name}`); rest %= size; }
  };
  take(10_000_000, "কোটি");
  take(100_000, "লাখ");
  take(1_000, "হাজার");
  const hundreds = Math.floor(rest / 100);
  if (hundreds) { parts.push(`${UNDER_100[hundreds]}শো`); rest %= 100; }
  if (rest) parts.push(UNDER_100[rest]);
  return parts.join(" ");
}

/** A year as it is said: ১৯৭১ → উনিশশো একাত্তর, ১৪৩২ → চোদ্দশো বত্রিশ, ২০২৫ → দুই হাজার পঁচিশ. */
export function banglaYear(year: number): string {
  if (year >= 1100 && year < 2000) {
    const rest = year % 100;
    return `${UNDER_100[Math.floor(year / 100)]}শো${rest ? ` ${UNDER_100[rest]}` : ""}`;
  }
  return banglaNumber(year);
}

/** 10:30 PM → রাত সাড়ে দশটা, 1:30 → দেড়টা, 9:45 → পৌনে দশটা, 7:10 → সাতটা দশ মিনিট */
function banglaTime(hour: number, minute: number, meridiem?: string) {
  let h = hour;
  const pm = meridiem?.toLowerCase().startsWith("p");
  if (meridiem && pm && h < 12) h += 12;
  if (meridiem && !pm && h === 12) h = 0;
  // With AM/PM, or a 24-hour time like 18:30, say the part of the day and a 12-hour clock.
  const twelve = Boolean(meridiem) || h >= 13;
  const part = !twelve ? "" : h < 4 ? "রাত " : h < 12 ? "সকাল " : h < 16 ? "দুপুর " : h < 18 ? "বিকেল " : h < 20 ? "সন্ধ্যা " : "রাত ";
  const clock = (value: number) => value % 12 || 12;
  const oClock = (value: number) => `${UNDER_100[clock(value)] ?? banglaNumber(clock(value))}টা`;
  if (minute === 30) return part + (clock(h) === 1 ? "দেড়টা" : clock(h) === 2 ? "আড়াইটা" : `সাড়ে ${oClock(h)}`);
  if (minute === 15) return `${part}সোয়া ${oClock(h)}`;
  if (minute === 45) return `${part}পৌনে ${oClock(h + 1)}`;
  return `${part}${oClock(h)}${minute ? ` ${banglaNumber(minute)} মিনিট` : ""}`;
}

/** Plain digits of a number as words, one by one (phone numbers, IDs, codes). */
const digitByDigit = (digits: string) => [...digits].map((digit) => UNDER_100[Number(digit)]).join(" ");

/** Rewrites every number in a Bangla sentence into the words a person would say. */
export function speakableBangla(input: string): string {
  let text = toLatinDigits(input.normalize("NFC"));

  // Ordinals: ১ম, ২য়, ৪র্থ…
  text = text.replace(ORDINAL_PATTERN, (match) => ORDINALS.get(match) ?? match);

  // Dates: 26/03/2025, 26-3-2025, 26.03.2025
  text = text.replace(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g, (match, day: string, month: string, year: string) => {
    const d = Number(day);
    const m = Number(month);
    if (d < 1 || d > 31 || m < 1 || m > 12) return match;
    return `${banglaNumber(d)} ${MONTHS[m - 1]} ${banglaYear(Number(year))}`;
  });

  // Times: 10:30, 10:30 PM, 9:05am
  text = text.replace(/\b(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm|a\.m\.|p\.m\.))?/g, (match, hour: string, minute: string, meridiem: string | undefined, offset: number, whole: string) => {
    const h = Number(hour);
    const m = Number(minute);
    if (h > 23 || m > 59) return match;
    const said = banglaTime(h, m, meridiem);
    // "রাত 10:30 PM" already names the part of the day; don't say it twice.
    return /(সকাল|দুপুর|বিকেল|বিকাল|সন্ধ্যা|রাত|ভোর)\s*$/.test(whole.slice(0, offset)) ? said.replace(/^(সকাল|দুপুর|বিকেল|সন্ধ্যা|রাত) /, "") : said;
  });

  // Taka: ৳1,500 / Tk 499 → এক হাজার পাঁচশো টাকা
  text = text.replace(/(?:৳|\bTk\.?|\bBDT)\s*(\d[\d,]*)(?:\.(\d+))?/gi, (_match, whole: string) => `${banglaNumber(Number(whole.replace(/,/g, "")))} টাকা`);

  // Percentages: 50% → পঞ্চাশ শতাংশ
  text = text.replace(/(\d[\d,]*)(?:\.(\d+))?\s*%/g, (_match, whole: string, fraction?: string) =>
    `${banglaNumber(Number(whole.replace(/,/g, "")))}${fraction ? ` দশমিক ${digitByDigit(fraction)}` : ""} শতাংশ`);

  // Every other number, with commas and decimals.
  text = text.replace(/\d[\d,]*(?:\.\d+)?/g, (match, offset: number, whole: string) => {
    const [integer, fraction] = match.split(".");
    const digits = integer.replace(/,/g, "");
    // Phone numbers, IDs, codes: long or starting with 0 — read digit by digit.
    if (digits.length > 9 || (digits.length > 1 && digits.startsWith("0") && !integer.includes(","))) return digitByDigit(digits);
    const value = Number(digits);
    const before = whole.slice(0, offset);
    const after = whole.slice(offset + match.length);
    const looksLikeYear = digits.length === 4 && !integer.includes(",") && !fraction && value >= 1000 && value <= 2199
      && (YEAR_AFTER.test(after) || MONTH_WORDS.test(before)
        // A bare 19xx/20xx that isn't a count of something is almost always a year.
        || (value >= 1900 && value <= 2099 && !COUNT_AFTER.test(after)));
    const words = looksLikeYear ? banglaYear(value) : banglaNumber(value);
    return fraction ? `${words} দশমিক ${digitByDigit(fraction)}` : words;
  });

  // "দশটা-এ" → "দশটায়"
  return text.replace(/টা-?এ(?=[\s,।!?]|$)/g, "টায়");
}
