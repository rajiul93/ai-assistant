/**
 * A note's HTML as its top-level blocks (a paragraph, a heading, a whole list or table…), so the AI
 * can change only some of them instead of writing the whole note again — a long note rewritten in
 * full ran past the time limit (owner, 2026-10-16).
 */

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "col", "area", "base", "embed", "source", "track", "wbr"]);

/** Splits sanitized note HTML into its top-level elements (text between them is dropped). */
export function splitBlocks(html: string): string[] {
  const blocks: string[] = [];
  // Quoted attributes may hold ">" (a formula's LaTeX: data-value="a>b").
  const tag = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/g;
  let depth = 0;
  let start = -1;
  for (const match of html.matchAll(tag)) {
    const name = match[1].toLowerCase();
    const closing = match[0].startsWith("</");
    const selfClosing = match[2] === "/" || VOID.has(name);
    const at = match.index ?? 0;
    if (closing) {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && start >= 0) { blocks.push(html.slice(start, at + match[0].length)); start = -1; }
    } else if (selfClosing) {
      // A lone <br> or the like at the top level is a block of its own.
      if (depth === 0) blocks.push(match[0]);
    } else {
      if (depth === 0) start = at;
      depth += 1;
    }
  }
  return blocks.filter((block) => block.trim());
}

export type BlockEdit = { op: "replace" | "insert_after" | "delete"; block: number; html: string };

/**
 * Applies the AI's edits to the blocks (numbered from 1; "insert_after" 0 puts it at the top).
 * Unknown block numbers are ignored; several inserts after one block keep their order.
 */
export function applyBlockEdits(blocks: string[], edits: BlockEdit[]): string {
  const replaced = new Map<number, string>();
  const removed = new Set<number>();
  const inserts = new Map<number, string[]>();
  for (const edit of edits) {
    if (edit.op === "insert_after") {
      if (edit.block < 0 || edit.block > blocks.length) continue;
      inserts.set(edit.block, [...(inserts.get(edit.block) ?? []), edit.html]);
    } else if (edit.block >= 1 && edit.block <= blocks.length) {
      if (edit.op === "delete") removed.add(edit.block);
      else replaced.set(edit.block, edit.html);
    }
  }
  const out: string[] = [...(inserts.get(0) ?? [])];
  blocks.forEach((block, index) => {
    const number = index + 1;
    if (!removed.has(number)) out.push(replaced.get(number) ?? block);
    out.push(...(inserts.get(number) ?? []));
  });
  return out.join("");
}
