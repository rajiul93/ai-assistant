import katex from "katex";

/**
 * Math is stored the same way everywhere, so it looks the same wherever it is opened later:
 * - plain text (titles, chat, what the mic heard): LaTeX between dollar signs, e.g. `$\frac{1}{2}$`, `$x^{2}$`
 * - rich text (notes, task descriptions): Quill's formula element, `<span class="ql-formula" data-value="\frac{1}{2}"></span>`
 * Both are drawn with KaTeX as book-style notation (a stacked fraction, a raised power).
 */

export type MathPart = { type: "text"; value: string } | { type: "math"; value: string; display: boolean };

/**
 * `$…$` / `$$…$$` / `\(…\)` / `\[…\]`. Like pandoc, `$` must hug its content ("$x$", not "$ 5 and $"),
 * so an amount of money isn't mistaken for math.
 */
const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?=\S)((?:\\\$|[^$\n])+?)(?<=\S)\$(?!\d)/g;

export function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = [];
  let last = 0;
  for (const match of text.matchAll(MATH)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ type: "text", value: text.slice(last, at) });
    const display = match[1] !== undefined || match[2] !== undefined;
    parts.push({ type: "math", value: (match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim(), display });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

export const hasMath = (text: string) => splitMath(text).some((part) => part.type === "math");

/** KaTeX HTML for one expression; a typo shows the source in red instead of breaking the page. */
export function renderLatex(latex: string, display = false) {
  return katex.renderToString(latex, { displayMode: display, throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unescapeHtml = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The stored rich-text form of one expression. */
export const formulaSpan = (latex: string) => `<span class="ql-formula" data-value="${escapeHtml(latex)}"></span>`;

/** Plain text (one paragraph) → HTML-escaped text with `$…$` turned into formula elements. */
export function textToFormulaHtml(text: string) {
  return splitMath(text).map((part) => (part.type === "math" ? formulaSpan(part.value) : escapeHtml(part.value))).join("");
}

/**
 * Finds every `<span class="ql-formula" data-value="…">…</span>` (including the drawn KaTeX
 * markup inside, which nests more spans) and hands its LaTeX to `replace`.
 */
export function replaceFormulaSpans(html: string, replace: (latex: string) => string) {
  let out = "";
  let index = 0;
  const open = /<span\b[^>]*\bclass\s*=\s*["'][^"']*\bql-formula\b[^"']*["'][^>]*>/gi;
  for (;;) {
    open.lastIndex = index;
    const match = open.exec(html);
    if (!match) break;
    const value = /\bdata-value\s*=\s*("([^"]*)"|'([^']*)')/i.exec(match[0]);
    const latex = unescapeHtml(value?.[2] ?? value?.[3] ?? "");
    // Skip to the matching </span>, counting the spans nested inside.
    let depth = 1;
    let cursor = match.index + match[0].length;
    const tag = /<(\/?)span\b[^>]*>/gi;
    while (depth > 0) {
      tag.lastIndex = cursor;
      const next = tag.exec(html);
      if (!next) { cursor = html.length; break; }
      depth += next[1] ? -1 : 1;
      cursor = next.index + next[0].length;
    }
    out += html.slice(index, match.index) + replace(latex);
    index = cursor;
  }
  return out + html.slice(index);
}

/** Stored HTML → HTML with every formula drawn (for read-only views). */
export function renderFormulaHtml(html: string) {
  return replaceFormulaSpans(html, (latex) => (latex ? `<span class="ql-formula" data-value="${escapeHtml(latex)}">${renderLatex(latex)}</span>` : ""));
}

/* ---------- Saying math out loud ---------- */

const bnDigits = (text: string) => text.replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);

/** Reads the group after a command: `{...}` or a single character. */
function takeGroup(source: string, at: number): [string, number] {
  while (source[at] === " ") at++;
  if (source[at] !== "{") return [source[at] ?? "", at + 1];
  let depth = 0;
  for (let index = at; index < source.length; index++) {
    if (source[index] === "{") depth++;
    else if (source[index] === "}" && --depth === 0) return [source.slice(at + 1, index), index + 1];
  }
  return [source.slice(at + 1), source.length];
}

/**
 * LaTeX → words a teacher would say: \frac{1}{2} → "দুই ভাগের এক" / "one over two",
 * x^{2} → "x-এর বর্গ" / "x squared", \sqrt{2} → "দুই-এর বর্গমূল" / "root two".
 */
export function latexToSpeech(latex: string, lang: "bn" | "en"): string {
  const bn = lang === "bn";
  const say = (source: string): string => {
    let out = "";
    let at = 0;
    while (at < source.length) {
      const rest = source.slice(at);
      const command = /^\\([a-zA-Z]+)/.exec(rest);
      if (command) {
        const name = command[1];
        at += command[0].length;
        if (name === "frac" || name === "dfrac" || name === "tfrac") {
          const [top, afterTop] = takeGroup(source, at);
          const [bottom, afterBottom] = takeGroup(source, afterTop);
          at = afterBottom;
          out += bn ? ` ${say(bottom)} ভাগের ${say(top)} ` : ` ${say(top)} over ${say(bottom)} `;
        } else if (name === "sqrt") {
          const [inner, after] = takeGroup(source, at);
          at = after;
          out += bn ? ` ${say(inner)}-এর বর্গমূল ` : ` root ${say(inner)} `;
        } else {
          const words: Record<string, [string, string]> = {
            times: ["গুণ", "times"], cdot: ["গুণ", "times"], div: ["ভাগ", "divided by"], pm: ["যোগ-বিয়োগ", "plus or minus"],
            le: ["ছোট বা সমান", "less than or equal to"], leq: ["ছোট বা সমান", "less than or equal to"], ge: ["বড় বা সমান", "greater than or equal to"], geq: ["বড় বা সমান", "greater than or equal to"],
            neq: ["সমান নয়", "not equal to"], ne: ["সমান নয়", "not equal to"], pi: ["পাই", "pi"], theta: ["থিটা", "theta"], alpha: ["আলফা", "alpha"], beta: ["বিটা", "beta"],
            infty: ["অসীম", "infinity"], degree: ["ডিগ্রি", "degrees"], circ: ["ডিগ্রি", "degrees"], sin: ["সাইন", "sine"], cos: ["কস", "cos"], tan: ["ট্যান", "tan"], log: ["লগ", "log"],
          };
          out += words[name] ? ` ${words[name][bn ? 0 : 1]} ` : " ";
        }
        continue;
      }
      const char = source[at];
      if (char === "^") {
        const [power, after] = takeGroup(source, at + 1);
        at = after;
        const p = power.trim();
        out += bn
          ? p === "2" ? "-এর বর্গ " : p === "3" ? "-এর ঘন " : ` এর ${say(p)} ঘাত `
          : p === "2" ? " squared " : p === "3" ? " cubed " : ` to the power ${say(p)} `;
        continue;
      }
      if (char === "_") { const [sub, after] = takeGroup(source, at + 1); at = after; out += ` ${say(sub)} `; continue; }
      if (char === "{" || char === "}") { at++; continue; }
      const symbols: Record<string, [string, string]> = { "+": ["যোগ", "plus"], "-": ["বিয়োগ", "minus"], "=": ["সমান", "equals"], "<": ["ছোট", "less than"], ">": ["বড়", "greater than"], "/": ["ভাগ", "over"], "*": ["গুণ", "times"] };
      out += symbols[char] ? ` ${symbols[char][bn ? 0 : 1]} ` : char;
      at++;
    }
    return out;
  };
  const words = say(latex).replace(/\s+/g, " ").replace(/\s+-এর/g, "-এর").trim();
  return bn ? bnDigits(words) : words;
}

/** Every `$…$` in a sentence replaced by its spoken form. */
export function speakMath(text: string, lang: "bn" | "en") {
  return splitMath(text).map((part) => (part.type === "math" ? ` ${latexToSpeech(part.value, lang)} ` : part.value)).join("");
}
