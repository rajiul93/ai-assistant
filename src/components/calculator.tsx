"use client";

import { useEffect, useState } from "react";
import { Calculator as CalculatorIcon, Delete, X } from "lucide-react";
import { divisionRemainder, evaluate, formatResult, toFraction, toLatex, type AngleMode } from "@/lib/calculator";
import { renderLatex } from "@/lib/math";
import { onOpenTool } from "@/components/tool-dock";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/user-error";

type Key = { label: string; insert?: string; bracket?: Opener; action?: "clear" | "back" | "equals" | "second" | "ans"; tone?: "fn" | "op" | "eq" | "danger" };

type Opener = "(" | "[" | "{";
const CLOSER: Record<Opener, string> = { "(": ")", "[": "]", "{": "}" };

/**
 * One key per bracket pair, like phone calculators: it closes the innermost open bracket when that
 * one is of its kind and a value precedes it (2+(3 → 2+(3) ), otherwise it opens a new one.
 */
function bracketFor(expression: string, opener: Opener) {
  const stack: string[] = [];
  for (const char of expression) {
    if (char === "(" || char === "[" || char === "{") stack.push(char);
    else if (char === ")" || char === "]" || char === "}") stack.pop();
  }
  const afterValue = /[\d.)\]}πe!%]$/.test(expression);
  return stack.at(-1) === opener && afterValue ? CLOSER[opener] : opener;
}

/** Keys in rows of five. `second` swaps the trig keys for their inverses and ln/log for eˣ/10ˣ. */
function keypad(second: boolean): Key[][] {
  return [
    [{ label: "2nd", action: "second", tone: "fn" }, { label: "( )", bracket: "(", tone: "fn" }, { label: "[ ]", bracket: "[", tone: "fn" }, { label: "{ }", bracket: "{", tone: "fn" }, { label: "⌫", action: "back", tone: "fn" }],
    second
      ? [{ label: "sin⁻¹", insert: "asin(", tone: "fn" }, { label: "cos⁻¹", insert: "acos(", tone: "fn" }, { label: "tan⁻¹", insert: "atan(", tone: "fn" }, { label: "π", insert: "π", tone: "fn" }, { label: "e", insert: "e", tone: "fn" }]
      : [{ label: "sin", insert: "sin(", tone: "fn" }, { label: "cos", insert: "cos(", tone: "fn" }, { label: "tan", insert: "tan(", tone: "fn" }, { label: "π", insert: "π", tone: "fn" }, { label: "e", insert: "e", tone: "fn" }],
    [{ label: "√", insert: "√(", tone: "fn" }, { label: "x²", insert: "^2", tone: "fn" }, { label: "xʸ", insert: "^", tone: "fn" }, second ? { label: "eˣ", insert: "e^(", tone: "fn" } : { label: "ln", insert: "ln(", tone: "fn" }, second ? { label: "10ˣ", insert: "10^(", tone: "fn" } : { label: "log", insert: "log(", tone: "fn" }],
    [{ label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" }, { label: "÷", insert: "÷", tone: "op" }, { label: "AC", action: "clear", tone: "danger" }],
    [{ label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" }, { label: "×", insert: "×", tone: "op" }, { label: "%", insert: "%", tone: "op" }],
    [{ label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" }, { label: "−", insert: "−", tone: "op" }, { label: "x!", insert: "!", tone: "op" }],
    [{ label: "0", insert: "0" }, { label: ".", insert: "." }, { label: "Ans", action: "ans", tone: "fn" }, { label: "+", insert: "+", tone: "op" }, { label: "=", action: "equals", tone: "eq" }],
  ];
}

const keyClass: Record<NonNullable<Key["tone"]> | "num", string> = {
  num: "bg-white text-slate-900 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.25)]",
  fn: "bg-slate-100 text-slate-700",
  op: "bg-blue-50 text-blue-700",
  eq: "bg-linear-to-br from-[#3f6ef3] to-[#5a87f8] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]",
  danger: "bg-red-50 text-red-600",
};

type AnswerFormat = "decimal" | "fraction";
type Division = ReturnType<typeof divisionRemainder>;

/** "ভাগফল 3 · ভাগশেষ 2" for a whole-number division. */
const divisionText = (division: NonNullable<Division>) => `ভাগফল ${division.quotient} · ভাগশেষ ${division.remainder}`;

/** A result in the chosen form, as keypad text (3÷4 for a fraction, so it can be reused) and as LaTeX. */
function answer(value: number, format: AnswerFormat) {
  const fraction = format === "fraction" ? toFraction(value) : null;
  if (fraction) {
    const [top, bottom] = fraction;
    return { text: `${top < 0 ? "−" : ""}${Math.abs(top)}÷${bottom}`, latex: `${top < 0 ? "-" : ""}\\dfrac{${Math.abs(top)}}{${bottom}}` };
  }
  const text = formatResult(value);
  return { text, latex: text.replace("∞", "\\infty ").replace(/e([+-]\d+)$/, "\\times 10^{$1}") };
}

/** KaTeX output (built from LaTeX alone, no user HTML), falling back to the plain text. */
function Formula({ latex, text, className }: { latex: string | null; text: string; className?: string }) {
  if (!latex) return <span className={className}>{text}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderLatex(latex) }} />;
}

/** Typed keys map to the same inserts as the keypad. */
const typedKeys: Record<string, string> = { "*": "×", "/": "÷", "-": "−", x: "×", X: "×" };

/**
 * Opened from the tools button above the AI assistant's (ToolDock): a full-screen scientific
 * calculator: trig (degrees/radians, inverses), √, powers, π, e, ln/log, factorial and percent.
 * The result shows live while typing; a physical keyboard works too.
 */
export function Calculator() {
  const [open, setOpen] = useState(false);
  // Opened from the tools button (ToolDock).
  useEffect(() => onOpenTool("calculator", () => setOpen(true)), []);
  const [expression, setExpression] = useState("");
  const [mode, setMode] = useState<AngleMode>("deg");
  const [second, setSecond] = useState(false);
  const [ans, setAns] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<AnswerFormat>("decimal");
  const [history, setHistory] = useState<Array<{ expression: string; result: ReturnType<typeof answer>; division: Division }>>([]);
  // The ভাগশেষ of the division just worked out, kept while its answer is on the display.
  const [lastDivision, setLastDivision] = useState<Division>(null);

  let preview: ReturnType<typeof answer> | null = null;
  try { preview = expression ? answer(evaluate(expression, mode), format) : null; } catch { preview = null; }
  const division = (expression ? divisionRemainder(expression, mode) : null) ?? (expression && expression === ans ? lastDivision : null);

  const insert = (text: string) => { setError(null); setExpression((current) => current + text); };
  const equals = () => {
    if (!expression) return;
    try {
      const result = answer(evaluate(expression, mode), format);
      const split = divisionRemainder(expression, mode);
      setHistory((list) => [{ expression, result, division: split }, ...list].slice(0, 3));
      setLastDivision(split);
      setAns(result.text);
      setExpression(result.text);
      setError(null);
    } catch (problem) {
      setError(errorMessage(problem, "হিসাব হলো না"));
    }
  };

  function press(key: Key) {
    if (key.insert) return insert(key.insert);
    if (key.bracket) return insert(bracketFor(expression, key.bracket));
    switch (key.action) {
      case "clear": setExpression(""); setError(null); return;
      case "back": setExpression((current) => current.replace(/(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|ln\(|√\(|.)$/, "")); setError(null); return;
      case "equals": return equals();
      case "second": return setSecond((value) => !value);
      case "ans": if (ans) insert(ans); return;
    }
  }

  // A plugged-in or desktop keyboard: digits, operators, Enter, Backspace, Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key;
      if (key === "Escape") { setOpen(false); return; }
      if (key === "Enter" || key === "=") { event.preventDefault(); equals(); return; }
      if (key === "Backspace") { event.preventDefault(); press({ label: "⌫", action: "back" }); return; }
      if (key === "Delete") { setExpression(""); return; }
      if (/^[0-9.()[\]{}+^%!]$/.test(key)) { event.preventDefault(); insert(key); return; }
      if (typedKeys[key]) { event.preventDefault(); insert(typedKeys[key]); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return <>

    {open ? <div role="dialog" aria-modal="true" aria-label="ক্যালকুলেটর" className="assistant-panel-in fixed inset-0 z-[60] flex flex-col bg-[#f3f3ef] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(44rem,calc(100dvh-3rem))] sm:w-96 sm:overflow-hidden sm:rounded-3xl sm:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] sm:ring-1 sm:ring-slate-200">
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-linear-to-br from-[#3f6ef3] to-[#7f9cfa] text-white"><CalculatorIcon className="size-5" /></span>
        <h2 className="flex-1 text-[17px] font-bold text-slate-900">ক্যালকুলেটর</h2>
        {/* Degree ⇄ radian for sin/cos/tan; tapping the badge switches it. */}
        <button type="button" onClick={() => setMode((value) => (value === "deg" ? "rad" : "deg"))} aria-label="Degree বা Radian বদলাও" className="h-8 rounded-full bg-white px-3 text-[12px] font-bold text-blue-700 ring-1 ring-slate-200 active:scale-95">{mode === "deg" ? "DEG" : "RAD"}</button>
        <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="flex size-10 items-center justify-center rounded-full text-slate-500 hover:bg-white"><X className="size-5" /></button>
      </header>

      {/* Display: earlier results (tap to reuse), the expression, and the answer as you type. */}
      <section className="mx-4 flex min-h-0 flex-1 flex-col justify-end rounded-3xl bg-white px-4 py-3 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
        <ul className="min-h-0 space-y-0.5 overflow-hidden text-right">
          {history.slice().reverse().map((entry, index) => <li key={`${index}-${entry.expression}`}>
            <button type="button" onClick={() => insert(entry.result.text)} className="max-w-full overflow-hidden text-[14px] text-slate-400 hover:text-blue-700">
              <Formula latex={toLatex(entry.expression)} text={entry.expression} /> = <Formula latex={entry.result.latex} text={entry.result.text} className="font-semibold text-slate-500" />
              {entry.division ? <span className="ml-1 text-[12px] text-slate-400">({divisionText(entry.division)})</span> : null}
            </button>
          </li>)}
        </ul>
        {/* The expression drawn like a book (stacked fractions, raised powers, √ over its contents). */}
        <div className="-mx-1 mt-1 flex justify-end overflow-x-auto px-1 py-1 text-[clamp(24px,7.4vw,32px)] text-slate-900 [scrollbar-width:none]" aria-live="polite" aria-label={expression || "0"}>
          {expression ? <Formula latex={toLatex(expression)} text={expression} className="whitespace-nowrap" /> : <span className="text-slate-300">0</span>}
        </div>
        <div className="flex min-h-12 items-center justify-end gap-2">
          {/* Answer as দশমিক (0.75) or as a fraction, লব/হর (3/4). */}
          <div role="radiogroup" aria-label="উত্তরের ধরন" className="mr-auto flex shrink-0 rounded-full bg-slate-100 p-0.5 text-[12px] font-semibold">
            {([["decimal", "দশমিক"], ["fraction", "লব/হর"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={format === id} onClick={() => setFormat(id)} className={cn("h-7 rounded-full px-2.5 transition", format === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>{label}</button>
            ))}
          </div>
          {error
            ? <p className="text-right text-[13px] text-red-600">{error}</p>
            : preview && preview.text !== expression ? <p className="min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap py-1 text-[18px] text-slate-500 [scrollbar-width:none]">= <Formula latex={preview.latex} text={preview.text} /></p> : null}
        </div>
        {/* Whole-number division: the school answer too (17÷5 → ভাগফল 3, ভাগশেষ 2). */}
        {division && !error ? <p className="-mt-1 flex justify-end gap-1.5 text-[13px] font-semibold">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">ভাগফল {division.quotient}</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">ভাগশেষ {division.remainder}</span>
        </p> : null}
      </section>

      <div className="grid shrink-0 grid-cols-5 gap-2 p-4">
        {keypad(second).flat().map((key) => <button
          key={key.label}
          type="button"
          onClick={() => press(key)}
          aria-pressed={key.action === "second" ? second : undefined}
          className={cn(
            "flex h-[clamp(44px,7.2dvh,58px)] items-center justify-center rounded-2xl text-[17px] font-semibold transition active:scale-95",
            keyClass[key.tone ?? "num"],
            key.action === "second" && second && "bg-blue-600 text-white",
          )}
        >{key.action === "back" ? <Delete className="size-5" aria-label="মুছুন" /> : key.label}</button>)}
      </div>
    </div> : null}
  </>;
}
