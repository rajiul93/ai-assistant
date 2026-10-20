"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math-text";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createPaperSet, getPickableQuestions } from "@/server/actions/preliminary";
import { errorMessage } from "@/lib/user-error";

type PickSet = { id: string; topicName: string; questionCount: number; place: string };
type Pickable = Awaited<ReturnType<typeof getPickableQuestions>>[number];

const MAX = 300;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400";

/**
 * "প্রশ্নপত্র বানাও": every Preliminary set, opened one at a time to tick questions (a set's own
 * checkbox ticks all of it), then a title, date and short description → a new set whose paper
 * page shows the questions beside an answer key. The picked order is set order, then position.
 */
export function PaperBuilder({ sets, startSetId, onClose }: { sets: PickSet[]; startSetId?: string; onClose: () => void }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Record<string, Pickable[]>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(startSetId ?? null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();

  async function load(setId: string) {
    if (loaded[setId]) return loaded[setId];
    setLoading(setId);
    try {
      const questions = await getPickableQuestions(setId);
      setLoaded((current) => ({ ...current, [setId]: questions }));
      return questions;
    } catch (error) {
      toast.error(errorMessage(error, "প্রশ্ন আনা গেল না।"));
      return null;
    } finally {
      setLoading(null);
    }
  }

  // The set the dialog was opened from starts open, its questions fetched right away.
  useEffect(() => {
    if (!startSetId) return;
    let live = true;
    getPickableQuestions(startSetId)
      .then((questions) => { if (live) setLoaded((current) => ({ ...current, [startSetId]: questions })); })
      .catch((error: unknown) => toast.error(errorMessage(error, "প্রশ্ন আনা গেল না।")));
    return () => { live = false; };
  }, [startSetId]);

  function toggleOpen(setId: string) {
    setOpen((current) => (current === setId ? null : setId));
    void load(setId);
  }

  async function toggleSet(setId: string) {
    const questions = await load(setId);
    if (!questions) return;
    const all = questions.every((question) => picked.has(question.id));
    setPicked((current) => {
      const next = new Set(current);
      for (const question of questions) {
        if (all) next.delete(question.id);
        else next.add(question.id);
      }
      return next;
    });
  }

  const toggleQuestion = (id: string) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const ordered = sets.flatMap((set) => (loaded[set.id] ?? []).filter((question) => picked.has(question.id)).map((question) => question.id));
  const shown = query.trim() ? sets.filter((set) => `${set.topicName} ${set.place}`.toLowerCase().includes(query.trim().toLowerCase())) : sets;

  const submit = () => start(async () => {
    try {
      const id = await createPaperSet({ questionIds: ordered, title, date, description });
      toast.success(`প্রশ্নপত্র বানানো হলো — ${ordered.length}টি প্রশ্ন, Todo-তেও আছে`);
      onClose();
      router.push(`/preliminary/${id}/paper`);
    } catch (error) {
      toast.error(errorMessage(error, "প্রশ্নপত্র বানানো গেল না।"));
    }
  });

  return <Dialog open onOpenChange={(next) => !next && !pending && onClose()}>
    <DialogContent className="flex max-h-[92dvh] flex-col gap-3 sm:max-w-2xl">
      <DialogHeader><DialogTitle>প্রশ্নপত্র বানাও</DialogTitle></DialogHeader>
      <p className="text-[12.5px] text-zinc-600">যেকোনো set খুলে প্রশ্ন বাছো (set-এর পাশের ঘরে চাপলে পুরো set)। নতুন set-এ প্রশ্নগুলো এখানকার ক্রমে বসবে, পাশে থাকবে answer key।</p>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Set খোঁজো" aria-label="Set খোঁজো" className={cn(field, "h-10 pl-9")} />
      </label>

      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {shown.map((set) => {
          const questions = loaded[set.id];
          const count = questions ? questions.filter((question) => picked.has(question.id)).length : 0;
          const all = Boolean(questions?.length) && count === questions!.length;
          const expanded = open === set.id;
          const busy = loading === set.id || (expanded && !questions && set.questionCount > 0);
          return <li key={set.id} className="rounded-xl border border-zinc-200">
            <div className="flex items-center gap-2 px-2.5 py-2">
              <input type="checkbox" checked={all} ref={(input) => { if (input) input.indeterminate = count > 0 && !all; }} disabled={!set.questionCount || busy} onChange={() => void toggleSet(set.id)} aria-label={`${set.topicName}-এর সব প্রশ্ন`} className="size-4 shrink-0 accent-blue-600" />
              <button type="button" onClick={() => toggleOpen(set.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-blue-600">{set.place}</span>
                  <span className="block truncate text-sm font-semibold text-zinc-900">{set.topicName}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">{count ? <span className="font-semibold text-blue-700">{count}/</span> : null}{set.questionCount}টি</span>
                {busy ? <Loader2 className="size-4 shrink-0 animate-spin text-zinc-400" /> : <ChevronDown className={cn("size-4 shrink-0 text-zinc-400 transition", expanded && "rotate-180")} />}
              </button>
            </div>
            {expanded && questions ? <ol className="space-y-1 border-t border-zinc-100 px-2.5 py-2">
              {questions.map((question, index) => <li key={question.id}>
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1.5 text-sm hover:bg-zinc-50", picked.has(question.id) && "bg-blue-50/60")}>
                  <input type="checkbox" checked={picked.has(question.id)} onChange={() => toggleQuestion(question.id)} className="mt-0.5 size-4 shrink-0 accent-blue-600" />
                  <span className="min-w-0 flex-1 leading-relaxed"><span className="mr-1 text-xs tabular-nums text-zinc-400">{index + 1}.</span><MathText text={question.text} book /></span>
                </label>
              </li>)}
            </ol> : null}
          </li>;
        })}
        {!shown.length ? <li className="py-6 text-center text-sm text-zinc-500">কোনো set মেলেনি</li> : null}
      </ul>

      <div className="space-y-2.5 border-t border-zinc-100 pt-3">
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <label className="block space-y-1"><span className="text-xs font-medium text-zinc-600">Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="যেমন: Model Test ১ — গণিত" className={cn(field, "h-10")} /></label>
          <label className="block space-y-1"><span className="text-xs font-medium text-zinc-600">তারিখ</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={cn(field, "h-10")} /></label>
        </div>
        <label className="block space-y-1"><span className="text-xs font-medium text-zinc-600">Short description <span className="text-zinc-400">(ইচ্ছে হলে)</span></span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={2} placeholder="যেমন: সময় ৩০ মিনিট · প্রতিটি প্রশ্নে ১ নম্বর" className={cn(field, "py-2 leading-relaxed")} />
        </label>
        {ordered.length > MAX ? <p className="text-xs font-medium text-red-600">একটা set-এ সর্বোচ্চ {MAX}টি প্রশ্ন রাখা যায় — এখন {ordered.length}টি বাছা।</p> : null}
        <button type="button" onClick={submit} disabled={pending || !ordered.length || ordered.length > MAX || !title.trim() || !date} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} {ordered.length ? `${ordered.length}টি প্রশ্নে প্রশ্নপত্র বানাও` : "প্রশ্ন বাছো"}
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}
