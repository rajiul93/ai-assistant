import { formulaSpan, hasMath, replaceFormulaSpans, textToFormulaHtml } from "@/lib/math";

/**
 * Note content comes from the Quill editor or from the AI, so it is untrusted HTML. Before it is
 * saved, everything outside a small allowlist of text-formatting tags is removed — no images,
 * media, scripts, styles or event handlers. The result is only ever rendered through Quill.
 */

const allowedTags = new Set(["p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "pre", "code", "a", "span", "div", "table", "thead", "tbody", "tr", "td", "th"]);
// Elements whose whole content must go, not just the tags.
const droppedBlocks = /<(script|style|iframe|object|embed|svg|math|template|noscript|video|audio|picture|canvas)\b[\s\S]*?<\/\1\s*>/gi;
const qlClass = /^(ql-[a-z0-9-]+)( ql-[a-z0-9-]+)*$/;

function attribute(attrs: string, name: string) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : null;
}

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * `$…$` typed or written by the AI inside the text of stored HTML → Quill formula elements, so
 * math always ends up in the one stored form (see lib/math).
 */
function dollarsToFormulas(html: string) {
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<") || !part.includes("$")) return part;
    const text = part.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    return hasMath(text) ? textToFormulaHtml(text) : part;
  }).join("");
}

export function sanitizeNoteHtml(html: string) {
  // Math keeps only its LaTeX (the drawn KaTeX markup inside is rebuilt whenever it is shown).
  const withFormulas = dollarsToFormulas(replaceFormulaSpans(html, (latex) => (latex.trim() ? formulaSpan(latex.trim().slice(0, 2000)) : "")));
  return withFormulas
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(droppedBlocks, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (tag, rawName: string, attrs: string) => {
      const name = rawName.toLowerCase();
      if (!allowedTags.has(name)) return "";
      if (tag.startsWith("</")) return `</${name}>`;
      const kept: string[] = [];
      const cls = attribute(attrs, "class");
      if (cls && qlClass.test(cls.trim())) kept.push(`class="${cls.trim()}"`);
      // Quill 2 marks bullet vs numbered items with data-list on <li>.
      const list = name === "li" ? attribute(attrs, "data-list") : null;
      if (list && /^(bullet|ordered|checked|unchecked)$/.test(list)) kept.push(`data-list="${list}"`);
      // Quill 2 ties each table cell to its row with data-row.
      const row = name === "td" ? attribute(attrs, "data-row") : null;
      if (row && /^[a-z0-9-]{1,24}$/i.test(row)) kept.push(`data-row="${row}"`);
      // A formula's LaTeX (lib/math) — only ever drawn by KaTeX, never inserted as HTML.
      if (name === "span" && cls?.trim() === "ql-formula") {
        const latex = attribute(attrs, "data-value");
        if (latex) kept.push(`data-value="${escapeAttr(latex)}"`);
      }
      if (name === "a") {
        const href = attribute(attrs, "href")?.trim() ?? "";
        if (/^(https?:|mailto:)/i.test(href)) kept.push(`href="${escapeAttr(href)}"`, 'rel="noopener noreferrer"', 'target="_blank"');
      }
      return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""}>`;
    })
    .trim()
    .slice(0, 200_000);
}

/** Readable plain text for search and list previews. */
export function htmlToPlainText(html: string) {
  // Formulas read back as `$…$`, the plain-text form of math.
  return replaceFormulaSpans(html, (latex) => (latex ? `$${latex}$` : ""))
    .replace(/<\/t[dh]>\s*(?=<t[dh]\b)/gi, " | ")
    .replace(/<(br|\/p|\/h[1-3]|\/li|\/blockquote|\/pre|\/div|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Rich text (Quill HTML) vs. plain text written before an editor was used, or by the assistant. */
export function isRichHtml(text: string) {
  return /<(p|h[1-6]|ul|ol|li|strong|em|blockquote|table)\b/i.test(text);
}

/** Anything → sanitized editor HTML (plain lines become paragraphs), or null when it has no text. */
export function toRichHtml(text: string | null | undefined) {
  if (!text?.trim()) return null;
  const html = isRichHtml(text)
    ? text
    : text.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line) => `<p>${textToFormulaHtml(line)}</p>`).join("");
  const clean = sanitizeNoteHtml(html);
  return htmlToPlainText(clean).trim() ? clean : null;
}

/** What to load into the editor: stored HTML as is, older plain text turned into paragraphs. */
export function toEditorHtml(text: string | null | undefined) {
  if (!text) return "";
  return isRichHtml(text) ? text : text.split("\n").map((line) => `<p>${textToFormulaHtml(line) || "<br>"}</p>`).join("");
}

/** Shared instructions so AI-written notes fit the editor: simple HTML, no images. */
export const noteWritingRules = `লেখা হবে Quill editor-এ বসানোর মতো সরল HTML: শুধু <h2>, <h3>, <p>, <strong>, <em>, <ul>/<ol> + <li>, <blockquote>, <code>, আর তুলনা/সাল-ঘটনা/তালিকার মতো তথ্যে সরল টেবিল <table><tbody><tr><td>…</td></tr></tbody></table> (প্রথম সারি শিরোনাম; শুধু <td>, ঘরের ভেতরে শুধু লেখা — tag নয়; কথোপকথনে টেবিল থাকলে note-এও টেবিলই রাখবে)। গণিতের প্রতিটি রাশি বইয়ের মতো দেখাতে LaTeX দিয়ে <span class="ql-formula" data-value="\\frac{1}{2}"></span> আকারে লিখবে (যেমন x² → data-value="x^{2}", √2 → "\\sqrt{2}"); কখনো 1/2 বা x^2 সরাসরি লেখায় নয়। কোনো ছবি, style, markdown (# বা **) বা \`\`\` code fence নয়। পড়ার উপযোগী, গোছানো study note — মূল ধারণা, ছোট ব্যাখ্যা, উদাহরণ, মনে রাখার পয়েন্ট। নিশ্চিত না হলে বানিয়ে লিখবে না।`;
