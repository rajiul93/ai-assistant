"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, Trophy, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { canPronounce, pronounce } from "@/lib/pronounce";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { EXAM_TYPES, matchCorrect, PASS_PERCENT, spellingMatches, type ExamType, type MatchItem, type SpellItem } from "@/lib/vocabulary/exam";
import { finishVocabExam } from "@/server/actions/vocabulary";

/** A ready exam: drag-and-drop screens (each with its answers shuffled), or spelling questions. */
export type ExamPlan =
  | { type: Exclude<ExamType, "SPELLING">; revision: boolean; screens: Array<{ items: MatchItem[]; pool: string[] }> }
  | { type: "SPELLING"; revision: boolean; spelling: SpellItem[] };

type Result = { key: string; correct: boolean; prompt: string; answer: string };

/**
 * One drag-and-drop screen: each prompt has an empty slot; drag an answer onto it (a finger or a
 * mouse), or tap an answer and then a slot. Tapping a filled slot sends its answer back.
 */
function MatchScreen({ items, pool, onDone }: { items: MatchItem[]; pool: string[]; onDone: (results: Result[]) => void }) {
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ chip: number; x: number; y: number } | null>(null);
  const [checked, setChecked] = useState(false);
  const press = useRef<{ chip: number; x: number; y: number; moved: boolean } | null>(null);
  const used = new Set(Object.values(placed));
  const full = items.every((_, slot) => placed[slot] !== undefined);
  const correct = (slot: number) => matchCorrect(placed[slot] === undefined ? undefined : pool[placed[slot]], items[slot].answer);

  function place(slot: number, chip: number) {
    setPlaced((current) => {
      const next = { ...current };
      for (const [other, value] of Object.entries(next)) if (value === chip) delete next[Number(other)];
      next[slot] = chip;
      return next;
    });
    setPicked(null);
  }

  function release(event: React.PointerEvent) {
    const from = press.current;
    press.current = null;
    setGhost(null);
    if (!from) return;
    if (!from.moved) { setPicked((current) => (current === from.chip ? null : from.chip)); return; }
    const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-slot]");
    if (slot) place(Number(slot.dataset.slot), from.chip);
  }

  return <div className="space-y-4">
    <ol className="space-y-2">
      {items.map((item, slot) => {
        const chip = placed[slot];
        return <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-stretch gap-2">
          <div className="flex min-w-0 flex-col justify-center rounded-2xl bg-white px-3 py-2 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.2)]">
            <span className="text-[16px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]">{item.prompt}</span>
            <span className="text-[11px] font-semibold text-blue-600">{item.label}</span>
          </div>
          <button type="button" data-slot={slot} disabled={checked}
            onClick={() => { if (picked !== null) place(slot, picked); else if (chip !== undefined) setPlaced((current) => { const next = { ...current }; delete next[slot]; return next; }); }}
            className={cn("flex min-h-14 min-w-0 items-center justify-center rounded-2xl border-2 px-2 py-1.5 text-center text-[14.5px] font-semibold transition",
              checked ? (correct(slot) ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900")
                : chip !== undefined ? "border-blue-300 bg-blue-50 text-slate-900" : picked !== null ? "border-dashed border-blue-400 bg-blue-50/50 text-blue-500" : "border-dashed border-slate-300 bg-slate-50 text-slate-400")}>
            <span className="[overflow-wrap:anywhere]">
              {chip !== undefined ? pool[chip] : picked !== null ? "এখানে বসাও" : "এখানে টেনে আনো"}
              {checked && !correct(slot) ? <span className="mt-0.5 block text-[12px] font-bold text-emerald-700">ঠিক: {item.answer}</span> : null}
            </span>
          </button>
        </li>;
      })}
    </ol>

    {!checked ? <div className="flex flex-wrap justify-center gap-2 rounded-3xl bg-slate-100/80 p-3">
      {pool.map((answer, chip) => used.has(chip) ? null : <button key={chip} type="button"
        onPointerDown={(event) => { press.current = { chip, x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => {
          const from = press.current;
          if (!from) return;
          if (!from.moved && Math.hypot(event.clientX - from.x, event.clientY - from.y) < 6) return;
          from.moved = true;
          setGhost({ chip, x: event.clientX, y: event.clientY });
        }}
        onPointerUp={release}
        onPointerCancel={() => { press.current = null; setGhost(null); }}
        className={cn("max-w-full touch-none select-none rounded-2xl px-3.5 py-2 text-[14.5px] font-semibold shadow-[0_4px_12px_-6px_rgba(15,23,42,0.35)] ring-1 transition [overflow-wrap:anywhere]",
          picked === chip ? "bg-blue-600 text-white ring-blue-600" : ghost?.chip === chip ? "bg-white text-slate-400 opacity-50 ring-slate-200" : "cursor-grab bg-white text-slate-800 ring-slate-200")}>
        {answer}
      </button>)}
      {used.size === pool.length ? <p className="py-1 text-[13px] text-slate-500">সব বসানো হয়েছে</p> : null}
    </div> : null}

    {ghost ? <div aria-hidden className="pointer-events-none fixed z-[70] max-w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-blue-600 px-3.5 py-2 text-[14.5px] font-semibold text-white shadow-xl" style={{ left: ghost.x, top: ghost.y }}>{pool[ghost.chip]}</div> : null}

    {checked
      ? <button type="button" onClick={() => onDone(items.map((item, slot) => ({ key: item.key, correct: correct(slot), prompt: item.prompt, answer: item.answer })))} className="h-12 w-full rounded-2xl bg-slate-900 text-[15px] font-semibold text-white">পরের ধাপ</button>
      : <button type="button" onClick={() => setChecked(true)} disabled={!full} className="h-12 w-full rounded-2xl bg-blue-600 text-[15px] font-semibold text-white disabled:opacity-40">{full ? "মিলিয়ে দেখো" : `আরও ${items.length - Object.keys(placed).length}টা বসাও`}</button>}
  </div>;
}

/** One spelling question: the Bangla (and the base form for a verb's past), a 🔊, and a box to type in. */
function SpellQuestion({ item, onDone }: { item: SpellItem; onDone: (result: Result) => void }) {
  const [typed, setTyped] = useState("");
  const [shown, setShown] = useState<boolean | null>(null);
  const say = () => (canPronounce() ? pronounce(item.answer) : toast.error("এই browser-এ উচ্চারণ শোনা যায় না।"));

  return <form onSubmit={(event) => { event.preventDefault(); if (shown === null) { if (typed.trim()) setShown(spellingMatches(typed, item.answer)); } else onDone({ key: item.key, correct: shown, prompt: item.prompt, answer: item.answer }); }} className="space-y-4">
    <div className="rounded-3xl bg-white p-5 text-center shadow-[0_6px_24px_-14px_rgba(15,23,42,0.25)]">
      <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">{item.label}</span>
      {item.given ? <p className="mt-3 text-[22px] font-bold text-slate-900">{item.given} → <span className="text-violet-600">?</span></p> : null}
      <p className={cn("text-[18px] font-semibold text-slate-700", item.given ? "mt-1" : "mt-3")}>{item.prompt}</p>
      <button type="button" onClick={say} className="mx-auto mt-3 flex h-10 items-center gap-1.5 rounded-full bg-blue-50 px-4 text-[13px] font-semibold text-blue-700"><Volume2 className="size-4" /> শুনে লেখো</button>
    </div>
    <input value={typed} onChange={(event) => setTyped(event.target.value)} disabled={shown !== null} autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} placeholder="ইংরেজি বানান লেখো" aria-label="বানান"
      className={cn("h-14 w-full rounded-2xl px-4 text-center text-[20px] font-semibold outline-none ring-2 transition", shown === null ? "bg-white ring-slate-200 focus:ring-blue-500" : shown ? "bg-emerald-50 text-emerald-800 ring-emerald-400" : "bg-rose-50 text-rose-800 ring-rose-300")} />
    {shown === false ? <p className="text-center text-[15px] text-slate-700">ঠিক বানান: <span className="font-bold text-emerald-700">{item.answer}</span></p> : shown ? <p className="text-center text-[15px] font-semibold text-emerald-700">ঠিক হয়েছে!</p> : null}
    <button type="submit" disabled={shown === null && !typed.trim()} className={cn("h-12 w-full rounded-2xl text-[15px] font-semibold text-white disabled:opacity-40", shown === null ? "bg-blue-600" : "bg-slate-900")}>{shown === null ? "যাচাই করো" : "পরেরটা"}</button>
  </form>;
}

/**
 * A full-screen exam. Answers are checked as the user goes; at the end every word answered wrong
 * goes to "ভুলগুলো" (and right ones leave it), and a set exam's score is saved for the 80% rule.
 */
export function VocabExam({ plan, onRetry, onClose }: { plan: ExamPlan; onRetry: () => void; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const title = EXAM_TYPES.find((exam) => exam.type === plan.type)?.title ?? "Exam";
  const steps = "spelling" in plan ? plan.spelling.length : plan.screens.length;
  const total = "spelling" in plan ? plan.spelling.length : plan.screens.reduce((sum, screen) => sum + screen.items.length, 0);

  async function advance(more: Result[]) {
    const all = [...results, ...more];
    setResults(all);
    if (step + 1 < steps) { setStep(step + 1); return; }
    setSaving(true);
    try {
      await finishVocabExam({ type: plan.type, revision: plan.revision, results: all.map((result) => { const [kind, entryId] = result.key.split(":"); return { kind, entryId, correct: result.correct }; }) });
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "ফল সেভ করা গেল না।"));
    } finally {
      setSaving(false);
      setFinished(true);
    }
  }

  const right = results.filter((result) => result.correct).length;
  const percent = total ? Math.round((right / total) * 100) : 0;
  const passed = percent >= PASS_PERCENT;

  return <div role="dialog" aria-modal aria-label={title} className="fixed inset-0 z-[60] flex flex-col bg-[#f3f3ef]">
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      <button type="button" onClick={onClose} aria-label="বন্ধ করো" className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-slate-900">{title}{plan.revision ? " · ভুলগুলো" : ""}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${finished ? 100 : Math.round((step / steps) * 100)}%` }} /></div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{finished ? total : results.length}/{total}</p>
    </header>

    <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-xl">
        {saving ? <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> ফল সেভ হচ্ছে…</p>
          : finished ? <div className="space-y-4">
            <div className={cn("rounded-3xl p-6 text-center text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.7)]", passed ? "bg-linear-to-br from-emerald-500 to-teal-600" : "bg-linear-to-br from-[#3f6ef3] to-[#8fa6fb]")}>
              <Trophy className="mx-auto size-9" />
              <p className="mt-2 text-[40px] font-bold leading-none tabular-nums">{percent}%</p>
              <p className="mt-1 text-sm text-white/90">{right}/{total} ঠিক{plan.revision ? "" : passed ? " — পাস!" : ` — পাস করতে ${PASS_PERCENT}% লাগবে`}</p>
            </div>
            {results.some((result) => !result.correct) ? <div className="rounded-3xl bg-white p-4 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)]">
              <p className="text-sm font-bold text-rose-700">ভুলগুলো — “ভুলগুলো”-তে রাখা হলো</p>
              <ul className="mt-2 divide-y divide-slate-100">
                {results.filter((result) => !result.correct).map((result) => <li key={result.key} className="flex items-center justify-between gap-3 py-2 text-[14.5px]">
                  <span className="min-w-0 text-slate-600 [overflow-wrap:anywhere]">{result.prompt}</span>
                  <span className="min-w-0 text-right font-bold text-emerald-700 [overflow-wrap:anywhere]">{result.answer}</span>
                </li>)}
              </ul>
            </div> : <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-700"><Check className="size-4" strokeWidth={3} /> সব ঠিক!</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onRetry} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white text-[15px] font-semibold text-slate-700 ring-1 ring-slate-200"><RotateCcw className="size-4" /> আবার দাও</button>
              <button type="button" onClick={onClose} className="h-12 rounded-2xl bg-slate-900 text-[15px] font-semibold text-white">শেষ</button>
            </div>
          </div>
          : "spelling" in plan ? <SpellQuestion key={step} item={plan.spelling[step]} onDone={(result) => void advance([result])} />
          : <>
            <p className="mb-3 text-center text-[13px] text-slate-500">নিচের উত্তর টেনে ঠিক ঘরে বসাও — বা উত্তরে চাপ দিয়ে তারপর ঘরে চাপো।</p>
            <MatchScreen key={step} items={plan.screens[step].items} pool={plan.screens[step].pool} onDone={(more) => void advance(more)} />
          </>}
      </div>
    </div>
  </div>;
}
