"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, ClipboardCheck, Pause, Play, RotateCcw, Timer, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math-text";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/dayjs";
import { OPTION_LETTERS, statusInfo } from "@/lib/preliminary";
import { cn } from "@/lib/utils";
import { setQuestionSetStatus, submitTest, type AttemptDetail, type getQuestionSet } from "@/server/actions/preliminary";

type SetView = NonNullable<Awaited<ReturnType<typeof getQuestionSet>>>;

function Header({ set, children }: { set: SetView; children?: React.ReactNode }) {
  return <header className="space-y-2">
    <Link href={`/preliminary?status=${set.status.toLowerCase()}`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="size-4" /> Preliminary</Link>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-indigo-600">{set.subject?.name ?? "Subject নেই"} · {formatDate(set.date)}</p>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight"><MathText text={set.topicName} /></h1>
        <p className={cn("mt-1 flex items-center gap-1.5 text-xs font-medium", statusInfo[set.status].tone)}><span className={cn("size-2 rounded-full", statusInfo[set.status].dot)} />{statusInfo[set.status].label} — {statusInfo[set.status].hint}</p>
      </div>
      {children}
    </div>
  </header>;
}

function useMove(setId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const move = async (status: SetView["status"], done: string, to?: string) => {
    setPending(true);
    try { await setQuestionSetStatus(setId, status); toast.success(done); if (to) router.push(to); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't move it."); } finally { setPending(false); }
  };
  return { pending, move };
}

/** Doing / Todo / Done: every question with its right answer marked — for learning. */
export function StudyView({ set }: { set: SetView }) {
  const { pending, move } = useMove(set.id);
  // Study aid: hide the answers and check yourself, one tap per question.
  const [hidden, setHidden] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  return <div className="mx-auto max-w-3xl space-y-4">
    <Header set={set}>
      <div className="flex flex-wrap gap-2">
        {set.status === "TODO" ? <button type="button" disabled={pending} onClick={() => void move("DOING", "Doing-এ নেওয়া হলো")} className="h-10 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white disabled:opacity-50">পড়া শুরু করো</button> : null}
        {set.status === "DOING" ? <button type="button" disabled={pending} onClick={() => void move("TESTING", "Testing-এ নেওয়া হলো — উত্তর এখন লুকানো")} className="flex h-10 items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck className="size-4" /> পড়া শেষ — Test-এ নাও</button> : null}
        <button type="button" onClick={() => { setHidden((value) => !value); setRevealed(new Set()); }} className="h-10 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">{hidden ? "উত্তর দেখাও" : "উত্তর লুকাও"}</button>
      </div>
    </Header>

    <ol className="space-y-3">
      {set.questions.map((question, index) => {
        const show = !hidden || revealed.has(question.id);
        return <li key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={question.text} /></p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => {
              const right = show && question.correctIndex === optionIndex;
              return <li key={optionIndex} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", right ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-900" : "border-zinc-200")}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", right ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600")}>{right ? <Check className="size-3.5" strokeWidth={3} /> : OPTION_LETTERS[optionIndex]}</span>
                <MathText text={option} />
              </li>;
            })}
          </ul>
          {!show ? <button type="button" onClick={() => setRevealed((value) => new Set(value).add(question.id))} className="mt-2 text-xs font-medium text-indigo-600 hover:underline">উত্তর দেখো</button> : null}
        </li>;
      })}
    </ol>
    {!set.questions.length ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">এই set-এ কোনো প্রশ্ন নেই। <Link href={`/preliminary/${set.id}/edit`} className="underline">প্রশ্ন যোগ করো</Link></p> : null}
  </div>;
}

const draftKey = (setId: string) => `prep-exam-${setId}`;
/** Exam time: this many seconds for every question (20 questions → 10 minutes). */
const SECONDS_PER_QUESTION = 30;

/** The exam clock: time left, and when it last started counting (null while paused or not begun). */
type Clock = { started: boolean; leftMs: number; runningSince: number | null };
type Draft = { answers: Record<string, number>; clock?: Clock };

const clockText = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Testing: questions and options only (the page never receives the answers), against the clock —
 * 30 seconds a question, pausable. When time runs out the answers so far are submitted.
 */
export function ExamView({ set }: { set: SetView }) {
  const router = useRouter();
  const { pending, move } = useMove(set.id);
  const total = set.questions.length;
  const fullMs = total * SECONDS_PER_QUESTION * 1000;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [clock, setClock] = useState<Clock>({ started: false, leftMs: fullMs, runningSince: null });
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  // A half-done exam — answers and the clock — survives a reload (this browser only).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(set.id));
      const draft = saved ? (JSON.parse(saved) as Draft | Record<string, number>) : null;
      // Older drafts kept only the answers.
      const restored: Draft | null = draft && "answers" in draft ? (draft as Draft) : draft ? { answers: draft as Record<string, number> } : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
      if (restored) { setAnswers(restored.answers); if (restored.clock) setClock(restored.clock); }
    } catch { /* storage unavailable: start fresh */ }
    setNow(Date.now());
  }, [set.id]);
  const remember = (next: Draft) => { try { window.localStorage.setItem(draftKey(set.id), JSON.stringify(next)); } catch { /* not remembered */ } };
  const updateClock = (next: Clock) => { setClock(next); setNow(Date.now()); remember({ answers, clock: next }); };
  const choose = (questionId: string, option: number) => setAnswers((value) => {
    const next = { ...value, [questionId]: option };
    remember({ answers: next, clock });
    return next;
  });

  const running = clock.runningSince !== null;
  const leftMs = running ? clock.leftMs - (now - (clock.runningSince ?? now)) : clock.leftMs;
  const answered = set.questions.filter((question) => answers[question.id] !== undefined).length;
  const complete = answered === total && total > 0;

  // Tick while the clock runs (and catch up at once when the tab comes back).
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    const wake = () => setNow(Date.now());
    document.addEventListener("visibilitychange", wake);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", wake); };
  }, [running]);

  const start = () => updateClock({ started: true, leftMs: clock.leftMs, runningSince: Date.now() });
  const pause = () => updateClock({ ...clock, leftMs: Math.max(0, leftMs), runningSince: null });
  const resume = () => updateClock({ ...clock, runningSince: Date.now() });

  async function submit(timeUp = false) {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const attemptId = await submitTest(set.id, answers);
      try { window.localStorage.removeItem(draftKey(set.id)); } catch { /* nothing to clear */ }
      if (timeUp) toast.info(`সময় শেষ — ${answered}/${total}টি উত্তর জমা দেওয়া হলো`);
      router.push(`/preliminary/${set.id}/result/${attemptId}`);
      router.refresh();
    } catch (error) {
      submitted.current = false;
      toast.error(error instanceof Error ? error.message : "Couldn't submit the test.");
      setSubmitting(false);
    }
  }

  // Time's up: hand in what has been answered (blank ones count as wrong).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the clock reaching zero
    if (clock.started && running && leftMs <= 0) void submit(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- submit reads the latest answers itself
  }, [clock.started, running, leftMs]);

  const minutes = Math.round((fullMs / 60_000) * 10) / 10;
  const low = leftMs <= 60_000;

  if (!clock.started) {
    return <div className="mx-auto max-w-3xl space-y-4">
      <Header set={set}>
        <button type="button" disabled={pending} onClick={() => void move("DOING", "Doing-এ ফেরানো হলো — উত্তর আবার দেখা যাবে")} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"><RotateCcw className="size-4" /> আবার পড়ো</button>
      </Header>
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 text-center sm:p-10">
        <Timer className="mx-auto size-10 text-amber-500" />
        <h2 className="mt-3 text-xl font-semibold">Exam শুরু করবে?</h2>
        <p className="mt-2 text-sm text-zinc-500">{total}টি প্রশ্ন × {SECONDS_PER_QUESTION} সেকেন্ড = <span className="font-semibold text-zinc-900">{minutes} মিনিট</span></p>
        <p className="mt-1 text-xs text-zinc-400">উত্তর লুকানো থাকবে। দরকার হলে timer pause করতে পারবে। সময় শেষ হলে যতটুকু দিয়েছ ততটুকুই জমা হবে।</p>
        <button type="button" onClick={start} disabled={!total} className="mx-auto mt-6 flex h-12 items-center gap-2 rounded-xl bg-zinc-950 px-6 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"><Play className="size-4" /> শুরু করো</button>
      </section>
    </div>;
  }

  return <div className="mx-auto max-w-3xl space-y-4 pb-24">
    <Header set={set} />
    <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Exam mode: উত্তর লুকানো। প্রতিটা প্রশ্নে একটা option বেছে নাও, সব শেষে Submit করো।</p>

    <div className="relative">
      {/* Paused: the questions are hidden until the clock runs again. */}
      {!running ? <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-zinc-50/70 pt-16 backdrop-blur-md">
        <div className="sticky top-24 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-lg">
          <Pause className="mx-auto size-8 text-zinc-400" />
          <p className="mt-2 font-semibold">Timer থামানো আছে</p>
          <p className="mt-1 text-sm tabular-nums text-zinc-500">বাকি {clockText(leftMs)}</p>
          <button type="button" onClick={resume} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white"><Play className="size-4" /> চালিয়ে যাও</button>
        </div>
      </div> : null}
      <ol className={cn("space-y-3", !running && "pointer-events-none select-none")} aria-hidden={!running}>
        {set.questions.map((question, index) => <li key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
          <p className="font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={question.text} /></p>
          <div role="radiogroup" aria-label={`প্রশ্ন ${index + 1}`} className="mt-3 grid gap-2 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => {
              const selected = answers[question.id] === optionIndex;
              return <button key={optionIndex} type="button" role="radio" aria-checked={selected} onClick={() => choose(question.id, optionIndex)} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition", selected ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-950 ring-2 ring-indigo-200" : "border-zinc-200 hover:bg-zinc-50")}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", selected ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600")}>{OPTION_LETTERS[optionIndex]}</span>
                <MathText text={option} />
              </button>;
            })}
          </div>
        </li>)}
      </ol>
    </div>

    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5", low ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-900")} aria-live="off">
          <Timer className={cn("size-4", low && running && "animate-pulse")} />
          <span className="font-mono text-lg font-semibold tabular-nums">{clockText(leftMs)}</span>
          <button type="button" onClick={running ? pause : resume} aria-label={running ? "Timer থামাও" : "Timer চালাও"} title={running ? "Pause" : "Resume"} className="ml-0.5 flex size-8 items-center justify-center rounded-lg hover:bg-white">{running ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium tabular-nums">{answered}/{total} <span className="hidden sm:inline">উত্তর দেওয়া</span></p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} /></div>
        </div>
        <button type="button" onClick={() => setConfirm(true)} disabled={!complete || submitting} title={complete ? undefined : "সব প্রশ্নের উত্তর দাও"} className="h-11 shrink-0 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">{submitting ? "Submitting…" : "Submit"}</button>
      </div>
    </div>

    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent>
        <AlertDialogTitle>Test জমা দেবে?</AlertDialogTitle>
        <AlertDialogDescription>জমা দিলে আর উত্তর বদলানো যাবে না। সাথে সাথে ফল আর সঠিক উত্তরগুলো দেখাবে।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>আবার দেখি</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setConfirm(false); void submit(); }}>Submit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

/** After a test: score, and every question with the user's answer against the right one. */
export function ResultView({ attempt, setId, status, topicName, subjectName }: {
  attempt: { id: string; total: number; correct: number; submittedAt: Date; details: AttemptDetail[] };
  setId: string;
  status: SetView["status"];
  topicName: string;
  subjectName: string | null;
}) {
  const { pending, move } = useMove(setId);
  const [filter, setFilter] = useState<"all" | "wrong">("all");
  const wrong = attempt.total - attempt.correct;
  const score = attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0;
  const rows = attempt.details.map((detail, index) => ({ ...detail, index, right: detail.chosen === detail.correctIndex }));
  const shown = filter === "wrong" ? rows.filter((row) => !row.right) : rows;
  const letter = (index: number) => (index >= 0 ? OPTION_LETTERS[index] : "—");

  return <div className="mx-auto max-w-3xl space-y-4">
    <Link href={`/preliminary?status=${status.toLowerCase()}`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="size-4" /> Preliminary</Link>
    <section className="overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white">
      <p className="text-xs font-medium text-zinc-400">{subjectName ?? "Subject নেই"} · <MathText text={topicName} /> · {formatDate(attempt.submittedAt)}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Result: {attempt.correct}/{attempt.total} Correct — {score}%</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white/10 py-2.5"><p className="text-xl font-semibold tabular-nums">{attempt.total}</p><p className="text-[11px] text-zinc-400">মোট প্রশ্ন</p></div>
        <div className="rounded-2xl bg-emerald-500/15 py-2.5"><p className="text-xl font-semibold tabular-nums text-emerald-300">{attempt.correct}</p><p className="text-[11px] text-zinc-400">সঠিক</p></div>
        <div className="rounded-2xl bg-red-500/15 py-2.5"><p className="text-xl font-semibold tabular-nums text-red-300">{wrong}</p><p className="text-[11px] text-zinc-400">ভুল</p></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${score}%` }} /></div>
      <div className="mt-5 flex flex-wrap gap-2">
        {status === "TESTING" ? <button type="button" disabled={pending} onClick={() => void move("DONE", "Done!", "/preliminary?status=done")} className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 disabled:opacity-50">Done-এ নাও</button> : null}
        {status === "TESTING" ? <Link href={`/preliminary/${setId}`} className="flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/5">আবার test দাও</Link> : null}
        <button type="button" disabled={pending} onClick={() => void move("DOING", "Doing-এ ফেরানো হলো", `/preliminary/${setId}`)} className="flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/5 disabled:opacity-50"><RotateCcw className="size-4" /> আবার পড়ো</button>
      </div>
    </section>

    <div className="flex items-center justify-between">
      <h2 className="font-semibold">প্রশ্ন অনুযায়ী</h2>
      <div className="flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium">
        <button type="button" onClick={() => setFilter("all")} className={cn("h-8 rounded-full px-3", filter === "all" ? "bg-white shadow-sm" : "text-zinc-500")}>সব ({rows.length})</button>
        <button type="button" onClick={() => setFilter("wrong")} className={cn("h-8 rounded-full px-3", filter === "wrong" ? "bg-white shadow-sm" : "text-zinc-500")}>ভুলগুলো ({wrong})</button>
      </div>
    </div>

    {/* Wide screens: a table like the answer sheet. */}
    <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500"><tr><th className="px-4 py-2.5 font-medium">প্রশ্ন</th><th className="px-3 py-2.5 font-medium">তোমার উত্তর</th><th className="px-3 py-2.5 font-medium">সঠিক উত্তর</th><th className="px-3 py-2.5 font-medium">ফল</th></tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {shown.map((row) => <tr key={row.index} className={row.right ? "" : "bg-red-50/40"}>
            <td className="px-4 py-3 align-top"><span className="mr-1 text-zinc-400 tabular-nums">{row.index + 1}.</span><MathText text={row.text} /></td>
            <td className={cn("px-3 py-3 align-top", row.right ? "text-emerald-700" : "text-red-700")}>{letter(row.chosen)}{row.chosen >= 0 ? <>) <MathText text={row.options[row.chosen]} /></> : " (বাদ)"}</td>
            <td className="px-3 py-3 align-top font-medium text-emerald-800">{letter(row.correctIndex)}) <MathText text={row.options[row.correctIndex]} /></td>
            <td className="whitespace-nowrap px-3 py-3 align-top">{row.right ? <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 className="size-4" /> Correct</span> : <span className="inline-flex items-center gap-1 font-medium text-red-700"><XCircle className="size-4" /> Wrong</span>}</td>
          </tr>)}
        </tbody>
      </table>
    </div>

    {/* Phones: one card per question. */}
    <ol className="space-y-3 sm:hidden">
      {shown.map((row) => <li key={row.index} className={cn("rounded-2xl border bg-white p-4", row.right ? "border-zinc-200" : "border-red-200")}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-relaxed"><span className="mr-1 text-zinc-400 tabular-nums">{row.index + 1}.</span><MathText text={row.text} /></p>
          {row.right ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label="Correct" /> : <XCircle className="size-5 shrink-0 text-red-600" aria-label="Wrong" />}
        </div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {row.options.map((option, optionIndex) => {
            const isRight = optionIndex === row.correctIndex;
            const isChosen = optionIndex === row.chosen;
            return <li key={optionIndex} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5", isRight ? "bg-emerald-50 font-medium text-emerald-900" : isChosen ? "bg-red-50 text-red-900" : "text-zinc-600")}>
              <span className="w-5 shrink-0 font-semibold">{OPTION_LETTERS[optionIndex]})</span>
              <span className="min-w-0 flex-1"><MathText text={option} /></span>
              {isRight ? <Check className="size-4 shrink-0" /> : isChosen ? <X className="size-4 shrink-0" /> : null}
            </li>;
          })}
        </ul>
        {row.chosen < 0 ? <p className="mt-1.5 text-xs text-red-600">উত্তর দেওয়া হয়নি</p> : null}
      </li>)}
    </ol>
  </div>;
}
