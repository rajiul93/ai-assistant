/**
 * Messages from server actions that reach the user on the live site too (found 2026-10-16).
 *
 * In production React hides the message of an Error thrown in a server action — the page gets
 * "Minified React error #441" — but it keeps the error's `digest`, and Next passes a digest we set
 * ourselves through unchanged. So server code throws `userError("…")`, which carries the message in
 * its digest, and the page reads it back with `errorMessage(error)`. In `next dev` the message
 * itself arrives as well, so both paths give the same text.
 */

import { ZodError } from "zod";

const PREFIX = "prep-user:";

// A failed `schema.parse(…)` in a server action is thrown as a ZodError, whose message production
// hides too. When its first problem is one of our own Bangla messages ("নাম লেখো"), give it the same
// digest so the page shows that; zod's English defaults stay hidden behind the fallback.
if (!Object.getOwnPropertyDescriptor(ZodError.prototype, "digest")) {
  Object.defineProperty(ZodError.prototype, "digest", {
    configurable: true,
    get(this: ZodError) {
      const message = this.issues[0]?.message;
      return message && /[\u0980-\u09FF]/.test(message) ? `${PREFIX}${message}` : undefined;
    },
  });
}

/** An Error whose message is meant for the user (a short Bangla sentence) and survives production. */
export function userError(message: string): Error {
  const error = new Error(message) as Error & { digest?: string };
  error.digest = `${PREFIX}${message}`;
  return error;
}

/** React's stand-in for a hidden message, which is no use to show. */
const HIDDEN = /Minified React error|omitted in production|Server Components render|An unexpected response was received/i;

/** The text to show for a failed server action (or anything else thrown), else `fallback`. */
export function errorMessage(error: unknown, fallback = "কিছু একটা গোলমাল হয়েছে। একটু পরে আবার চেষ্টা করো।") {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith(PREFIX)) {
    return error.digest.slice(PREFIX.length);
  }
  if (error instanceof Error && error.message.trim() && !HIDDEN.test(error.message)) return error.message;
  return fallback;
}
