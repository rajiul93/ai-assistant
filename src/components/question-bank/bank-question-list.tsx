"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListChecks, Loader2, Pencil, Plus, RotateCcw, Sparkles, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { BookText, MathText } from "@/components/math-text";
import { SolutionNotes } from "@/components/preliminary/question-set-views";
import { BANK_OPTION_LETTERS } from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import { updateBankQuestion } from "@/server/actions/question-bank";

type BankQuestion = { id: string; text: string; options: string[]; correctIndex: number; solution: string | null; explanation: string | null; hasSolution?: boolean; hasExplanation?: boolean; editedAt?: Date | string | null };
type Draft = Omit<BankQuestion, "editedAt" | "hasSolution" | "hasExplanation">;
type BeautifyResponse = { results: Draft[]; skipped: number; originals: Draft[]; error?: string };

const PER_CALL = 4;

async function beautify(questionIds: string[], mode: "preview" | "save"): Promise<BeautifyResponse> {
  const response = await fetch("/api/question-bank/beautify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionIds, mode }) });
  const payload = (await response.json().catch(() => ({}))) as BeautifyResponse;
  if (!response.ok) throw new Error(payload.error ?? "AI দিয়ে করা গেল না।");
  return payload;
}

/** Writes solution + explanation with AI and saves them; `fill: "missing"` keeps what is already written. */
async function solve(questionIds: string[], fill: "missing" | "all"): Promise<BeautifyResponse> {
  const response = await fetch("/api/question-bank/solve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionIds, fill }) });
  const payload = (await response.json().catch(() => ({}))) as BeautifyResponse;
  if (!response.ok) throw new Error(payload.error ?? "AI দিয়ে লেখা গেল না।");
  return payload;
}

type Task = { kind: "tidy" } | { kind: "solve"; fill: "missing" | "all" };

const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-zinc-400";

/** Typing a question, its options (4 or 5), the right answer, solution and explanation — with a book-style preview. */
function QuestionEditor({ initial, aiFilled, onSave, onCancel }: { initial: Draft; aiFilled: boolean; onSave: (draft: Draft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const setOption = (index: number, value: string) => set({ options: draft.options.map((option, at) => (at === index ? value : option)) });
  const removeFifth = () => set({ options: draft.options.slice(0, 4), correctIndex: draft.correctIndex === 4 ? -1 : draft.correctIndex });
  const problem = !draft.text.trim() ? "প্রশ্ন লেখো" : draft.options.some((option) => !option.trim()) ? "কোনো option ফাঁকা রাখা যাবে না" : draft.correctIndex < 0 ? "সঠিক উত্তর বেছে নাও" : null;

  async function save() {
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  }

  return <div className="space-y-3">
    {aiFilled ? <p className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs text-violet-900"><Sparkles className="size-3.5" /> AI গুছিয়ে দিয়েছে — মিলিয়ে দেখে সেভ করুন।</p> : null}
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-600">প্রশ্ন</span>
      <textarea value={draft.text} onChange={(event) => set({ text: event.target.value })} rows={3} className={field} />
      {draft.text.trim() ? <span className="block rounded-lg bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-800">দেখতে: <MathText text={draft.text} book /></span> : null}
    </label>

    <div className="space-y-2">
      <span className="text-xs font-medium text-zinc-600">Option (সঠিকটার অক্ষরে চাপুন)</span>
      {draft.options.map((option, index) => {
        const right = draft.correctIndex === index;
        return <div key={index} className={cn("flex items-center gap-2 rounded-xl border px-2", right ? "border-emerald-400 bg-emerald-50" : "border-zinc-200")}>
          <button type="button" onClick={() => set({ correctIndex: index })} aria-pressed={right} aria-label={`${BANK_OPTION_LETTERS[index]} সঠিক উত্তর`} className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", right ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-emerald-100")}>
            {right ? <Check className="size-3.5" strokeWidth={3} /> : BANK_OPTION_LETTERS[index]}
          </button>
          <input value={option} onChange={(event) => setOption(index, event.target.value)} aria-label={`Option ${BANK_OPTION_LETTERS[index]}`} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {index === 4 ? <button type="button" onClick={removeFifth} aria-label="Option ঙ বাদ দাও" className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button> : null}
        </div>;
      })}
      {draft.options.length < 5 ? <button type="button" onClick={() => set({ options: [...draft.options, ""] })} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"><Plus className="size-4" /> Option ঙ যোগ করো</button> : null}
    </div>

    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-600">সমাধান (প্রতিটা ধাপ নতুন লাইনে)</span>
      <textarea value={draft.solution ?? ""} onChange={(event) => set({ solution: event.target.value })} rows={5} className={field} />
    </label>
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-600">ব্যাখ্যা</span>
      <textarea value={draft.explanation ?? ""} onChange={(event) => set({ explanation: event.target.value })} rows={3} className={field} />
    </label>
    {draft.solution?.trim() || draft.explanation?.trim() ? <div className="rounded-xl bg-zinc-50 px-3 py-2">
      <p className="mb-1 text-xs font-medium text-zinc-500">দেখতে যেমন হবে</p>
      {draft.solution?.trim() ? <BookText text={draft.solution} /> : null}
      {draft.explanation?.trim() ? <div className="mt-2 text-sky-950"><BookText text={draft.explanation} /></div> : null}
    </div> : null}
    <p className="text-xs text-zinc-500">গণিত বইয়ের মতো দেখাতে $…$ দিয়ে লিখুন, যেমন $\frac{"{1}{2}"}$, $\sqrt{"{3}"}$, $x^{"{2}"}$। 1/2, √3, x² লিখলেও সাধারণত চিনে নেয়।</p>

    <div className="flex gap-2">
      <button type="button" onClick={onCancel} disabled={saving} className="h-10 flex-1 rounded-xl text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">বাতিল</button>
      <button type="button" onClick={() => void save()} disabled={saving} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} সেভ</button>
    </div>
  </div>;
}

/** Read-only for everyone; admins also edit by hand or tidy one, some or all questions with AI. */
export function BankQuestionList({ questions: initial, canEdit }: { questions: BankQuestion[]; canEdit: boolean }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initial);
  const [editing, setEditing] = useState<{ id: string; draft: Draft; aiFilled: boolean } | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<{ done: number; total: number } | null>(null);
  const [undo, setUndo] = useState<Draft[] | null>(null);
  const busy = Boolean(run) || Boolean(thinking);

  const replace = (updated: Draft[]) => setQuestions((current) => current.map((question) => ({ ...question, ...(updated.find((item) => item.id === question.id) ?? {}) })));

  async function saveOne(draft: Draft) {
    try {
      const saved = await updateBankQuestion(draft);
      replace([saved]);
      setEditing(null);
      toast.success("সেভ হলো");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "সেভ করা গেল না।");
    }
  }

  async function aiOne(question: BankQuestion) {
    setThinking(question.id);
    try {
      const { results } = await beautify([question.id], "preview");
      if (!results[0]) { toast.error("AI এই প্রশ্নটা গুছাতে পারেনি — হাতে ঠিক করুন।"); return; }
      setEditing({ id: question.id, draft: results[0], aiFilled: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI দিয়ে করা গেল না।");
    } finally {
      setThinking(null);
    }
  }

  /** Several at once: saved straight away, a few per call, with an undo for the whole run. */
  async function aiMany(ids: string[], task: Task = { kind: "tidy" }) {
    if (!ids.length) return;
    setRun({ done: 0, total: ids.length });
    setUndo(null);
    const before: Draft[] = [];
    let skipped = 0;
    for (let start = 0; start < ids.length; start += PER_CALL) {
      const batch = ids.slice(start, start + PER_CALL);
      try {
        const result = task.kind === "solve" ? await solve(batch, task.fill) : await beautify(batch, "save");
        replace(result.results);
        before.push(...result.originals);
        skipped += result.skipped;
      } catch (error) {
        toast.error(`${error instanceof Error ? error.message : "AI থেমে গেছে"} — যতটুকু হয়েছে, সেভ আছে।`);
        break;
      } finally {
        setRun({ done: Math.min(start + batch.length, ids.length), total: ids.length });
      }
    }
    setRun(null);
    setSelecting(false);
    setPicked(new Set());
    if (before.length) { setUndo(before); toast.success(`${before.length}টি প্রশ্ন${task.kind === "solve" ? "র সমাধান ও ব্যাখ্যা AI লিখে দিয়েছে" : " AI দিয়ে গোছানো হলো"}${skipped ? ` · ${skipped}টি পারেনি` : ""}`); }
    router.refresh();
  }

  async function undoRun() {
    if (!undo) return;
    setRun({ done: 0, total: undo.length });
    for (const [index, original] of undo.entries()) {
      try { replace([await updateBankQuestion(original)]); } catch { /* the rest still go back */ }
      setRun({ done: index + 1, total: undo.length });
    }
    setRun(null);
    setUndo(null);
    toast.success("আগের অবস্থায় ফেরানো হলো");
    router.refresh();
  }

  // One click fills every question that still lacks a solution or an explanation.
  const unsolved = questions.filter((question) => !question.solution?.trim() || !question.explanation?.trim());
  const toggle = (id: string) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <div className="space-y-3">
    {canEdit ? <div className="sticky top-14 z-10 space-y-2 rounded-2xl border border-violet-200 bg-violet-50/95 p-3 backdrop-blur lg:top-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs font-semibold text-violet-900">Admin</span>
        <button type="button" disabled={busy} onClick={() => { setSelecting((value) => !value); setPicked(new Set()); }} aria-pressed={selecting} className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 transition disabled:opacity-50", selecting ? "bg-white text-violet-900 ring-violet-300" : "text-violet-900 ring-violet-200 hover:bg-white")}>{selecting ? <X className="size-4" /> : <ListChecks className="size-4" />} {selecting ? "বাছাই বাতিল" : "বাছাই করো"}</button>
        {selecting
          ? <button type="button" disabled={busy || !picked.size} onClick={() => void aiMany(questions.filter((question) => picked.has(question.id)).map((question) => question.id))} className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><Sparkles className="size-4" /> বাছাই করা {picked.size}টি AI দিয়ে গোছাও</button>
          : <button type="button" disabled={busy} onClick={() => void aiMany(questions.map((question) => question.id))} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-violet-900 ring-1 ring-violet-200 hover:bg-white disabled:opacity-50"><Sparkles className="size-4" /> সব ({questions.length}টি) AI দিয়ে গোছাও</button>}
      </div>
      {/* Solutions and explanations by AI: all missing ones in one click, or rewrite the picked ones. */}
      {selecting
        ? <button type="button" disabled={busy || !picked.size} onClick={() => void aiMany(questions.filter((question) => picked.has(question.id)).map((question) => question.id), { kind: "solve", fill: "all" })} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><WandSparkles className="size-4" /> বাছাই করা {picked.size}টির সমাধান ও ব্যাখ্যা নতুন করে লেখো</button>
        : <button type="button" disabled={busy || !unsolved.length} onClick={() => void aiMany(unsolved.map((question) => question.id), { kind: "solve", fill: "missing" })} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><WandSparkles className="size-4" /> {unsolved.length ? `AI দিয়ে সমাধান ও ব্যাখ্যা লেখো (${unsolved.length}টি বাকি)` : "সব প্রশ্নের সমাধান ও ব্যাখ্যা আছে"}</button>}
      {selecting ? <label className="flex items-center gap-2 text-xs text-violet-900"><input type="checkbox" checked={picked.size === questions.length} onChange={() => setPicked(picked.size === questions.length ? new Set() : new Set(questions.map((question) => question.id)))} className="size-4 accent-violet-700" /> সব বাছো</label> : null}
      {run ? <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${(run.done / run.total) * 100}%` }} /></div>
        <p className="text-xs text-violet-900">{run.done}/{run.total} — চলছে, পাতা বন্ধ করবেন না</p>
      </div> : null}
      {undo && !run ? <p className="flex items-center gap-2 text-xs text-violet-900">পছন্দ না হলে <button type="button" onClick={() => void undoRun()} className="inline-flex items-center gap-1 font-semibold underline"><RotateCcw className="size-3.5" /> আগের অবস্থায় ফেরাও ({undo.length}টি)</button></p> : null}
    </div> : null}

    <ol className="space-y-3">
      {questions.map((question, index) => {
        const isEditing = editing?.id === question.id;
        return <li key={question.id} className={cn("rounded-2xl border bg-white p-4", selecting && picked.has(question.id) ? "border-violet-400 ring-2 ring-violet-100" : "border-zinc-200")}>
          <div className="flex items-start gap-2">
            {selecting ? <input type="checkbox" checked={picked.has(question.id)} onChange={() => toggle(question.id)} aria-label={`প্রশ্ন ${index + 1} বাছো`} className="mt-1.5 size-4 shrink-0 accent-violet-700" /> : null}
            <p className="min-w-0 flex-1 font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span>{isEditing ? <span className="text-sm text-violet-700">Edit হচ্ছে</span> : <MathText text={question.text} book />}</p>
            {canEdit && !isEditing && !selecting ? <span className="flex shrink-0 gap-0.5">
              <button type="button" disabled={busy} onClick={() => void aiOne(question)} aria-label={`প্রশ্ন ${index + 1} AI দিয়ে গোছাও`} title="AI দিয়ে গোছাও" className="flex size-8 items-center justify-center rounded-lg text-violet-600 hover:bg-violet-50 disabled:opacity-40">{thinking === question.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}</button>
              <button type="button" disabled={busy} onClick={() => setEditing({ id: question.id, draft: { id: question.id, text: question.text, options: question.options, correctIndex: question.correctIndex, solution: question.solution, explanation: question.explanation }, aiFilled: false })} aria-label={`প্রশ্ন ${index + 1} edit করো`} title="Edit" className="flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"><Pencil className="size-4" /></button>
            </span> : null}
          </div>

          {isEditing ? <div className="mt-3"><QuestionEditor key={`${question.id}-${editing.aiFilled}`} initial={editing.draft} aiFilled={editing.aiFilled} onSave={saveOne} onCancel={() => setEditing(null)} /></div> : <>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => {
                const right = question.correctIndex === optionIndex;
                return <li key={optionIndex} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", right ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-900" : "border-zinc-200")}>
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", right ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600")}>{right ? <Check className="size-3.5" strokeWidth={3} /> : BANK_OPTION_LETTERS[optionIndex]}</span>
                  <MathText text={option} book />
                </li>;
              })}
            </ul>
            <SolutionNotes solution={question.solution} explanation={question.explanation} hasSolution={question.hasSolution ?? Boolean(question.solution)} hasExplanation={question.hasExplanation ?? Boolean(question.explanation)} />
          </>}
        </li>;
      })}
    </ol>
  </div>;
}
