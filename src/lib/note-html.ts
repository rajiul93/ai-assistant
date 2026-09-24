/**
 * Note content comes from the Quill editor or from the AI, so it is untrusted HTML. Before it is
 * saved, everything outside a small allowlist of text-formatting tags is removed — no images,
 * media, scripts, styles or event handlers. The result is only ever rendered through Quill.
 */

const allowedTags = new Set(["p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "pre", "code", "a", "span", "div"]);
// Elements whose whole content must go, not just the tags.
const droppedBlocks = /<(script|style|iframe|object|embed|svg|math|template|noscript|video|audio|picture|canvas)\b[\s\S]*?<\/\1\s*>/gi;
const qlClass = /^(ql-[a-z0-9-]+)( ql-[a-z0-9-]+)*$/;

function attribute(attrs: string, name: string) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : null;
}

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function sanitizeNoteHtml(html: string) {
  return html
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
  return html
    .replace(/<(br|\/p|\/h[1-3]|\/li|\/blockquote|\/pre|\/div)\s*\/?>/gi, "\n")
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

/** Shared instructions so AI-written notes fit the editor: simple HTML, no images. */
export const noteWritingRules = `লেখা হবে Quill editor-এ বসানোর মতো সরল HTML: শুধু <h2>, <h3>, <p>, <strong>, <em>, <ul>/<ol> + <li>, <blockquote>, <code>। কোনো ছবি, table, style, markdown (# বা **) বা \`\`\` code fence নয়। পড়ার উপযোগী, গোছানো study note — মূল ধারণা, ছোট ব্যাখ্যা, উদাহরণ, মনে রাখার পয়েন্ট। নিশ্চিত না হলে বানিয়ে লিখবে না।`;
