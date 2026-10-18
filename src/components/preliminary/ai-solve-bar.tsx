"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/user-error";
import { restoreSolutions } from "@/server/actions/preliminary";

export type SolvedNotes = { id: string; solution: string | null; explanation: string | null };
type SolveResponse = { results: SolvedNotes[]; originals: SolvedNotes[]; error?: string };

// Four questions a call (the instructions are paid once per call), two calls at a time.
const PER_CALL = 4;
const AT_ONCE = 2;

async function solveBatch(setId: string, questionIds: string[], fill: "missing" | "all"): Promise<SolveResponse> {
  const response = await fetch("/api/preliminary/solve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId, questionIds, fill }) });
  const payload = (await response.json().catch(() => ({}))) as SolveResponse;
  if (!response.ok) throw new Error(payload.error ?? "AI দিয়ে লেখা গেল না।");
  return payload;
}

/**
 * The Question Bank's "AI দিয়ে সমাধান ও ব্যাখ্যা লেখো" for a user's own set: one click fills every
 * question that lacks a solution or an explanation; "নতুন করে" writes all of them again. Each one
 * is saved as it arrives (`onSolved`), with an undo for the whole run.
 */
export function AiSolveBar({ setId, questions, onSolved }: { setId: string; questions: SolvedNotes[]; onSolved: (notes: SolvedNotes[]) => void }) {
  const router = useRouter();
  const [run, setRun] = useState<{ done: number; total: number } | null>(null);
  const [undo, setUndo] = useState<SolvedNotes[] | null>(null);
  const unsolved = questions.filter((question) => !question.solution?.trim() || !question.explanation?.trim());

  async function start(ids: string[], fill: "missing" | "all") {
    if (!ids.length) return;
    setRun({ done: 0, total: ids.length });
    setUndo(null);
    const before: SolvedNotes[] = [];
    const batches = Array.from({ length: Math.ceil(ids.length / PER_CALL) }, (_, at) => ids.slice(at * PER_CALL, at * PER_CALL + PER_CALL));
    let next = 0;
    let done = 0;
    let stopped = false;
    // Each worker takes the next batch until none are left; the first failure stops the run.
    const worker = async () => {
      while (!stopped && next < batches.length) {
        const batch = batches[next++];
        try {
          const { results, originals } = await solveBatch(setId, batch, fill);
          if (results.length) onSolved(results);
          before.push(...originals);
        } catch (error) {
          if (!stopped) toast.error(`${errorMessage(error, "AI থেমে গেছে")} — যতটুকু হয়েছে, সেভ আছে।`);
          stopped = true;
        } finally {
          done += batch.length;
          setRun({ done, total: ids.length });
        }
      }
    };
    await Promise.all(Array.from({ length: AT_ONCE }, worker));
    setRun(null);
    if (before.length) {
      setUndo(before);
      toast.success(`${before.length}টি প্রশ্নের সমাধান ও ব্যাখ্যা AI লিখে দিয়েছে`);
    }
    router.refresh();
  }

  async function undoRun() {
    if (!undo) return;
    try {
      await restoreSolutions(setId, undo);
      onSolved(undo);
      setUndo(null);
      toast.success("আগের অবস্থায় ফেরানো হলো");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "ফেরানো গেল না।"));
    }
  }

  return <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/80 p-3">
    <button type="button" disabled={Boolean(run) || !unsolved.length} onClick={() => void start(unsolved.map((question) => question.id), "missing")} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
      <WandSparkles className="size-4" /> {unsolved.length ? `AI দিয়ে সমাধান ও ব্যাখ্যা লেখো (${unsolved.length}টি বাকি)` : "সব প্রশ্নের সমাধান ও ব্যাখ্যা আছে"}
    </button>
    {run ? <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${(run.done / run.total) * 100}%` }} /></div>
      <p className="text-xs text-violet-900">{run.done}/{run.total} — চলছে, পাতা বন্ধ করবেন না</p>
    </div> : null}
    {!run ? <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-violet-900">
      {undo ? <button type="button" onClick={() => void undoRun()} className="inline-flex items-center gap-1 font-semibold underline"><RotateCcw className="size-3.5" /> আগের অবস্থায় ফেরাও ({undo.length}টি)</button> : null}
      {questions.length ? <button type="button" onClick={() => { if (confirm(`${questions.length}টি প্রশ্নেরই সমাধান ও ব্যাখ্যা নতুন করে লিখবে? আগেরগুলো বদলে যাবে।`)) void start(questions.map((question) => question.id), "all"); }} className="underline">সবগুলো নতুন করে লেখো</button> : null}
    </div> : null}
  </div>;
}
