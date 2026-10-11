/**
 * Singular/plural helpers for Vocabulary. The nouns themselves live in the database (built-in ones
 * are loaded by prisma/seed-vocabulary.ts).
 */

/** Which rule the plural follows, as a short label for the table. */
export function pluralRule(singular: string, plural: string) {
  if (singular === "-" || !singular) return "শুধু বহুবচন";
  if (plural === "-" || !plural) return "অগণনযোগ্য";
  const first = plural.split("/")[0].trim();
  const s = singular.toLowerCase();
  const p = first.toLowerCase();
  if (s === p) return "একই রূপ";
  if (s.includes("-") && p.includes("-") && s.split("-").slice(1).join("-") === p.split("-").slice(1).join("-") && s.split("-")[0] !== p.split("-")[0]) return "প্রধান শব্দে বহুবচন";
  // Exams ask about the ones that break the spelling rule: stomach → stomachs, roof → roofs, photo → photos, German → Germans.
  if (p === `${s}s`) return /(ch|f|fe|o|man)$/.test(s) ? "+s (ব্যতিক্রম)" : "+s";
  if (p === `${s}es`) return s.endsWith("o") ? "o → oes" : "+es";
  if (p === `${s}zes`) return "z → zzes";
  if (/y$/.test(s) && p === `${s.slice(0, -1)}ies`) return "y → ies";
  if (/(f|fe)$/.test(s) && p.endsWith("ves")) return "f / fe → ves";
  if ((s.endsWith("um") && p.endsWith("a")) || (s.endsWith("on") && p.endsWith("a")) || (s.endsWith("us") && (p.endsWith("i") || p.endsWith("era") || p.endsWith("ora")))
    || (s.endsWith("is") && p.endsWith("es")) || (s.endsWith("a") && p.endsWith("ae")) || (/(ex|ix)$/.test(s) && p.endsWith("ices")) || p.endsWith("eaux") || p.endsWith("im")) return "বিদেশি শব্দ";
  return "অনিয়মিত";
}

/** Bangla plural of a meaning: people take "-রা" (শিশুরা), things "-গুলো" (বইগুলো); each "/" alternative separately. */
export function banglaPlural(meaning: string, person: boolean) {
  return meaning
    .split(" / ")
    .map((alt) => {
      // A meaning with a note ("ডজন (two dozen eggs)", "গণ (জীববিজ্ঞান)") reads wrong with -গুলো; keep it as it is.
      if (/\(.*\)/.test(alt)) return alt;
      return `${alt.trim()}${person ? "রা" : "গুলো"}`;
    })
    .join(" / ");
}

/** A noun is known by its singular, or by its plural when it has no singular (scissors). */
export const nounKey = (noun: { singular: string; plural: string }) => (noun.singular === "-" ? noun.plural : noun.singular).trim().toLowerCase();

/** Bangla words that name a person, so a noun an admin adds gets "-রা" (ছাত্ররা) rather than "-গুলো". */
const personWords = /(ক|কারী|জীবী|বিদ|কর্মী|দার|চারী|পাল|দাতা|কর্তা|ভোগী|ব্যক্তি|লোক|মানুষ|ছাত্র|ছাত্রী|শিক্ষক|বন্ধু|শত্রু|শিশু|মহিলা|পুরুষ|নারী)$/;
export const namesAPerson = (meaning: string) => personWords.test(meaning.split(" / ")[0].replace(/\([^)]*\)/g, "").trim());
