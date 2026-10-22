"use client";

import { useEffect, useState } from "react";
import { Divide, X } from "lucide-react";
import { toBanglaDigits } from "@/lib/calendars";
import { hcfLadder, lcmLadder, parseNumbers, type Ladder } from "@/lib/lcm-hcf";
import { onOpenTool } from "@/components/tool-dock";
import { cn } from "@/lib/utils";

const bn = (value: number) => toBanglaDigits(value);

type Solved = { numbers: number[]; lcm: Ladder; hcf: Ladder };

/**
 * লসাগু / গসাগু tool (a dock shortcut, picked on /settings): the student types the numbers and gets
 * the short-division ladder drawn like the school book, to check their own working.
 */
export function LcmHcfSheet() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [solved, setSolved] = useState<Solved | null>(null);
  const [error, setError] = useState("");

  useEffect(() => onOpenTool("lcm", () => setOpen(true)), []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const solve = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const numbers = parseNumbers(input);
      setSolved({ numbers, lcm: lcmLadder(numbers), hcf: hcfLadder(numbers) });
      setError("");
    } catch (failure) {
      setSolved(null);
      setError(failure instanceof Error ? failure.message : "সংখ্যাগুলো বোঝা গেল না।");
    }
  };

  if (!open) return null;
  return <div role="dialog" aria-modal="true" aria-label="লসাগু / গসাগু" className="assistant-panel-in fixed inset-0 z-[60] flex flex-col bg-[#f3f3ef] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(44rem,calc(100dvh-3rem))] sm:w-[26rem] sm:overflow-hidden sm:rounded-3xl sm:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] sm:ring-1 sm:ring-slate-200">
    <header className="flex items-center gap-2 px-4 pb-2 pt-3">
      <span className="flex size-9 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 text-white"><Divide className="size-5" /></span>
      <h2 className="flex-1 text-[17px] font-bold text-slate-900">লসাগু / গসাগু</h2>
      <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="flex size-10 items-center justify-center rounded-full text-slate-500 hover:bg-white"><X className="size-5" /></button>
    </header>

    <form onSubmit={solve} className="mx-4 flex gap-2">
      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="যেমন: ১২, ১৮, ২৪"
        aria-label="সংখ্যাগুলো, কমা বা ফাঁকা দিয়ে আলাদা করে"
        autoFocus
        className="h-12 min-w-0 flex-1 rounded-2xl bg-white px-4 text-[17px] text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-amber-400"
      />
      <button type="submit" className="h-12 shrink-0 rounded-2xl bg-slate-900 px-5 text-[15px] font-semibold text-white active:scale-95">সমাধান</button>
    </form>
    <p className={cn("mx-5 mt-1.5 text-[12px]", error ? "text-red-600" : "text-slate-500")}>{error || "সংখ্যাগুলো কমা বা ফাঁকা দিয়ে লেখো — বাংলা বা ইংরেজি অঙ্কে।"}</p>

    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-3">
      {solved ? <>
        <LadderCard
          title="লসাগু"
          label="ল.সা.গু."
          rule="যে মৌলিক সংখ্যা অন্তত দুটো সংখ্যাকে ভাগ করে, তা দিয়ে ভাগ; যেটা ভাগ যায় না সেটা নিচে নামে।"
          ladder={solved.lcm}
          answer={solved.lcm.factors.length
            ? <>লসাগু = {solved.lcm.factors.map(bn).join(" × ")}{solved.lcm.factors.length > 1 ? <> = <b>{bn(solved.lcm.result)}</b></> : null}</>
            : <>লসাগু = <b>{bn(solved.lcm.result)}</b></>}
        />
        <LadderCard
          title="গসাগু"
          label="গ.সা.গু."
          rule="শুধু সেই মৌলিক সংখ্যা দিয়ে ভাগ, যা সবগুলো সংখ্যাকে ভাগ করে।"
          ladder={solved.hcf}
          answer={solved.hcf.factors.length
            ? <>গসাগু = {solved.hcf.factors.map(bn).join(" × ")}{solved.hcf.factors.length > 1 ? <> = <b>{bn(solved.hcf.result)}</b></> : null}</>
            : <>সবগুলোকে ভাগ করে এমন মৌলিক সংখ্যা নেই, তাই গসাগু = <b>১</b></>}
        />
        {/* For exactly two numbers the book's check holds: a × b = লসাগু × গসাগু. */}
        {solved.numbers.length === 2 ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-800 ring-1 ring-emerald-100">
          যাচাই: {bn(solved.numbers[0])} × {bn(solved.numbers[1])} = {bn(solved.numbers[0] * solved.numbers[1])} এবং লসাগু × গসাগু = {bn(solved.lcm.result)} × {bn(solved.hcf.result)} = {bn(solved.lcm.result * solved.hcf.result)} ✓
        </p> : null}
      </> : <p className="px-1 pt-6 text-center text-[14px] text-slate-400">সংখ্যা লিখে “সমাধান” চাপো — ভাগের ধাপগুলো বইয়ের মতো দেখাবে।</p>}
    </div>
  </div>;
}

/** How far each row steps right of the one above, like a hand-written ladder. */
const STEP = 14;

/**
 * One ladder drawn like the copy book: divisor, then an L-shaped bracket (a line down the left of
 * the row and under it), each row a little to the right of the one above, the leftover row last
 * with no bracket, the label beside it and the product underlined below.
 */
function LadderCard({ title, label, rule, ladder, answer }: { title: string; label: string; rule: string; ladder: Ladder; answer: React.ReactNode }) {
  return <section className="rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
    <h3 className="text-[16px] font-bold text-slate-900">{title}</h3>
    <p className="mt-0.5 text-[12px] text-slate-500">{rule}</p>
    {/* Wide rows scroll inside the card, never the page. */}
    <div className="mt-4 flex items-start gap-4 overflow-x-auto pb-1">
      <div className="shrink-0 text-[19px] leading-none tabular-nums text-slate-900">
        {ladder.steps.map((step, index) => <div key={index} className="flex items-stretch" style={{ marginLeft: index * STEP }}>
          <span className="flex w-7 items-center justify-end pr-1.5 font-semibold text-slate-900">{bn(step.divisor)}</span>
          <span className="whitespace-nowrap rounded-bl-[3px] border-b-[2.5px] border-l-[2.5px] border-slate-800 px-2.5 pb-1.5 pt-2">
            <Row numbers={step.row} previous={ladder.steps[index - 1]} />
          </span>
        </div>)}
        <div className="whitespace-nowrap px-2.5 pt-2" style={{ marginLeft: ladder.steps.length * STEP + 28 + 2.5 }}>
          <Row numbers={ladder.last} previous={ladder.steps.at(-1)} />
        </div>
      </div>
      <span className="shrink-0 pt-6 text-[17px] font-semibold text-slate-700">{label}</span>
    </div>
    <p className="mt-4 inline-block border-b-[2.5px] border-slate-800 pb-1 text-[17px] tabular-nums text-slate-900">{answer}</p>
  </section>;
}

/** A row of the ladder; numbers the previous prime didn't divide (they came down as they were) are grey. */
function Row({ numbers, previous }: { numbers: number[]; previous?: { divisor: number; row: number[] } }) {
  return <>{numbers.map((n, i) => {
    const carried = previous ? previous.row[i] % previous.divisor !== 0 : false;
    return <span key={i} className={carried ? "text-slate-400" : undefined}>{bn(n)}{i < numbers.length - 1 ? ", " : ""}</span>;
  })}</>;
}
