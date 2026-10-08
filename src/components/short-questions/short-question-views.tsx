"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, CircleHelp, ClipboardCheck, Pause, Play, RotateCcw, Timer, X, XCircle } from "lucide-react";
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
import { statusInfo } from "@/lib/preliminary";
import type { ShortAttemptDetail } from "@/lib/short-questions";
import { cn } from "@/lib/utils";
import { markShortAnswer, setShortQuestionSetStatus, submitShortTest, type getShortQuestionSet } from "@/server/actions/short-questions";

type SetView = NonNullable<Awaited<ReturnType<typeof getShortQuestionSet>>>;

function Header({ set, children }: { set: SetView; children?: React.ReactNode }) {
  return <header className="space-y-2">
    <Link href={`/short-questions?status=${set.status.toLowerCase()}`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="size-4" /> Short Question</Link>
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
    try { await setShortQuestionSetStatus(setId, status); toast.success(done); if (to) router.push(to); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't move it."); } finally { setPending(false); }
  };
  return { pending, move };
}

/** Doing / Todo / Done: every question with its answer — for learning, with the answers hideable like flashcards. */
export function ShortStudyView({ set }: { set: SetView }) {
  const { pending, move } = useMove(set.id);
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
          {show
            ? <div className="mt-3 flex gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={3} /><span className="min-w-0 whitespace-pre-line"><MathText text={question.answer ?? ""} /></span></div>
            : <button type="button" onClick={() => setRevealed((value) => new Set(value).add(question.id))} className="mt-3 w-full rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 text-left text-sm text-zinc-500 hover:border-indigo-400 hover:text-indigo-700">মনে মনে উত্তর বলো, তারপর চাপো — উত্তর দেখো</button>}
        </li>;
      })}
    </ol>
    {!set.questions.length ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">এই set-এ কোনো প্রশ্ন নেই। <Link href={`/short-questions/${set.id}/edit`} className="underline">প্রশ্ন যোগ করো</Link></p> : null}
  </div>;
}

const draftKey = (setId: string) => `prep-short-exam-${setId}`;
/** Writing takes longer than picking: this many seconds for every question (20 questions → 20 minutes). */
const SECONDS_PER_QUESTION = 60;

type Clock = { started: boolean; leftMs: number; runningSince: number | null };
type Draft = { answers: Record<string, string>; clock?: Clock };

const clockText = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Testing: questions only (the page never receives the answers), each answered in writing, against
 * a pausable clock. When time runs out what has been written is submitted.
 */
export function ShortExamView({ set }: { set: SetView }) {
  const router = useRouter();
  const { pending, move } = useMove(set.id);
  const total = set.questions.length;
  const fullMs = total * SECONDS_PER_QUESTION * 1000;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [clock, setClock] = useState<Clock>({ started: false, leftMs: fullMs, runningSince: null });
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  // A half-done exam — answers and the clock — survives a reload (this browser only).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(set.id));
      const draft = saved ? (JSON.parse(saved) as Draft) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
      if (draft?.answers) { setAnswers(draft.answers); if (draft.clock) setClock(draft.clock); }
    } catch { /* storage unavailable: start fresh */ }
    setNow(Date.now());
  }, [set.id]);
  const remember = (next: Draft) => { try { window.localStorage.setItem(draftKey(set.id), JSON.stringify(next)); } catch { /* not remembered */ } };
  const updateClock = (next: Clock) => { setClock(next); setNow(Date.now()); remember({ answers, clock: next }); };
  const write = (questionId: string, value: string) => setAnswers((current) => {
    const next = { ...current, [questionId]: value };
    remember({ answers: next, clock });
    return next;
  });

  const running = clock.runningSince !== null;
  const leftMs = running ? clock.leftMs - (now - (clock.runningSince ?? now)) : clock.leftMs;
  const answered = set.questions.filter((question) => answers[question.id]?.trim()).length;

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
      const attemptId = await submitShortTest(set.id, answers);
      try { window.localStorage.removeItem(draftKey(set.id)); } catch { /* nothing to clear */ }
      if (timeUp) toast.info(`সময় শেষ — ${answered}/${total}টি উত্তর জমা দেওয়া হলো`);
      router.push(`/short-questions/${set.id}/result/${attemptId}`);
      router.refresh();
    } catch (error) {
      submitted.current = false;
      toast.error(error instanceof Error ? error.message : "Couldn't submit the test.");
      setSubmitting(false);
    }
  }

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
        <p className="mt-1 text-xs text-zinc-400">প্রতিটা প্রশ্নের উত্তর লিখবে। জমা দেওয়ার পর আসল উত্তরের সাথে মিলিয়ে নিজে ঠিক/ভুল দেবে — হুবহু মিললে নিজে থেকেই ঠিক ধরা হবে।</p>
        <button type="button" onClick={start} disabled={!total} className="mx-auto mt-6 flex h-12 items-center gap-2 rounded-xl bg-zinc-950 px-6 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"><Play className="size-4" /> শুরু করো</button>
      </section>
    </div>;
  }

  return <div className="mx-auto max-w-3xl space-y-4 pb-24">
    <Header set={set} />
    <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Exam mode: উত্তর লুকানো। প্রতিটা প্রশ্নের উত্তর লেখো, সব শেষে Submit করো। না পারলে ফাঁকা রাখো।</p>

    <div className="relative">
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
          <textarea value={answers[question.id] ?? ""} onChange={(event) => write(question.id, event.target.value)} rows={2} placeholder="তোমার উত্তর" aria-label={`প্রশ্ন ${index + 1}-এর উত্তর`} className={cn("mt-3 min-h-11 w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none transition focus:border-indigo-500", answers[question.id]?.trim() ? "border-indigo-300 bg-indigo-50/40" : "border-zinc-200")} />
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
          <p className="text-sm font-medium tabular-nums">{answered}/{total} <span className="hidden sm:inline">উত্তর লেখা</span></p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} /></div>
        </div>
        <button type="button" onClick={() => setConfirm(true)} disabled={submitting || !total} className="h-11 shrink-0 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">{submitting ? "Submitting…" : "Submit"}</button>
      </div>
    </div>

    <AlertDialog open={confirm} onOpenChange={setConfirm}>
      <AlertDialogContent>
        <AlertDialogTitle>Test জমা দেবে?</AlertDialogTitle>
        <AlertDialogDescription>{answered < total ? `${total - answered}টি প্রশ্ন ফাঁকা — ওগুলো ভুল ধরা হবে। ` : ""}জমা দিলে আর উত্তর বদলানো যাবে না। এরপর আসল উত্তর দেখে নিজের উত্তর ঠিক/ভুল দেবে।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>আবার দেখি</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setConfirm(false); void submit(); }}>Submit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

/** After a test: each written answer beside the real one, marked right/wrong by the user (exact ones already marked). */
export function ShortResultView({ attempt, setId, status, topicName, subjectName }: {
  attempt: { id: string; total: number; correct: number; submittedAt: Date; details: ShortAttemptDetail[] };
  setId: string;
  status: SetView["status"];
  topicName: string;
  subjectName: string | null;
}) {
  const router = useRouter();
  const { pending, move } = useMove(setId);
  const [details, setDetails] = useState(attempt.details);
  const [filter, setFilter] = useState<"all" | "wrong" | "unmarked">("all");
  const correct = details.filter((detail) => detail.right === true).length;
  const wrong = details.filter((detail) => detail.right === false).length;
  const unmarked = details.length - correct - wrong;
  const score = attempt.total ? Math.round((correct / attempt.total) * 100) : 0;
  const rows = details.map((detail, index) => ({ ...detail, index }));
  const shown = filter === "wrong" ? rows.filter((row) => row.right === false) : filter === "unmarked" ? rows.filter((row) => row.right === null) : rows;

  async function mark(index: number, right: boolean) {
    const before = details;
    setDetails((list) => list.map((detail, at) => (at === index ? { ...detail, right } : detail)));
    try { await markShortAnswer(attempt.id, index, right); router.refresh(); } catch (error) { setDetails(before); toast.error(error instanceof Error ? error.message : "Couldn't save the mark."); }
  }

  return <div className="mx-auto max-w-3xl space-y-4">
    <Link href={`/short-questions?status=${status.toLowerCase()}`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="size-4" /> Short Question</Link>
    <section className="overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white">
      <p className="text-xs font-medium text-zinc-400">{subjectName ?? "Subject নেই"} · <MathText text={topicName} /> · {formatDate(attempt.submittedAt)}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Result: {correct}/{attempt.total} Correct — {score}%</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-emerald-500/15 py-2.5"><p className="text-xl font-semibold tabular-nums text-emerald-300">{correct}</p><p className="text-[11px] text-zinc-400">সঠিক</p></div>
        <div className="rounded-2xl bg-red-500/15 py-2.5"><p className="text-xl font-semibold tabular-nums text-red-300">{wrong}</p><p className="text-[11px] text-zinc-400">ভুল</p></div>
        <div className="rounded-2xl bg-amber-500/15 py-2.5"><p className="text-xl font-semibold tabular-nums text-amber-300">{unmarked}</p><p className="text-[11px] text-zinc-400">মেলানো বাকি</p></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${score}%` }} /></div>
      {unmarked ? <p className="mt-3 text-sm text-amber-200">{unmarked}টি উত্তর আসল উত্তরের সাথে মিলিয়ে ✓ বা ✗ দাও — তারপর score ঠিক হবে।</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {status === "TESTING" ? <button type="button" disabled={pending} onClick={() => void move("DONE", "Done!", "/short-questions?status=done")} className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 disabled:opacity-50">Done-এ নাও</button> : null}
        {status === "TESTING" ? <Link href={`/short-questions/${setId}`} className="flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/5">আবার test দাও</Link> : null}
        <button type="button" disabled={pending} onClick={() => void move("DOING", "Doing-এ ফেরানো হলো", `/short-questions/${setId}`)} className="flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white ring-1 ring-white/25 hover:bg-white/5 disabled:opacity-50"><RotateCcw className="size-4" /> আবার পড়ো</button>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">প্রশ্ন অনুযায়ী</h2>
      <div className="flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium">
        <button type="button" onClick={() => setFilter("all")} className={cn("h-8 rounded-full px-3", filter === "all" ? "bg-white shadow-sm" : "text-zinc-500")}>সব ({rows.length})</button>
        <button type="button" onClick={() => setFilter("unmarked")} className={cn("h-8 rounded-full px-3", filter === "unmarked" ? "bg-white shadow-sm" : "text-zinc-500")}>বাকি ({unmarked})</button>
        <button type="button" onClick={() => setFilter("wrong")} className={cn("h-8 rounded-full px-3", filter === "wrong" ? "bg-white shadow-sm" : "text-zinc-500")}>ভুলগুলো ({wrong})</button>
      </div>
    </div>

    <ol className="space-y-3">
      {shown.map((row) => <li key={row.index} className={cn("rounded-2xl border bg-white p-4", row.right === false ? "border-red-200" : row.right === null ? "border-amber-300" : "border-zinc-200")}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-relaxed"><span className="mr-1 text-zinc-400 tabular-nums">{row.index + 1}.</span><MathText text={row.text} /></p>
          {row.right === true ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label="Correct" /> : row.right === false ? <XCircle className="size-5 shrink-0 text-red-600" aria-label="Wrong" /> : <CircleHelp className="size-5 shrink-0 text-amber-500" aria-label="Not marked" />}
        </div>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div className={cn("rounded-xl px-3 py-2", row.right === false ? "bg-red-50 text-red-950" : "bg-zinc-50")}>
            <p className="text-[11px] font-semibold text-zinc-500">তোমার উত্তর</p>
            <p className="mt-0.5 whitespace-pre-line">{row.given ? <MathText text={row.given} /> : <span className="text-zinc-400">(ফাঁকা)</span>}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-950">
            <p className="text-[11px] font-semibold text-emerald-700">সঠিক উত্তর</p>
            <p className="mt-0.5 whitespace-pre-line"><MathText text={row.answer} /></p>
          </div>
        </div>
        {row.given ? <div className="mt-2 flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-zinc-500">{row.right === null ? "মিলিয়ে দেখো:" : "বদলাতে চাইলে:"}</span>
          <button type="button" onClick={() => void mark(row.index, true)} aria-pressed={row.right === true} className={cn("flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium ring-1 transition", row.right === true ? "bg-emerald-600 text-white ring-emerald-600" : "text-emerald-700 ring-emerald-200 hover:bg-emerald-50")}><Check className="size-4" /> ঠিক</button>
          <button type="button" onClick={() => void mark(row.index, false)} aria-pressed={row.right === false} className={cn("flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium ring-1 transition", row.right === false ? "bg-red-600 text-white ring-red-600" : "text-red-700 ring-red-200 hover:bg-red-50")}><X className="size-4" /> ভুল</button>
        </div> : null}
      </li>)}
    </ol>
  </div>;
}
