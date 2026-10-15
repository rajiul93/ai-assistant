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
import { ShareButton } from "@/components/collaboration/share-button";
import { SubjectTopicFilter, useSubjectTopicFilter } from "@/components/subject-topic-filter";
import { topicPath, type TopicNode } from "@/lib/subject-filter";
import { cn } from "@/lib/utils";
import { deleteQuestionSet, mergeQuestionSets, setQuestionSetStatus, type listQuestionSets } from "@/server/actions/preliminary";
import { deleteShortQuestionSet, mergeShortQuestionSets, setShortQuestionSetStatus } from "@/server/actions/short-questions";

// Short Question sets share this board but never come from the Question Bank.
type SetRow = Omit<Awaited<ReturnType<typeof listQuestionSets>>[number], "bankSetId"> & { bankSetId?: string | null };

/** The board serves both Preliminary (MCQ) and Short Question; only the paths, words and actions differ. */
export type BoardKind = "mcq" | "short";
const kinds = {
  mcq: { base: "/preliminary", title: "Preliminary", blurb: "MCQ বানাও, পড়ো, তারপর নিজেকে test করো।", setStatus: setQuestionSetStatus, remove: deleteQuestionSet, merge: mergeQuestionSets },
  short: { base: "/short-questions", title: "Short Question", blurb: "প্রশ্ন-উত্তর বানাও, পড়ো, তারপর লিখে নিজেকে test করো।", setStatus: setShortQuestionSetStatus, remove: deleteShortQuestionSet, merge: mergeShortQuestionSets },
};

const percent = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0);

/** The card's left edge, one colour per status (as on the Jobs and Tasks pages). */
const statusEdge: Record<QuestionSetStatus, string> = { TODO: "border-l-slate-300", DOING: "border-l-sky-400", TESTING: "border-l-amber-400", DONE: "border-l-emerald-500" };
const cardBase = "min-w-0 rounded-3xl border-l-4 bg-white p-3.5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-4";

/** A card in "Set মেলাও" mode: the whole card toggles it; the number is its place in the merged set. */
function SelectableCard({ set, place, order, onToggle }: { set: SetRow; place: string; order: number; onToggle: () => void }) {
  const selected = order > 0;
  return <button type="button" onClick={onToggle} aria-pressed={selected} className={cn(cardBase, statusEdge[set.status], "flex w-full items-start gap-3 text-left transition", selected && "ring-2 ring-blue-500")}>
    <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1", selected ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-transparent ring-slate-300")}>{selected ? order : <Check className="size-3.5" />}</span>
    <span className="min-w-0">
      <span className="block truncate text-xs font-medium text-blue-600">{place}</span>
      <span className="mt-0.5 block text-[15px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]"><MathText text={set.topicName} /></span>
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
function MergeDialog({ kind, picked, subjects, onClose, onDone }: { kind: BoardKind; picked: SetRow[]; subjects: Array<{ id: string; name: string }>; onClose: () => void; onDone: () => void }) {
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
      const result = await kinds[kind].merge({ setIds: picked.map((set) => set.id), topicName, subjectId, date, deleteOriginals });
      toast.success(`নতুন set বানানো হলো — ${result.questionCount}টি প্রশ্ন, Todo-তে আছে${result.duplicates ? ` · ${result.duplicates}টি একই প্রশ্ন বাদ দেওয়া হলো` : ""}`, { duration: 6000 });
      onDone();
      router.replace(`${kinds[kind].base}?status=todo`, { scroll: false });
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

function SetCard({ kind, set, place, onDelete }: { kind: BoardKind; set: SetRow; place: string; onDelete: () => void }) {
  const base = kinds[kind].base;
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (status: QuestionSetStatus, done: string) => start(async () => {
    try { await kinds[kind].setStatus(set.id, status); toast.success(done); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't move it."); }
  });
  const last = set.lastAttempt;
  // The main next step fills the row on phones; the rest are quiet pills beside or under it.
  const primary = "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)] transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 sm:flex-none";
  const secondary = "flex h-10 items-center justify-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50";

  return <article className={cn(cardBase, statusEdge[set.status])}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-blue-600"><span className="truncate">{place}</span>{set.bankSetId ? <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-semibold text-sky-700">প্রশ্ন ব্যাংক</span> : null}</p>
        <h2 className="mt-0.5 text-[15px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]"><MathText text={set.topicName} /></h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(set.date)}</span>
          <span className="flex items-center gap-1"><ListChecks className="size-3.5" />{set.questionCount}টি প্রশ্ন</span>
          {last ? <span className={cn("rounded-full px-2 py-0.5 font-semibold", percent(last.correct, last.total) >= 80 ? "bg-emerald-50 text-emerald-700" : percent(last.correct, last.total) >= 50 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700")}>শেষ test {last.correct}/{last.total} · {percent(last.correct, last.total)}%</span> : null}
        </p>
      </div>
      <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
        <ShareButton type={kind === "short" ? "SHORT_QUESTION_SET" : "PRELIMINARY_SET"} itemId={set.id} title={set.topicName} label={false} className="size-9 justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" />
        {set.status !== "TESTING" ? <Link href={`${base}/${set.id}/edit`} aria-label="Edit" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><Pencil className="size-4" /></Link> : null}
        <button type="button" onClick={onDelete} aria-label="Delete" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
      </div>
    </div>

    <div className="mt-3 flex flex-wrap gap-1.5">
      {set.status === "TODO" ? <button type="button" disabled={pending} onClick={() => move("DOING", "Doing-এ নেওয়া হলো — এখন পড়ো")} className={primary}><BookOpenCheck className="size-4" /> পড়া শুরু করো</button> : null}

      {set.status === "DOING" ? <>
        <Link href={`${base}/${set.id}`} className={primary}><BookOpenCheck className="size-4" /> পড়ো</Link>
        <button type="button" disabled={pending} onClick={() => move("TESTING", "Testing-এ নেওয়া হলো — উত্তর এখন লুকানো")} className={secondary}><ClipboardCheck className="size-4" /> Test-এ নাও</button>
      </> : null}

      {set.status === "TESTING" ? <>
        <Link href={`${base}/${set.id}`} className={primary}><ClipboardCheck className="size-4" /> {set.attemptCount ? "আবার test দাও" : "Exam শুরু করো"}</Link>
        {last ? <Link href={`${base}/${set.id}/result/${last.id}`} className={secondary}>Result</Link> : null}
        {last ? <button type="button" disabled={pending} onClick={() => move("DONE", "Done!")} className={secondary}>Done-এ নাও</button> : null}
        <button type="button" disabled={pending} onClick={() => move("DOING", "Doing-এ ফেরানো হলো")} className={secondary}><RotateCcw className="size-4" /> আবার পড়ো</button>
      </> : null}

      {set.status === "DONE" ? <>
        {last ? <Link href={`${base}/${set.id}/result/${last.id}`} className={primary}>Result দেখো</Link> : null}
        <Link href={`${base}/${set.id}`} className={secondary}><BookOpenCheck className="size-4" /> উত্তরসহ দেখো</Link>
        <button type="button" disabled={pending} onClick={() => move("TESTING", "Testing-এ নেওয়া হলো")} className={secondary}><RotateCcw className="size-4" /> আবার test</button>
      </> : null}
    </div>
  </article>;
}

/** Question sets in four columns of work — Todo, Doing (study), Testing (exam), Done. */
export function PreliminaryBoard({ kind = "mcq", sets, subjects, topics = [] }: { kind?: BoardKind; sets: SetRow[]; subjects: Array<{ id: string; name: string }>; topics?: TopicNode[] }) {
  const { base, title, blurb, remove } = kinds[kind];
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
  // Sets are filed under the user's subject → topic tree; the status tabs count only what the filter shows.
  const filter = useSubjectTopicFilter(subjects, topics);
  const inScope = sets.filter((set) => filter.matches(set));
  const counts = Object.fromEntries(statusOrder.map((status) => [status, inScope.filter((set) => set.status === status).length])) as Record<QuestionSetStatus, number>;
  const visible = inScope.filter((set) => set.status === active);
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
  /** "Subject › Topic" for a card; "Other" when it has no (existing) subject. */
  const placeOf = (set: SetRow) => {
    const subject = set.subjectId ? subjectNames.get(set.subjectId) : undefined;
    if (!subject) return "Other";
    const topic = set.topicId ? topicById.get(set.topicId) : undefined;
    return topic ? `${subject} › ${topicPath(topic, topics)}` : subject;
  };
  const statusHref = (status: QuestionSetStatus) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status.toLowerCase());
    return `${pathname}?${params}`;
  };

  return <div className="mx-auto max-w-4xl space-y-3">
    {/* One slim header in the home page's blue: title, merge and new, and the four stages. */}
    <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)]">
      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight tracking-tight">{title}</h1>
          <p className="truncate text-[12px] text-white/80">{blurb}</p>
        </div>
        {sets.length > 1 ? <button type="button" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting} aria-label={selecting ? "বাতিল" : "Set মেলাও"} title={selecting ? "বাতিল" : "Set মেলাও"} className={cn("flex size-10 shrink-0 items-center justify-center rounded-full ring-1 transition active:scale-95", selecting ? "bg-white text-blue-700 ring-white" : "bg-white/20 ring-white/30 hover:bg-white/30")}>{selecting ? <X className="size-4" /> : <Combine className="size-4" />}</button> : null}
        <Link href={`${base}/new`} className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-3.5 text-[13.5px] font-semibold text-blue-700 shadow-sm transition active:scale-95"><Plus className="size-4" /> নতুন</Link>
      </div>
      <div role="tablist" aria-label="Status" className="mt-2.5 grid grid-cols-4 gap-1 rounded-full bg-white/15 p-1 ring-1 ring-white/20">
        {statusOrder.map((status) => {
          const on = active === status;
          return <button
            key={status}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => router.replace(statusHref(status), { scroll: false })}
            className={cn("flex h-9 min-w-0 items-center justify-center gap-0.5 rounded-full px-0.5 text-[12px] font-semibold transition min-[360px]:gap-1 min-[360px]:text-[13px]", on ? "bg-white text-blue-700 shadow-sm" : "text-white/90")}
          >
            <span className="truncate">{statusInfo[status].label}</span>
            {counts[status] ? <span className={cn("text-[11px] tabular-nums", on ? "text-blue-500" : "text-white/70")}>{counts[status]}</span> : null}
          </button>;
        })}
      </div>
    </section>

    <SubjectTopicFilter subjects={subjects} topics={topics} items={sets} selection={filter.selection} onSelect={filter.select} matches={filter.matches} />

    {selecting ? <p className="rounded-2xl bg-blue-50 px-3 py-2 text-[12.5px] text-blue-800">যে set-গুলো এক করতে চাও সেগুলোতে চাপো — যে ক্রমে চাপবে, প্রশ্নগুলো সেই ক্রমে বসবে। অন্য tab থেকেও বাছা যায়।</p>
      : <p className={cn("flex items-center gap-1.5 px-1 text-[12.5px]", statusInfo[active].tone)}><span className={cn("size-2 shrink-0 rounded-full", statusInfo[active].dot)} aria-hidden />{statusInfo[active].hint}</p>}

    {visible.length ? <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-2.5 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-3", selecting && "pb-20")}>{visible.map((set) => selecting
      ? <SelectableCard key={set.id} set={set} place={placeOf(set)} order={picked.indexOf(set.id) + 1} onToggle={() => togglePick(set.id)} />
      : <SetCard key={set.id} kind={kind} set={set} place={placeOf(set)} onDelete={() => setDeleting(set)} />)}</div>
      : <div className="rounded-3xl bg-white px-6 py-10 text-center shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-rose-50"><ListChecks className="size-6 text-rose-500" /></span>
        <p className="font-semibold text-slate-800">{active === "TODO" ? "কোনো set নেই" : `${statusInfo[active].label}-এ এখন কিছু নেই`}</p>
        {active === "TODO" ? <Link href={`${base}/new`} className="mt-3 inline-flex h-10 items-center gap-1 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white"><Plus className="size-4" /> নতুন set বানাও</Link> : null}
      </div>}

    {selecting ? <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <p className="text-xs text-zinc-600">{pickedSets.length ? <><span className="font-semibold text-zinc-900">{pickedSets.length}টি set</span> · {pickedSets.reduce((sum, set) => sum + set.questionCount, 0)}টি প্রশ্ন</> : "অন্তত ২টা set বাছো"}</p>
        <button type="button" onClick={() => setMerging(true)} disabled={pickedSets.length < 2} className="flex h-11 items-center gap-1.5 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Combine className="size-4" /> এক করো</button>
      </div>
    </div> : null}

    {merging && pickedSets.length > 1 ? <MergeDialog kind={kind} picked={pickedSets} subjects={subjects} onClose={() => setMerging(false)} onDone={stopSelecting} /> : null}

    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>এই set মুছে ফেলবে?</AlertDialogTitle>
        <AlertDialogDescription>“{deleting?.topicName}”-এর সব প্রশ্ন আর test-এর ফল মুছে যাবে। ফেরানো যাবে না।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখো</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
            const target = deleting;
            setDeleting(null);
            if (target) void remove(target.id).then(() => { toast.success("মুছে ফেলা হলো"); router.refresh(); }).catch((error: Error) => toast.error(error.message));
          }}>মুছে ফেলো</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
