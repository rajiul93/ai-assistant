/**
 * Affiliate links (docs/affiliate-plan.md). Pure, used by the route guard, the server and the page.
 *
 * A link is any page of the app with `?ref=CODE`. Wherever it was shared (Facebook, Messenger,
 * WhatsApp, Telegram, email, SMS, another site, pasted by hand), opening it stores the code with the
 * time in a cookie; signing up or buying within the window then ties the customer to the affiliate.
 */

export const REF_PARAM = "ref";
export const REF_COOKIE = "prep_ref";
/** The cookie outlives any window the admin can set; the window itself is checked on the server. */
export const REF_COOKIE_DAYS = 365;
export const WINDOW_DAYS_MAX = 365;

const CODE = /^[A-Z0-9]{4,12}$/;
/** Letters and digits that can't be mistaken for each other when read aloud or typed (no 0/O, 1/I). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const normalizeCode = (value: string | null | undefined) => {
  const code = (value ?? "").trim().toUpperCase();
  return CODE.test(code) ? code : null;
};

export function makeCode(random: () => number = Math.random, length = 6) {
  return Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
}

/** Cookie value: `CODE.<ms since epoch>` (when the link was opened). */
export const refCookieValue = (code: string, at: number) => `${code}.${at}`;

export function parseRefCookie(value: string | null | undefined): { code: string; at: number } | null {
  const [rawCode, rawAt] = (value ?? "").split(".");
  const code = normalizeCode(rawCode);
  const at = Number(rawAt);
  return code && Number.isFinite(at) && at > 0 ? { code, at } : null;
}

/** Whether a link opened at `at` still counts `now`, for a window of `days`. */
export const withinWindow = (at: number, now: number, days: number) => at <= now && now - at <= days * 24 * 60 * 60 * 1000;

export type CommissionRules = { commissionMode: "PERCENT" | "FIXED"; percent: number; fixedBdt: number };

/** The commission on a payment of `paidBdt` (rounded down to whole taka; never more than was paid). */
export function commissionFor(rules: CommissionRules, paidBdt: number) {
  if (paidBdt <= 0) return { amountBdt: 0, rule: rules.commissionMode === "PERCENT" ? `${rules.percent}%` : `৳${rules.fixedBdt}` };
  if (rules.commissionMode === "PERCENT") return { amountBdt: Math.floor((paidBdt * Math.max(0, Math.min(100, rules.percent))) / 100), rule: `${rules.percent}%` };
  return { amountBdt: Math.max(0, Math.min(rules.fixedBdt, paidBdt)), rule: `৳${rules.fixedBdt}` };
}

/** The link to share: the app's home page with the code. */
export const affiliateLink = (appUrl: string, code: string) => `${appUrl.replace(/\/$/, "")}/?${REF_PARAM}=${code}`;

/** One-tap share targets. Any other place works too: the link is just copied. */
export function shareTargets(link: string, text: string) {
  const url = encodeURIComponent(link);
  const message = encodeURIComponent(`${text} ${link}`);
  return [
    { id: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { id: "messenger", label: "Messenger", href: `fb-messenger://share/?link=${url}` },
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${message}` },
    { id: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}` },
    { id: "email", label: "Email", href: `mailto:?subject=${encodeURIComponent(text)}&body=${message}` },
    { id: "sms", label: "SMS", href: `sms:?&body=${message}` },
  ] as const;
}
