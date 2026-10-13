/**
 * Bangladesh mobile numbers. People type them many ways — `01712345678`, `+880 1712-345678`,
 * `8801712345678`, Bangla digits — and all of them are stored one way: `+8801XXXXXXXXX`.
 */

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** `+8801XXXXXXXXX`, or null when the text isn't a Bangladesh mobile number. */
export function normalizeBdPhone(input: string): string | null {
  const ascii = input.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
  // Spaces, dashes, dots and brackets are only formatting; any other character makes it invalid.
  const compact = ascii.trim().replace(/[\s\-().]/g, "");
  const local = compact.replace(/^(\+?88)(?=01)/, "");
  // 01 + operator digit 3–9 + 8 digits (e.g. 017…, 019…, 013…).
  return /^01[3-9]\d{8}$/.test(local) ? `+88${local}` : null;
}

/** For showing a stored number: `01712-345678`. */
export function formatBdPhone(stored: string) {
  const local = stored.replace(/^\+88/, "");
  return local.length === 11 ? `${local.slice(0, 5)}-${local.slice(5)}` : stored;
}
