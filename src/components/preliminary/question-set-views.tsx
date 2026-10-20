"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, BookmarkCheck, Check, CheckCircle2, CircleCheck, ClipboardCheck, Eye, EyeOff, ListChecks, Lock, Pause, Play, RotateCcw, Timer, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/user-error";
// Solutions are shown in the read-only Quill view (BookText).
import "quill/dist/quill.snow.css";
import { BookText, MathText } from "@/components/math-text";
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
import { startSetStudy } from "@/store/timer-start";
import { setQuestionSetStatus, setQuestionsRead, submitTest, type AttemptDetail, type getQuestionSet } from "@/server/actions/preliminary";
import { AiSolveBar, type SolvedNotes } from "./ai-solve-bar";

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
    try { await setQuestionSetStatus(setId, status); toast.success(done); if (to) router.push(to); router.refresh(); } catch (error) { toast.error(errorMessage(error, "Couldn't move it.")); } finally { setPending(false); }
  };
  return { pending, move };
}

type NoteKind = "solution" | "explanation";

/**
 * Two buttons, "সমাধান" and "ব্যাখ্যা": each opens its own text. Both are a paid feature — without
 * a plan the server sends only whether one exists (`has…`), and the button shows a lock and the
 * way to Plans instead.
 */
export function SolutionNotes({ solution, explanation, hasSolution, hasExplanation }: { solution?: string | null; explanation?: string | null; hasSolution?: boolean; hasExplanation?: boolean }) {
  const [open, setOpen] = useState<NoteKind | null>(null);
  const notes = ([
    { kind: "solution", label: "সমাধান", text: solution, exists: Boolean(solution) || Boolean(hasSolution), tone: "bg-zinc-50 text-zinc-700" },
    { kind: "explanation", label: "ব্যাখ্যা", text: explanation, exists: Boolean(explanation) || Boolean(hasExplanation), tone: "bg-sky-50 text-sky-950" },
  ] as const).filter((note) => note.exists);
  if (!notes.length) return null;
  const shown = notes.find((note) => note.kind === open);

  return <div className="mt-3 space-y-2 text-sm leading-relaxed">
    <div className="flex flex-wrap gap-2">
      {notes.map((note) => {
        const locked = !note.text;
        const active = open === note.kind;
        return <button key={note.kind} type="button" onClick={() => setOpen(active ? null : note.kind)} aria-expanded={active} className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition", active ? "bg-zinc-950 text-white ring-zinc-950" : "text-zinc-700 ring-zinc-200 hover:bg-zinc-50")}>
          {locked ? <Lock className="size-3.5" /> : null}{note.label}
        </button>;
      })}
    </div>
    {shown ? (shown.text
      ? <div className={cn("rounded-xl px-3 py-2", shown.tone)}><BookText text={shown.text} /></div>
      : <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-amber-50 px-3 py-2 text-amber-900"><Lock className="size-4 shrink-0" />{shown.label} দেখতে একটা চালু plan লাগবে। <Link href="/billing" className="font-semibold underline underline-offset-2">Plan দেখুন</Link></p>) : null}
  </div>;
}

/** Doing / Todo / Done: every question with its right answer marked — for learning. */
export function StudyView({ set }: { set: SetView }) {
  const { pending, move } = useMove(set.id);
  // Study aid: hide the answers and check yourself, one tap per question.
  const [hidden, setHidden] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  // AI-written solutions show at once, before the page refreshes.
  const [solved, setSolved] = useState<Record<string, SolvedNotes>>({});
  const questions = set.questions.map((question) => {
    const notes = solved[question.id];
    return notes ? { ...question, solution: notes.solution, explanation: notes.explanation, hasSolution: Boolean(notes.solution), hasExplanation: Boolean(notes.explanation) } : question;
  });
  // "পড়া শেষ" marks, only while studying (Doing): saved per question, so the next sitting starts
  // at the unread ones — on any device.
  const marking = set.status === "DOING" && questions.length > 0;
  const [read, setRead] = useState<Set<string>>(() => new Set(set.questions.filter((question) => question.read).map((question) => question.id)));
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [resetting, setResetting] = useState(false);
  const firstUnread = questions.find((question) => !read.has(question.id));
  const readCount = questions.filter((question) => read.has(question.id)).length;

  async function mark(ids: string[], value: boolean) {
    const before = read;
    setRead((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    try {
      await setQuestionsRead({ setId: set.id, questionIds: ids, read: value });
    } catch (error) {
      setRead(before);
      toast.error(errorMessage(error, "Mark save হলো না।"));
    }
  }
  const jumpTo = (id: string) => document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const shown = marking && onlyUnread ? questions.filter((question) => !read.has(question.id)) : questions;

  return <div className="space-y-4">
    <Header set={set}>
      <div className="flex flex-wrap gap-2">
        {set.status === "TODO" ? <button type="button" disabled={pending} onClick={() => { startSetStudy(set); void move("DOING", "Doing-এ নেওয়া হলো"); }} className="h-10 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white disabled:opacity-50">পড়া শুরু করো</button> : null}
        {set.status === "DOING" ? <button type="button" disabled={pending} onClick={() => void move("TESTING", "Testing-এ নেওয়া হলো — উত্তর এখন লুকানো")} className="flex h-10 items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck className="size-4" /> পড়া শেষ — Test-এ নাও</button> : null}
        <button type="button" onClick={() => { setHidden((value) => !value); setRevealed(new Set()); }} className="h-10 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">{hidden ? "উত্তর দেখাও" : "উত্তর লুকাও"}</button>
      </div>
    </Header>

    {marking ? <section className="sticky top-[calc(4.25rem+env(safe-area-inset-top))] z-10 rounded-2xl bg-white/95 p-3 lg:top-2 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.25)] ring-1 ring-zinc-200 backdrop-blur">
      <div className="flex items-center gap-3">
        <BookmarkCheck className="size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">পড়া শেষ <span className="tabular-nums">{readCount}/{questions.length}</span>{readCount === questions.length ? " — সব পড়া হয়ে গেছে 🎉" : ""}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(readCount / questions.length) * 100}%` }} /></div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {firstUnread && readCount ? <button type="button" onClick={() => { setOnlyUnread(false); window.setTimeout(() => jumpTo(firstUnread.id), 0); }} className="flex h-8 items-center gap-1 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"><ArrowDown className="size-3.5" /> না-পড়া থেকে শুরু ({questions.indexOf(firstUnread) + 1} নং)</button> : null}
        <button type="button" onClick={() => setOnlyUnread((value) => !value)} aria-pressed={onlyUnread} className={cn("flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1 transition", onlyUnread ? "bg-zinc-900 text-white ring-zinc-900" : "text-zinc-700 ring-zinc-200 hover:bg-zinc-50")}>{onlyUnread ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} {onlyUnread ? "সব দেখাও" : "শুধু না-পড়াগুলো"}</button>
        {readCount ? resetting
          ? <span className="flex items-center gap-1 text-xs"><span className="text-zinc-600">সব mark মুছবে?</span>
            <button type="button" onClick={() => { setResetting(false); void mark(questions.map((question) => question.id), false); }} className="h-8 rounded-full bg-red-600 px-3 font-semibold text-white">হ্যাঁ</button>
            <button type="button" onClick={() => setResetting(false)} className="h-8 rounded-full px-3 font-semibold text-zinc-600 ring-1 ring-zinc-200">না</button></span>
          : <button type="button" onClick={() => setResetting(true)} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50"><RotateCcw className="size-3.5" /> আবার শুরু</button> : null}
      </div>
    </section> : null}

    {/* Solutions are a paid feature: the button is for those who can read them. */}
    {set.premium && questions.length ? <AiSolveBar setId={set.id} questions={questions.map(({ id, solution, explanation }) => ({ id, solution, explanation }))} onSolved={(notes) => setSolved((current) => ({ ...current, ...Object.fromEntries(notes.map((item) => [item.id, item])) }))} /> : null}

    <ol className="space-y-3">
      {shown.map((question) => {
        const index = questions.indexOf(question);
        const show = !hidden || revealed.has(question.id);
        const done = marking && read.has(question.id);
        return <li key={question.id} id={`q-${question.id}`} className={cn("scroll-mt-52 rounded-2xl lg:scroll-mt-36 border bg-white p-4 transition", done ? "border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50/30" : "border-zinc-200")}>
          <p className="font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={question.text} book /></p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => {
              const right = show && question.correctIndex === optionIndex;
              return <li key={optionIndex} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", right ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-900" : "border-zinc-200")}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", right ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600")}>{right ? <Check className="size-3.5" strokeWidth={3} /> : OPTION_LETTERS[optionIndex]}</span>
                <MathText text={option} book />
              </li>;
            })}
          </ul>
          {show ? <SolutionNotes solution={question.solution} explanation={question.explanation} hasSolution={question.hasSolution} hasExplanation={question.hasExplanation} /> : null}
          {!show ? <button type="button" onClick={() => setRevealed((value) => new Set(value).add(question.id))} className="mt-2 text-xs font-medium text-indigo-600 hover:underline">উত্তর দেখো</button> : null}
          {marking ? <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-zinc-100 pt-2.5">
            {!done && questions.slice(0, index).some((earlier) => !read.has(earlier.id)) ? <button type="button" onClick={() => void mark(questions.slice(0, index + 1).filter((earlier) => !read.has(earlier.id)).map((earlier) => earlier.id), true)} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100"><ListChecks className="size-3.5" /> এ পর্যন্ত সব পড়া শেষ</button> : null}
            <button type="button" onClick={() => void mark([question.id], !done)} aria-pressed={done} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition", done ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50")}>
              <CircleCheck className="size-4" /> {done ? "পড়া শেষ" : "পড়া শেষ mark করো"}
            </button>
          </div> : null}
        </li>;
      })}
    </ol>
    {marking && onlyUnread && !shown.length ? <p className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-8 text-center text-sm text-emerald-800">সব প্রশ্ন পড়া শেষ! এখন Test-এ নিতে পারো।</p> : null}
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
      toast.error(errorMessage(error, "Couldn't submit the test."));
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
    return <div className="space-y-4">
      <Header set={set}>
        <button type="button" disabled={pending} onClick={() => { startSetStudy(set); void move("DOING", "Doing-এ ফেরানো হলো — উত্তর আবার দেখা যাবে"); }} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"><RotateCcw className="size-4" /> আবার পড়ো</button>
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

  return <div className="space-y-4 pb-24">
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
          <p className="font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={question.text} book /></p>
          <div role="radiogroup" aria-label={`প্রশ্ন ${index + 1}`} className="mt-3 grid gap-2 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => {
              const selected = answers[question.id] === optionIndex;
              return <button key={optionIndex} type="button" role="radio" aria-checked={selected} onClick={() => choose(question.id, optionIndex)} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition", selected ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-950 ring-2 ring-indigo-200" : "border-zinc-200 hover:bg-zinc-50")}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", selected ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600")}>{OPTION_LETTERS[optionIndex]}</span>
                <MathText text={option} book />
              </button>;
            })}
          </div>
        </li>)}
      </ol>
    </div>

    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="container mx-auto flex items-center gap-3">
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

  return <div className="space-y-4">
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
            <td className="px-4 py-3 align-top"><span className="mr-1 text-zinc-400 tabular-nums">{row.index + 1}.</span><MathText text={row.text} book />{!row.right ? <SolutionNotes solution={row.solution} hasSolution={row.hasSolution} /> : null}</td>
            <td className={cn("px-3 py-3 align-top", row.right ? "text-emerald-700" : "text-red-700")}>{letter(row.chosen)}{row.chosen >= 0 ? <>) <MathText text={row.options[row.chosen]} book /></> : " (বাদ)"}</td>
            <td className="px-3 py-3 align-top font-medium text-emerald-800">{letter(row.correctIndex)}) <MathText text={row.options[row.correctIndex]} book /></td>
            <td className="whitespace-nowrap px-3 py-3 align-top">{row.right ? <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 className="size-4" /> Correct</span> : <span className="inline-flex items-center gap-1 font-medium text-red-700"><XCircle className="size-4" /> Wrong</span>}</td>
          </tr>)}
        </tbody>
      </table>
    </div>

    {/* Phones: one card per question. */}
    <ol className="space-y-3 sm:hidden">
      {shown.map((row) => <li key={row.index} className={cn("rounded-2xl border bg-white p-4", row.right ? "border-zinc-200" : "border-red-200")}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-relaxed"><span className="mr-1 text-zinc-400 tabular-nums">{row.index + 1}.</span><MathText text={row.text} book /></p>
          {row.right ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label="Correct" /> : <XCircle className="size-5 shrink-0 text-red-600" aria-label="Wrong" />}
        </div>
        <ul className="mt-2 space-y-1.5 text-sm">
          {row.options.map((option, optionIndex) => {
            const isRight = optionIndex === row.correctIndex;
            const isChosen = optionIndex === row.chosen;
            return <li key={optionIndex} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5", isRight ? "bg-emerald-50 font-medium text-emerald-900" : isChosen ? "bg-red-50 text-red-900" : "text-zinc-600")}>
              <span className="w-5 shrink-0 font-semibold">{OPTION_LETTERS[optionIndex]})</span>
              <span className="min-w-0 flex-1"><MathText text={option} book /></span>
              {isRight ? <Check className="size-4 shrink-0" /> : isChosen ? <X className="size-4 shrink-0" /> : null}
            </li>;
          })}
        </ul>
        {row.chosen < 0 ? <p className="mt-1.5 text-xs text-red-600">উত্তর দেওয়া হয়নি</p> : null}
        {!row.right ? <SolutionNotes solution={row.solution} hasSolution={row.hasSolution} /> : null}
      </li>)}
    </ol>
  </div>;
}
