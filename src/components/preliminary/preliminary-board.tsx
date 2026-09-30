"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { QuestionSetStatus } from "@prisma/client";
import { BookOpenCheck, CalendarDays, Check, ClipboardCheck, Combine, ListChecks, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/dayjs";
import { statusInfo, statusOrder } from "@/lib/preliminary";
import { cn } from "@/lib/utils";
import { deleteQuestionSet, mergeQuestionSets, setQuestionSetStatus, type listQuestionSets } from "@/server/actions/preliminary";

type SetRow = Awaited<ReturnType<typeof listQuestionSets>>[number];

const percent = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0);

/** A card in "Set মেলাও" mode: the whole card toggles it; the number is its place in the merged set. */
function SelectableCard({ set, order, onToggle }: { set: SetRow; order: number; onToggle: () => void }) {
  const selected = order > 0;
  return <button type="button" onClick={onToggle} aria-pressed={selected} className={cn("flex w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left transition", selected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-zinc-200 hover:border-zinc-300")}>
    <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1", selected ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-transparent ring-zinc-300")}>{selected ? order : <Check className="size-3.5" />}</span>
    <span className="min-w-0">
      <span className="block truncate text-xs font-medium text-indigo-600">{set.subject?.name ?? "Subject নেই"}</span>
      <span className="mt-0.5 block text-base font-semibold leading-snug"><MathText text={set.topicName} /></span>
      <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(set.date)}</span>
        <span className="flex items-center gap-1"><ListChecks className="size-3.5" />{set.questionCount}টি প্রশ্ন</span>
        <span className={statusInfo[set.status].tone}>{statusInfo[set.status].label}</span>
      </span>
    </span>
  </button>;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const field = "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400";

/** Name, subject and date for the merged set, and whether the originals go away. */
function MergeDialog({ picked, subjects, onClose, onDone }: { picked: SetRow[]; subjects: Array<{ id: string; name: string }>; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [topicName, setTopicName] = useState(() => picked.map((set) => set.topicName).join(" + ").slice(0, 160));
  const [subjectId, setSubjectId] = useState(() => picked.find((set) => set.subjectId)?.subjectId ?? "");
  const [date, setDate] = useState(today);
  const [deleteOriginals, setDeleteOriginals] = useState(false);
  const [pending, start] = useTransition();
  const total = picked.reduce((sum, set) => sum + set.questionCount, 0);
  const attempts = picked.reduce((sum, set) => sum + set.attemptCount, 0);

  const submit = () => start(async () => {
    try {
      const result = await mergeQuestionSets({ setIds: picked.map((set) => set.id), topicName, subjectId, date, deleteOriginals });
      toast.success(`নতুন set বানানো হলো — ${result.questionCount}টি প্রশ্ন, Todo-তে আছে${result.duplicates ? ` · ${result.duplicates}টি একই প্রশ্ন বাদ দেওয়া হলো` : ""}`, { duration: 6000 });
      onDone();
      router.replace("/preliminary?status=todo", { scroll: false });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Set মেলানো গেল না।");
    }
  });

  return <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{picked.length}টি set এক করো</DialogTitle></DialogHeader>
      <ol className="space-y-1 rounded-xl bg-zinc-50 p-3 text-sm">
        {picked.map((set, index) => <li key={set.id} className="flex items-center gap-2"><span className="w-5 text-xs font-semibold text-zinc-400">{index + 1}.</span><span className="min-w-0 flex-1 truncate">{set.topicName}</span><span className="shrink-0 text-xs text-zinc-500">{set.questionCount}টি</span></li>)}
        <li className="flex justify-end border-t border-zinc-200 pt-1.5 text-xs font-semibold text-zinc-700">মোট {total}টি প্রশ্ন · একই প্রশ্ন দুবার থাকলে একবারই রাখা হবে</li>
      </ol>
      <div className="space-y-3">
        <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">নতুন set-এর topic</span><input value={topicName} onChange={(event) => setTopicName(event.target.value)} maxLength={160} className={field} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">Subject</span>
            <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={field}>
              <option value="">বেছে নাও…</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">তারিখ</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} /></label>
        </div>
        <label className="flex items-start gap-2.5 rounded-xl p-2 text-sm ring-1 ring-zinc-200">
          <input type="checkbox" checked={deleteOriginals} onChange={(event) => setDeleteOriginals(event.target.checked)} className="mt-0.5 size-4 accent-red-600" />
          <span><span className="font-medium">আগের set-গুলো মুছে ফেলো</span><span className="block text-xs text-zinc-500">না দিলে আগের set-গুলোও থেকে যাবে।{attempts ? ` মুছলে ওগুলোর ${attempts}টি test-এর ফলও মুছে যাবে।` : ""}</span></span>
        </label>
      </div>
      <button type="button" onClick={submit} disabled={pending || !topicName.trim() || !subjectId || !date} className="mt-1 h-11 w-full rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
        {pending ? "বানানো হচ্ছে…" : "নতুন set বানাও"}
      </button>
    </DialogContent>
  </Dialog>;
}

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
export function PreliminaryBoard({ sets, subjects }: { sets: SetRow[]; subjects: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wanted = searchParams.get("status")?.toUpperCase();
  const active = (statusOrder as string[]).includes(wanted ?? "") ? (wanted as QuestionSetStatus) : "TODO";
  const [deleting, setDeleting] = useState<SetRow | null>(null);
  // "Set মেলাও": picked set ids in the order they were tapped, kept while switching tabs.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const pickedSets = picked.map((id) => sets.find((set) => set.id === id)).filter((set) => set !== undefined);
  const togglePick = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  const stopSelecting = () => { setSelecting(false); setPicked([]); setMerging(false); };
  const counts = Object.fromEntries(statusOrder.map((status) => [status, sets.filter((set) => set.status === status).length])) as Record<QuestionSetStatus, number>;
  const visible = sets.filter((set) => set.status === active);

  return <div className="mx-auto max-w-3xl space-y-4">
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preliminary</h1>
        <p className="mt-1 text-sm text-zinc-500">MCQ বানাও, পড়ো, তারপর নিজেকে test করো।</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {sets.length > 1 ? <button type="button" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting} className={cn("flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 transition", selecting ? "bg-indigo-50 text-indigo-900 ring-indigo-300" : "text-zinc-700 ring-zinc-200 hover:bg-zinc-50")}>{selecting ? <X className="size-4" /> : <Combine className="size-4" />} {selecting ? "বাতিল" : "Set মেলাও"}</button> : null}
        <Link href="/preliminary/new" className="flex h-10 items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800"><Plus className="size-4" /> নতুন set</Link>
      </div>
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
    {selecting ? <p className="text-xs text-indigo-700">যে set-গুলো এক করতে চাও সেগুলোতে চাপো — যে ক্রমে চাপবে, প্রশ্নগুলো সেই ক্রমে বসবে। অন্য tab থেকেও বাছা যায়।</p>
      : <p className={cn("text-xs", statusInfo[active].tone)}>{statusInfo[active].hint}</p>}

    {visible.length ? <div className={cn("space-y-3", selecting && "pb-20")}>{visible.map((set) => selecting
      ? <SelectableCard key={set.id} set={set} order={picked.indexOf(set.id) + 1} onToggle={() => togglePick(set.id)} />
      : <SetCard key={set.id} set={set} onDelete={() => setDeleting(set)} />)}</div>
      : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">
        {active === "TODO" ? <>কোনো set নেই। <Link href="/preliminary/new" className="font-medium text-zinc-900 underline underline-offset-2">নতুন set বানাও</Link></> : `${statusInfo[active].label}-এ এখন কিছু নেই।`}
      </div>}

    {selecting ? <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="text-xs text-zinc-600">{pickedSets.length ? <><span className="font-semibold text-zinc-900">{pickedSets.length}টি set</span> · {pickedSets.reduce((sum, set) => sum + set.questionCount, 0)}টি প্রশ্ন</> : "অন্তত ২টা set বাছো"}</p>
        <button type="button" onClick={() => setMerging(true)} disabled={pickedSets.length < 2} className="flex h-11 items-center gap-1.5 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"><Combine className="size-4" /> এক করো</button>
      </div>
    </div> : null}

    {merging && pickedSets.length > 1 ? <MergeDialog picked={pickedSets} subjects={subjects} onClose={() => setMerging(false)} onDone={stopSelecting} /> : null}

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
