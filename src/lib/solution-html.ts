import { plainMathToLatex, textToFormulaHtml } from "@/lib/math";
import { htmlToPlainText, isRichHtml, sanitizeNoteHtml } from "@/lib/note-html";

/**
 * MCQ solutions and explanations. Older ones (sheets, pasted text, the first AI writer) are plain
 * text, one step per line; since 2026-10-18 the AI writes them as Quill HTML (headings, history,
 * examples) and staff edit them in Quill. Both kinds are stored in the same columns and shown alike.
 */

export { SOLUTION_MAX } from "@/lib/preliminary";

/** For the read-only view and the editor: HTML as it is, plain text one paragraph per line. */
export function solutionToHtml(text: string) {
  if (isRichHtml(text)) return text;
  // AI answers often start a line with a markdown bullet ("* ", "- "); it shows as a real bullet.
  // Plain-text math from sheets (`1/2`, `√3`, `x²`) is drawn like a textbook.
  return text.split(/\r?\n/).map((line) => (line.trim() ? `<p>${textToFormulaHtml(plainMathToLatex(line.replace(/^\s*[*-]\s+/, "• ")))}</p>` : "")).join("");
}

/**
 * Web search adds its sources inline even when told not to — "([site.com](https://…))" or a link
 * on a bare domain. A book-style solution has none: they are removed, with any paragraph left empty.
 */
export function stripCitations(text: string) {
  return text
    .replace(/\s*\(\s*\[[^\]]*\]\(\s*https?:[^)]*\)\s*\)/g, "")
    .replace(/\s*\[[^\]]*\]\(\s*https?:[^)]*\)/g, "")
    .replace(/\s*<a\b[^>]*>\s*[\w.-]+\.[a-z]{2,}\s*<\/a>/gi, "")
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<p>\s*(\(\s*\))?\s*<\/p>/g, "");
}

/** What is saved: HTML sanitized, plain text kept as written, and nothing (an empty editor) → null. */
export function cleanSolution(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  if (!isRichHtml(text)) return text;
  const clean = sanitizeNoteHtml(text);
  return htmlToPlainText(clean).trim() ? clean : null;
}
