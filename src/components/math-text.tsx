import { Fragment } from "react";
import { plainMathToLatex, renderFormulaHtml, renderLatex, splitMath, textToFormulaHtml } from "@/lib/math";
import { sanitizeNoteHtml } from "@/lib/note-html";
import { cn } from "@/lib/utils";

/** Text with `<u>…</u>` (an underlined word in a question, as printed in the book) drawn underlined. */
function Underlined({ text }: { text: string }) {
  if (!text.includes("<u>")) return <>{text}</>;
  return <>{text.split(/<u>([\s\S]*?)<\/u>/g).map((piece, index) => (index % 2 ? <u key={index} className="underline decoration-2 underline-offset-4">{piece}</u> : <Fragment key={index}>{piece}</Fragment>))}</>;
}

/**
 * Plain text with `$…$` math drawn as book-style notation (titles, chat bubbles, previews), and
 * `<u>…</u>` underlined. `book`: also draw plain-text math from sheets (`1/2`, `√3`, `x²`).
 */
export function MathText({ text, book = false }: { text: string; book?: boolean }) {
  const parts = splitMath(book ? plainMathToLatex(text) : text);
  if (parts.length === 1 && parts[0].type === "text") return <Underlined text={text} />;
  return <>{parts.map((part, index) => part.type === "text"
    ? <Underlined key={index} text={part.value} />
    // KaTeX output is built from the LaTeX alone (no raw HTML is passed through).
    : <span key={index} className="math-inline" dangerouslySetInnerHTML={{ __html: renderLatex(part.value, part.display) }} />)}</>;
}

/**
 * Plain text shown in the read-only Quill view (no toolbar, nothing to edit), one paragraph per
 * line, with plain-text math (`1/2`, `√3`, `x²`) drawn like a textbook. Used for solutions and
 * explanations from the Question Bank.
 */
export function BookText({ text, className }: { text: string; className?: string }) {
  // AI answers often start a line with a markdown bullet ("* ", "- "); it shows as a real bullet.
  const html = text.split(/\r?\n/).map((line) => (line.trim() ? `<p>${textToFormulaHtml(plainMathToLatex(line.replace(/^\s*[*-]\s+/, "• ")))}</p>` : "")).join("");
  return <RichHtml html={html} className={cn("book-text", className)} />;
}

/** Stored rich text (notes, task descriptions, application details), read-only, with its formulas drawn. */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  return <div className={cn("ql-snow", className)}>
    <div className="ql-editor rich-view" dangerouslySetInnerHTML={{ __html: renderFormulaHtml(sanitizeNoteHtml(html)) }} />
  </div>;
}
