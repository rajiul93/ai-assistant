"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type Quill from "quill";
import "quill/dist/quill.snow.css";

export type QuillHandle = {
  /** Inserts HTML at the cursor (or at the end when the editor isn't focused). */
  insertHtml: (html: string) => void;
  getText: () => string;
};

// Text formatting only — "image" and "video" are deliberately absent, so they can't be inserted.
const formats = ["header", "bold", "italic", "underline", "strike", "list", "indent", "blockquote", "code-block", "code", "link"];
const toolbar = [
  [{ header: [2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block", "link"],
  ["clean"],
];

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
    getText: () => quillRef.current?.getText() ?? "",
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const container = document.createElement("div");
    host.appendChild(container);

    void import("quill").then(({ default: QuillClass }) => {
      if (cancelled) return;
      const Delta = QuillClass.import("delta") as typeof import("quill").Delta;
      const quill = new QuillClass(container, {
        theme: "snow",
        placeholder,
        formats,
        modules: {
          toolbar,
          // Dropped or pasted image files are ignored instead of embedded.
          uploader: { handler: () => {} },
          clipboard: { matchers: [["IMG", () => new Delta()]] },
        },
      });
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
