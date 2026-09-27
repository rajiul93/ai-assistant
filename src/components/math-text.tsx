import { Fragment } from "react";
import { renderFormulaHtml, renderLatex, splitMath } from "@/lib/math";
import { sanitizeNoteHtml } from "@/lib/note-html";
import { cn } from "@/lib/utils";

/** Plain text with `$…$` math drawn as book-style notation (titles, chat bubbles, previews). */
export function MathText({ text }: { text: string }) {
  const parts = splitMath(text);
  if (parts.length === 1 && parts[0].type === "text") return <>{text}</>;
  return <>{parts.map((part, index) => part.type === "text"
    ? <Fragment key={index}>{part.value}</Fragment>
    // KaTeX output is built from the LaTeX alone (no raw HTML is passed through).
    : <span key={index} className="math-inline" dangerouslySetInnerHTML={{ __html: renderLatex(part.value, part.display) }} />)}</>;
}

/** Stored rich text (notes, task descriptions, application details), read-only, with its formulas drawn. */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  return <div className={cn("ql-snow", className)}>
    <div className="ql-editor rich-view" dangerouslySetInnerHTML={{ __html: renderFormulaHtml(sanitizeNoteHtml(html)) }} />
  </div>;
}
