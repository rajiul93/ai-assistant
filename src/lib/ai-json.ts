/**
 * AI answers come as JSON, and the model often writes LaTeX with one backslash: "\frac{1}{2}".
 * JSON reads "\f" as a form feed (the text becomes "rac{1}{2}"), "\t" in "\times" as a tab, and
 * "\s" of "\sqrt" is no JSON escape at all, so the whole answer fails to parse. These helpers read
 * such a backslash as the LaTeX it was meant to be.
 */

/** LaTeX commands that start like a JSON escape (\b \f \n \r \t); \b and \f are never wanted in text. */
const LATEX_AFTER_ESCAPE: Record<string, RegExp> = {
  b: /^b[a-zA-Z]/,
  f: /^f[a-zA-Z]/,
  t: /^t(?:imes|heta|ext|extbf|frac|an|anh|o|riangle|au|ilde|hinspace|op)(?![a-zA-Z])/,
  r: /^r(?:ight|ightarrow|ho|angle|m|oot|brace|bracket|floor|ceil)(?![a-zA-Z])/,
  n: /^n(?:eq|e|abla|otin|eg|leq|geq|mid)(?![a-zA-Z])/,
};

/**
 * What the backslash at `at` in raw JSON text is: a real JSON escape, LaTeX to keep as a
 * backslash, or "wait" when not enough has streamed in yet to tell.
 */
export function backslashAt(raw: string, at: number, complete = true): "escape" | "latex" | "wait" {
  const next = raw[at + 1];
  if (next === undefined) return complete ? "latex" : "wait";
  if (next === "\\" || next === '"' || next === "/") return "escape";
  if (next === "u") {
    const hex = raw.slice(at + 2, at + 6);
    if (/^[0-9a-fA-F]{4}$/.test(hex)) return "escape";
    // "\underline", "\uparrow": not hex, so LaTeX (unless more is still coming).
    return !complete && hex.length < 4 && /^[0-9a-fA-F]*$/.test(hex) ? "wait" : "latex";
  }
  const pattern = LATEX_AFTER_ESCAPE[next];
  if (!pattern) return "latex";
  const tail = raw.slice(at + 1, at + 14);
  if (!complete && /^[a-zA-Z]*$/.test(tail) && tail.length < 13) return "wait";
  return pattern.test(tail) ? "latex" : "escape";
}

/** Raw JSON from the AI with LaTeX backslashes doubled, so JSON.parse keeps them. */
export function repairLatexInJson(raw: string): string {
  let out = "";
  for (let at = 0; at < raw.length; at++) {
    const char = raw[at];
    if (char !== "\\") { out += char; continue; }
    if (backslashAt(raw, at) === "latex") { out += "\\\\"; continue; }
    // A real escape: copy it whole so its second character isn't read as a new backslash.
    out += char + (raw[at + 1] ?? "");
    at++;
  }
  return out;
}
