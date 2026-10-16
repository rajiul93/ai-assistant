"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, CopyCheck, FolderPlus, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math-text";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { bankSetQuestionIds, createBankChapter, listBankSubjects, listChapterTargets, moveQuestionsToChapter } from "@/server/actions/question-bank-general";
import { errorMessage } from "@/lib/user-error";

export type MoveSource = { kind: "set"; setId: string; name: string } | { kind: "questions"; ids: string[] };

type Brief = { id: string; text: string; answer: string };
type Checked = Brief & { duplicateOf: Brief | null; exact: boolean };
type Target = { id: string; label: string; newIn?: string };

const PER_CALL = 25;

async function checkPart(chapterId: string, questionIds: string[], batch: string): Promise<Checked[]> {
  const response = await fetch("/api/question-bank/duplicates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapterId, questionIds, batch }) });
  const payload = (await response.json().catch(() => ({}))) as { results?: Checked[]; error?: string };
  if (!response.ok || !payload.results) throw new Error(payload.error ?? "মিলিয়ে দেখা গেল না।");
  return payload.results;
}

/**
 * Staff: MCQs from a past-year set (the whole set) or single questions into a General chapter.
 * Before anything moves, every question is checked against the chapter — word-for-word copies, and
 * by AI the same question worded differently. Duplicates are left out unless the admin keeps one.
 * A whole set is removed once its questions are in the chapter.
 */
export function MoveToChapter({ source, onClose, onMoved }: { source: MoveSource | null; onClose: () => void; onMoved?: (movedIds: string[]) => void }) {
  const router = useRouter();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [query, setQuery] = useState("");
  const [chapter, setChapter] = useState<Target | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [checked, setChecked] = useState<Checked[] | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const isSet = source?.kind === "set";

  useEffect(() => {
    if (!source) return;
    let live = true;
    // A whole set can also start a new chapter (named after it) under any subject.
    Promise.all([listChapterTargets(), source.kind === "set" ? listBankSubjects() : Promise.resolve(null)])
      .then(([chapters, subjects]) => {
        if (!live) return;
        const fresh = subjects?.subjects.map((subject) => ({ id: `new:${subject.id}`, label: `${subject.name} › নতুন chapter: ${source.kind === "set" ? source.name : ""}`, newIn: subject.id })) ?? [];
        setTargets([...chapters, ...fresh]);
      })
      .catch(() => toast.error("Chapter-এর তালিকা আনা গেল না।"));
    return () => { live = false; };
  }, [source]);

  const busy = Boolean(progress) || moving;
  const duplicates = checked?.filter((item) => item.duplicateOf) ?? [];
  const toMove = checked?.filter((item) => !item.duplicateOf || keep.has(item.id)) ?? [];

  async function pick(target: Target) {
    if (!source) return;
    try {
      let chapterId = target.id;
      let label = target.label;
      if (target.newIn && source.kind === "set") {
        chapterId = (await createBankChapter(target.newIn, source.name.slice(0, 120))).id;
        label = target.label.replace(" › নতুন chapter: ", " › ");
      }
      setChapter({ id: chapterId, label });
      const ids = source.kind === "set" ? await bankSetQuestionIds(source.setId) : source.ids;
      if (!ids.length) { toast.error("এখানে কোনো প্রশ্ন নেই।"); return; }
      const batch = crypto.randomUUID();
      const results: Checked[] = [];
      setProgress({ done: 0, total: ids.length });
      for (let start = 0; start < ids.length; start += PER_CALL) {
        const part = ids.slice(start, start + PER_CALL);
        results.push(...(await checkPart(chapterId, part, batch)));
        setProgress({ done: Math.min(start + part.length, ids.length), total: ids.length });
      }
      setChecked(results);
    } catch (error) {
      toast.error(errorMessage(error, "মিলিয়ে দেখা গেল না।"));
      setChapter(null);
    } finally {
      setProgress(null);
    }
  }

  async function move() {
    if (!source || !chapter || !checked) return;
    setMoving(true);
    try {
      const ids = toMove.map((item) => item.id);
      const result = await moveQuestionsToChapter({ ids, chapterId: chapter.id, removeSetId: source.kind === "set" ? source.setId : null });
      toast.success(`${result.moved}টি প্রশ্ন ${chapter.label}-এ গেল${checked.length - ids.length + result.skipped ? ` · ${checked.length - ids.length + result.skipped}টি আগেই ছিল, বাদ` : ""}`, {
        action: { label: "দেখো", onClick: () => router.push(result.href) },
      });
      onMoved?.(ids);
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "সরানো গেল না।"));
    } finally {
      setMoving(false);
    }
  }

  const shown = (targets ?? []).filter((target) => target.label.toLowerCase().includes(query.trim().toLowerCase()));

  return <Dialog open={Boolean(source)} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader><DialogTitle>{isSet ? "পুরো set একটা chapter-এ সরাও" : "Chapter-এ সরাও"}</DialogTitle></DialogHeader>

      {!chapter ? <div className="space-y-3">
        <p className="text-sm text-zinc-600">সরানোর আগে প্রতিটা প্রশ্ন chapter-এর প্রশ্নের সাথে মিলিয়ে দেখা হবে (হুবহু, আর AI দিয়ে একই অর্থের) — আগে থেকে থাকলে বাদ যাবে।{isSet ? " সব সরানোর পরে set-টা বিগত বছরের তালিকা থেকে সরে যাবে।" : ""}</p>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chapter খুঁজুন" aria-label="Chapter খুঁজুন" className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
        </label>
        {!targets ? <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> লোড হচ্ছে…</p>
          : shown.length ? <ul className="max-h-[50dvh] divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200">
            {shown.map((target) => <li key={target.id}>
              <button type="button" onClick={() => void pick(target)} className={cn("flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-zinc-50", target.newIn && "text-violet-800")}>
                {target.newIn ? <FolderPlus className="size-4 shrink-0" /> : null}{target.label}
              </button>
            </li>)}
          </ul> : <p className="py-8 text-center text-sm text-zinc-500">কোনো chapter নেই — General-এ আগে একটা chapter বানাও।</p>}
      </div> : !checked ? <div className="space-y-3 py-4">
        <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin text-violet-600" /> {chapter.label}-এর প্রশ্নের সাথে মিলিয়ে দেখছি…</p>
        {progress ? <>
          <div className="h-1.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          <p className="text-xs text-zinc-500">{progress.done}/{progress.total} — পাতা বন্ধ করো না</p>
        </> : null}
      </div> : <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {isSet ? null : <button type="button" disabled={busy} onClick={() => { setChapter(null); setChecked(null); setKeep(new Set()); }} className="flex h-9 items-center gap-1 rounded-lg px-2.5 font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"><ArrowLeft className="size-4" /> অন্য chapter</button>}
          <span className="font-medium">→ {chapter.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-emerald-900"><p className="text-2xl font-semibold tabular-nums">{checked.length - duplicates.length}</p><p className="text-xs">নতুন — যাবে</p></div>
          <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-amber-950"><p className="text-2xl font-semibold tabular-nums">{duplicates.length}</p><p className="text-xs">আগেই আছে — বাদ</p></div>
        </div>

        {duplicates.length ? <>
          <p className="flex items-start gap-2 text-sm text-zinc-600"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /> AI ভুলও করতে পারে — আসলে আলাদা হলে &quot;তবুও আনো&quot;-তে টিক দাও।</p>
          <ul className="max-h-[42dvh] space-y-2 overflow-y-auto pr-1">
            {duplicates.map((item) => <li key={item.id} className={cn("rounded-xl border p-3 text-sm", keep.has(item.id) ? "border-emerald-300 bg-emerald-50/40" : "border-amber-200 bg-amber-50/30")}>
              <p className="text-xs font-semibold text-zinc-500">আনতে চাওয়া প্রশ্ন</p>
              <p className="leading-relaxed"><MathText text={item.text} book /> <span className="text-emerald-700">— <MathText text={item.answer} book /></span></p>
              <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-zinc-500"><CopyCheck className="size-3.5" /> Chapter-এ আগে থেকে {item.exact ? "(হুবহু)" : "(একই অর্থ — AI)"}</p>
              <p className="leading-relaxed text-zinc-700"><MathText text={item.duplicateOf!.text} book /> <span className="text-emerald-700">— <MathText text={item.duplicateOf!.answer} book /></span></p>
              {item.exact ? null : <label className="mt-2 flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={keep.has(item.id)} onChange={() => setKeep((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className="size-4 accent-emerald-600" /> তবুও আনো (আলাদা প্রশ্ন)
              </label>}
            </li>)}
          </ul>
        </> : <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><Check className="size-4" /> কোনো প্রশ্ন chapter-এ আগে থেকে নেই।</p>}

        <button type="button" disabled={busy || (!toMove.length && !isSet)} onClick={() => void move()} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {moving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {toMove.length ? `${toMove.length}টি সরাও` : "কিছুই নতুন নেই"}{isSet ? (toMove.length ? " · set সরে যাবে" : " — set মুছে ফেলো") : ""}
        </button>
      </div>}
    </DialogContent>
  </Dialog>;
}
