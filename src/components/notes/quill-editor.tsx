"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type Quill from "quill";
import katex from "katex";
import "quill/dist/quill.snow.css";
import { renderLatex, splitMath } from "@/lib/math";

export type QuillHandle = {
  /** Inserts HTML at the cursor (or at the end when the editor isn't focused). */
  insertHtml: (html: string) => void;
  /**
   * Inserts plain text (dictation, text read from a photo) at the cursor or the end, with `$…$`
   * as formulas. It is kept apart from what is already there: after a space, or on a line of its own.
   */
  insertText: (text: string, onNewLine?: boolean) => void;
  getText: () => string;
  /** The editor's HTML as it is now. */
  getHtml: () => string;
  /** Replaces the whole note (an AI rewrite, or undoing one) — saved like typing. */
  setHtml: (html: string) => void;
};

// Text formatting only — "image" and "video" are deliberately absent, so they can't be inserted.
// "formula" is math written in LaTeX and drawn like a book (a stacked ½, a raised x²); see lib/math.
// Tables (Quill 2's table module; the first row reads as the heading row) are for comparisons.
const formats = ["header", "bold", "italic", "underline", "strike", "list", "indent", "blockquote", "code-block", "code", "link", "formula", "table", "table-row", "table-body", "table-container"];
// H2/H3 are buttons rather than a dropdown so the toolbar can scroll sideways on phones.
const toolbar = [
  [{ header: 2 }, { header: 3 }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block", "link", "formula"],
  ["table"],
  ["clean"],
];

// The toolbar's table icon, in the snow theme's stroke style. Only "insert" (owner, 2026-10-16):
// separate row/column/delete buttons were more confusing than useful.
const svg = (body: string) => `<svg viewBox="0 0 18 18"><g class="ql-stroke" fill="none" stroke-width="1.4" stroke-linecap="round">${body}</g></svg>`;
const tableIcons: Record<string, string> = {
  table: svg('<rect x="2.5" y="3" width="13" height="12" rx="1.5"/><line x1="2.5" y1="7" x2="15.5" y2="7"/><line x1="2.5" y1="11" x2="15.5" y2="11"/><line x1="7" y1="3" x2="7" y2="15"/><line x1="11.5" y1="3" x2="11.5" y2="15"/>'),
};
const tableTitles: Record<string, string> = { table: "টেবিল বসাও (৩×৩)" };

/**
 * Quill 2 rich-text editor (react-quill doesn't support React 19, so Quill is mounted directly).
 * Uncontrolled: `initialHtml` is read once on mount — remount with a `key` to load another note.
 */
export function QuillEditor({ initialHtml, placeholder, onChange, handleRef }: {
  initialHtml: string;
  placeholder?: string;
  onChange: (html: string, text: string) => void;
  handleRef?: React.Ref<QuillHandle>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const initialRef = useRef(initialHtml);

  useImperativeHandle(handleRef, () => ({
    insertHtml: (html) => {
      const quill = quillRef.current;
      if (!quill) return;
      const at = quill.getSelection()?.index ?? Math.max(0, quill.getLength() - 1);
      quill.clipboard.dangerouslyPasteHTML(at, html, "user");
      quill.setSelection(at + quill.clipboard.convert({ html }).length(), 0, "silent");
    },
    insertText: (text, onNewLine = false) => {
      const quill = quillRef.current;
      if (!quill || !text) return;
      const range = quill.getSelection();
      let at = range?.index ?? Math.max(0, quill.getLength() - 1);
      // A formula reads back as "", so it gets a space after it like a word.
      const before = at > 0 ? quill.getText(at - 1, 1) : "\n";
      if (before !== "\n" && (onNewLine || !/\s/.test(before))) {
        quill.insertText(at, onNewLine ? "\n" : " ", "user");
        at += 1;
      }
      for (const part of splitMath(text)) {
        if (part.type === "math") quill.insertEmbed(at, "formula", part.value, "user");
        else quill.insertText(at, part.value, "user");
        at += part.type === "math" ? 1 : part.value.length;
      }
      // Moving the cursor would focus the editor and open the keyboard on a phone; only when it had focus.
      if (range) quill.setSelection(at, 0, "silent");
    },
    getText: () => quillRef.current?.getText() ?? "",
    getHtml: () => quillRef.current?.root.innerHTML ?? "",
    setHtml: (html) => {
      const quill = quillRef.current;
      if (!quill) return;
      quill.setContents(quill.clipboard.convert({ html }), "user");
      quill.setSelection(0, 0, "silent");
      quill.root.scrollTop = 0;
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const container = document.createElement("div");
    host.appendChild(container);

    // Quill's formula format draws with the global KaTeX.
    (window as Window & { katex?: typeof katex }).katex = katex;
    void import("quill").then(({ default: QuillClass }) => {
      if (cancelled) return;
      const Delta = QuillClass.import("delta") as typeof import("quill").Delta;
      const icons = QuillClass.import("ui/icons") as Record<string, string>;
      Object.assign(icons, tableIcons);
      type TableModule = { insertTable: (rows: number, columns: number) => void };
      const table = () => quill.getModule("table") as TableModule;
      const quill = new QuillClass(container, {
        theme: "snow",
        placeholder,
        formats,
        modules: {
          table: true,
          toolbar: {
            container: toolbar,
            handlers: { table: () => table().insertTable(3, 3) },
          },
          // Dropped or pasted image files are ignored instead of embedded.
          uploader: { handler: () => {} },
          clipboard: { matchers: [["IMG", () => new Delta()]] },
        },
      });
      for (const [name, title] of Object.entries(tableTitles)) host.querySelector(`.ql-${name}`)?.setAttribute("title", title);
      // The formula box shows the math as it will look while its LaTeX is typed.
      const tooltip = (quill.theme as unknown as { tooltip: { root: HTMLElement; textbox: HTMLInputElement | null } }).tooltip;
      if (tooltip.textbox) {
        const textbox = tooltip.textbox;
        textbox.dataset.formula = "\\frac{1}{2}   x^{2}   \\sqrt{3}";
        const preview = document.createElement("div");
        preview.className = "formula-preview";
        tooltip.root.appendChild(preview);
        const draw = () => {
          const latex = textbox.value.trim();
          preview.innerHTML = tooltip.root.dataset.mode === "formula" && latex ? renderLatex(latex) : "";
        };
        textbox.addEventListener("input", draw);
        // Opening, closing or switching the box (link ↔ formula) redraws it.
        new MutationObserver(draw).observe(tooltip.root, { attributes: true, attributeFilter: ["class", "data-mode"] });
      }
      quill.setContents(quill.clipboard.convert({ html: initialRef.current }), "silent");
      quill.history.clear();
      quill.on("text-change", () => onChangeRef.current(quill.root.innerHTML, quill.getText()));
      quillRef.current = quill;
    });

    return () => {
      cancelled = true;
      quillRef.current = null;
      host.innerHTML = "";
    };
  }, [placeholder]);

  return <div ref={hostRef} className="note-editor" />;
}
