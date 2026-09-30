"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { QuestionSetStatus } from "@prisma/client";
import { BookOpenCheck, CalendarDays, ClipboardCheck, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { statusInfo, statusOrder } from "@/lib/preliminary";
import { cn } from "@/lib/utils";
import { deleteQuestionSet, setQuestionSetStatus, type listQuestionSets } from "@/server/actions/preliminary";

type SetRow = Awaited<ReturnType<typeof listQuestionSets>>[number];

const percent = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0);

function SetCard({ set, onDelete }: { set: SetRow; onDelete: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (status: QuestionSetStatus, done: string) => start(async () => {
    try { await setQuestionSetStatus(set.id, status); toast.success(done); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't move it."); }
  });
  const last = set.lastAttempt;
  const primary = "flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50";
  const secondary = "flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50";

  return <article className="rounded-2xl border border-zinc-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-indigo-600">{set.subject?.name ?? "Subject নেই"}</p>
        <h2 className="mt-0.5 text-base font-semibold leading-snug"><MathText text={set.topicName} /></h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(set.date)}</span>
          <span className="flex items-center gap-1"><ListChecks className="size-3.5" />{set.questionCount}টি প্রশ্ন</span>
          {last ? <span className="font-medium text-zinc-700">শেষ test: {last.correct}/{last.total} · {percent(last.correct, last.total)}%</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {set.status !== "TESTING" ? <Link href={`/preliminary/${set.id}/edit`} aria-label="Edit" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><Pencil className="size-4" /></Link> : null}
        <button type="button" onClick={onDelete} aria-label="Delete" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
      </div>
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {set.status === "TODO" ? <button type="button" disabled={pending} onClick={() => move("DOING", "Doing-এ নেওয়া হলো — এখন পড়ো")} className={primary}><BookOpenCheck className="size-4" /> পড়া শুরু করো</button> : null}

      {set.status === "DOING" ? <>
        <Link href={`/preliminary/${set.id}`} className={primary}><BookOpenCheck className="size-4" /> পড়ো</Link>
        <button type="button" disabled={pending} onClick={() => move("TESTING", "Testing-এ নেওয়া হলো — উত্তর এখন লুকানো")} className={secondary}><ClipboardCheck className="size-4" /> Test-এ নাও</button>
      </> : null}

      {set.status === "TESTING" ? <>
        <Link href={`/preliminary/${set.id}`} className={primary}><ClipboardCheck className="size-4" /> {set.attemptCount ? "আবার test দাও" : "Exam শুরু করো"}</Link>
        {last ? <Link href={`/preliminary/${set.id}/result/${last.id}`} className={secondary}>Result</Link> : null}
        {last ? <button type="button" disabled={pending} onClick={() => move("DONE", "Done!")} className={secondary}>Done-এ নাও</button> : null}
        <button type="button" disabled={pending} onClick={() => move("DOING", "Doing-এ ফেরানো হলো")} className={secondary}><RotateCcw className="size-4" /> আবার পড়ো</button>
      </> : null}

      {set.status === "DONE" ? <>
        {last ? <Link href={`/preliminary/${set.id}/result/${last.id}`} className={primary}>Result দেখো</Link> : null}
        <Link href={`/preliminary/${set.id}`} className={secondary}><BookOpenCheck className="size-4" /> উত্তরসহ দেখো</Link>
        <button type="button" disabled={pending} onClick={() => move("TESTING", "Testing-এ নেওয়া হলো")} className={secondary}><RotateCcw className="size-4" /> আবার test</button>
      </> : null}
    </div>
  </article>;
}

/** Preliminary: question sets in four columns of work — Todo, Doing (study), Testing (exam), Done. */
export function PreliminaryBoard({ sets }: { sets: SetRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wanted = searchParams.get("status")?.toUpperCase();
  const active = (statusOrder as string[]).includes(wanted ?? "") ? (wanted as QuestionSetStatus) : "TODO";
  const [deleting, setDeleting] = useState<SetRow | null>(null);
  const counts = Object.fromEntries(statusOrder.map((status) => [status, sets.filter((set) => set.status === status).length])) as Record<QuestionSetStatus, number>;
  const visible = sets.filter((set) => set.status === active);

  return <div className="mx-auto max-w-3xl space-y-4">
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preliminary</h1>
        <p className="mt-1 text-sm text-zinc-500">MCQ বানাও, পড়ো, তারপর নিজেকে test করো।</p>
      </div>
      <Link href="/preliminary/new" className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800"><Plus className="size-4" /> নতুন set</Link>
    </div>

    <div role="tablist" aria-label="Status" className="grid grid-cols-4 gap-1 rounded-2xl bg-zinc-100 p-1">
      {statusOrder.map((status) => <button
        key={status}
        type="button"
        role="tab"
        aria-selected={active === status}
        onClick={() => router.replace(`${pathname}?status=${status.toLowerCase()}`, { scroll: false })}
        className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition", active === status ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
      >
        <span className={cn("hidden size-2 rounded-full sm:inline-block", statusInfo[status].dot)} aria-hidden />
        {statusInfo[status].label}
        {counts[status] ? <span className="rounded-full bg-zinc-200/70 px-1.5 text-[11px] tabular-nums text-zinc-600">{counts[status]}</span> : null}
      </button>)}
    </div>
    <p className={cn("text-xs", statusInfo[active].tone)}>{statusInfo[active].hint}</p>

    {visible.length ? <div className="space-y-3">{visible.map((set) => <SetCard key={set.id} set={set} onDelete={() => setDeleting(set)} />)}</div>
      : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">
        {active === "TODO" ? <>কোনো set নেই। <Link href="/preliminary/new" className="font-medium text-zinc-900 underline underline-offset-2">নতুন set বানাও</Link></> : `${statusInfo[active].label}-এ এখন কিছু নেই।`}
      </div>}

    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>এই set মুছে ফেলবে?</AlertDialogTitle>
        <AlertDialogDescription>“{deleting?.topicName}”-এর সব প্রশ্ন আর test-এর ফল মুছে যাবে। ফেরানো যাবে না।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখো</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
            const target = deleting;
            setDeleting(null);
            if (target) void deleteQuestionSet(target.id).then(() => { toast.success("মুছে ফেলা হলো"); router.refresh(); }).catch((error: Error) => toast.error(error.message));
          }}>মুছে ফেলো</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
