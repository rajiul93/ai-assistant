"use client";

import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import "highlight.js/styles/github-dark.min.css";

/** The plain text inside highlighted code (rehype-highlight wraps tokens in spans). */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function CodeBlock({ language, children }: { language: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(children).replace(/\n$/, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the user can still select the text */ }
  };
  return <div className="my-2 overflow-hidden rounded-xl border border-zinc-800 bg-[#0d1117] text-zinc-100">
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-zinc-400">
      <span className="font-mono">{language || "code"}</span>
      <button type="button" onClick={() => void copy()} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition hover:bg-white/10 hover:text-white">
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? "Copied" : "Copy"}
      </button>
    </div>
    <pre className="overflow-x-auto p-3 text-[12.5px] leading-relaxed"><code className="hljs bg-transparent! p-0!">{children}</code></pre>
  </div>;
}

const components: Components = {
  // Fenced blocks arrive as <pre><code class="language-x">; the <pre> is drawn by CodeBlock.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const language = /language-([\w+#-]+)/.exec(className ?? "")?.[1];
    const block = Boolean(language) || textOf(children).includes("\n");
    if (block) return <CodeBlock language={language ?? ""}>{children}</CodeBlock>;
    return <code className="rounded-md bg-zinc-200/70 px-1 py-0.5 font-mono text-[0.85em] text-zinc-900">{children}</code>;
  },
  h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1.5 text-[15px] font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2.5 mb-1 font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-zinc-300 pl-3 text-zinc-600">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline underline-offset-2">{children}</a>,
  hr: () => <hr className="my-3 border-zinc-200" />,
  table: ({ children }) => <div className="my-2 overflow-x-auto rounded-lg border border-zinc-200"><table className="w-full text-left text-[13px]">{children}</table></div>,
  th: ({ children }) => <th className="border-b border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-zinc-100 px-2.5 py-1.5 align-top">{children}</td>,
};

/**
 * Assistant replies rendered like ChatGPT: headings, lists, tables and highlighted code with a copy
 * button. Raw HTML in the text is not rendered, so a reply can't inject markup.
 */
export function ChatMarkdown({ text }: { text: string }) {
  return <div className="min-w-0 wrap-break-word">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]} components={components}>{text}</ReactMarkdown>
  </div>;
}
