import { Fragment } from "react";
import { renderFormulaHtml, renderLatex, splitMath } from "@/lib/math";
import { sanitizeNoteHtml } from "@/lib/note-html";
import { cn } from "@/lib/utils";

/** Text with `<u>…</u>` (an underlined word in a question, as printed in the book) drawn underlined. */
function Underlined({ text }: { text: string }) {
  if (!text.includes("<u>")) return <>{text}</>;
  return <>{text.split(/<u>([\s\S]*?)<\/u>/g).map((piece, index) => (index % 2 ? <u key={index} className="underline decoration-2 underline-offset-4">{piece}</u> : <Fragment key={index}>{piece}</Fragment>))}</>;
}

/** Plain text with `$…$` math drawn as book-style notation (titles, chat bubbles, previews), and `<u>…</u>` underlined. */
export function MathText({ text }: { text: string }) {
  const parts = splitMath(text);
  if (parts.length === 1 && parts[0].type === "text") return <Underlined text={text} />;
  return <>{parts.map((part, index) => part.type === "text"
    ? <Underlined key={index} text={part.value} />
    // KaTeX output is built from the LaTeX alone (no raw HTML is passed through).
    : <span key={index} className="math-inline" dangerouslySetInnerHTML={{ __html: renderLatex(part.value, part.display) }} />)}</>;
}

/** Stored rich text (notes, task descriptions, application details), read-only, with its formulas drawn. */
export function RichHtml({ html, className }: { html: string; className?: string }) {
  return <div className={cn("ql-snow", className)}>
    <div className="ql-editor rich-view" dangerouslySetInnerHTML={{ __html: renderFormulaHtml(sanitizeNoteHtml(html)) }} />
  </div>;
}
