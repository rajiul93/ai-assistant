"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ClipboardPaste, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math-text";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BANK_IMPORT_BATCH, BANK_OPTION_LETTERS, chunkPastedText, parsePastedMcqs, type ChapterMcqRow, type ChapterShortRow } from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import { importChapterRows } from "@/server/actions/question-bank-general";
import { adminButton } from "./bank-admin";
import { errorMessage } from "@/lib/user-error";

type Mcq = Omit<ChapterMcqRow, "serial">;
type Short = Omit<ChapterShortRow, "serial">;
type Sorted = { kind: "mcq"; items: Mcq[] } | { kind: "short"; items: Short[] };

const MAX_TEXT = 60_000;

async function sortPiece(kind: "mcq" | "short", text: string, batch: string) {
  const response = await fetch("/api/question-bank/paste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text, batch }) });
  const payload = (await response.json().catch(() => ({}))) as { questions?: Array<Mcq | Short>; error?: string };
  if (!response.ok || !payload.questions) throw new Error(payload.error ?? "AI দিয়ে সাজানো গেল না।");
  return payload.questions;
}

/**
 * Staff on a chapter: paste MCQs or short questions copied from anywhere. MCQs in the exact pattern
 * (`parsePastedMcqs`) are sorted without AI; anything else goes to AI, which sorts it into
 * question / options / answer (word for word), the admin checks them here — picks a missing answer,
 * drops a wrong one — and only then they are saved. Duplicates already in the chapter are skipped.
 */
export function ChapterPaste({ chapterId, kind }: { chapterId: string; kind: "mcq" | "short" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sorted, setSorted] = useState<Sorted | null>(null);
  const [free, setFree] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const noun = kind === "mcq" ? "MCQ" : "Short Question";

  const missing = sorted ? (sorted.kind === "mcq" ? sorted.items.filter((item) => item.correctIndex < 0).length : sorted.items.filter((item) => !item.answer.trim()).length) : 0;

  function reset() {
    setText("");
    setSorted(null);
    setFree(false);
  }

  async function sort() {
    // Text in the exact pattern is sorted here, no AI needed; otherwise all of it goes to AI.
    if (kind === "mcq") {
      const local = parsePastedMcqs(text);
      if (local.items.length && !local.failed.length) {
        setSorted({ kind, items: local.items });
        toast.success(`ঠিক pattern — AI ছাড়াই ${local.items.length}টি সাজানো হলো`);
        return;
      }
      if (local.items.length) toast.info(`${local.failed.map((at) => at.toLocaleString("bn-BD")).join(", ")} নং প্রশ্ন pattern-এ মেলেনি — AI দিয়ে সাজানো হচ্ছে`);
    }
    const pieces = chunkPastedText(text);
    const batch = crypto.randomUUID();
    const items: Array<Mcq | Short> = [];
    setProgress({ label: "AI সাজাচ্ছে", done: 0, total: pieces.length });
    try {
      for (const [index, piece] of pieces.entries()) {
        items.push(...(await sortPiece(kind, piece, batch)));
        setProgress({ label: "AI সাজাচ্ছে", done: index + 1, total: pieces.length });
      }
    } catch (error) {
      toast.error(`${errorMessage(error, "AI থেমে গেছে")}${items.length ? ` — যতটুকু হয়েছে (${items.length}টি) দেখাচ্ছি।` : ""}`);
    } finally {
      setProgress(null);
    }
    if (!items.length) { toast.error(`লেখায় কোনো ${noun} পাওয়া যায়নি।`); return; }
    setSorted(kind === "mcq" ? { kind, items: items as Mcq[] } : { kind, items: items as Short[] });
  }

  const setMcq = (index: number, patch: Partial<Mcq>) => setSorted((current) => (current?.kind === "mcq" ? { kind: "mcq", items: current.items.map((item, at) => (at === index ? { ...item, ...patch } : item)) } : current));
  const setShort = (index: number, patch: Partial<Short>) => setSorted((current) => (current?.kind === "short" ? { kind: "short", items: current.items.map((item, at) => (at === index ? { ...item, ...patch } : item)) } : current));
  const remove = (index: number) => setSorted((current) => (current ? ({ kind: current.kind, items: current.items.filter((_, at) => at !== index) } as Sorted) : current));

  async function save() {
    if (!sorted) return;
    // Items still without an answer stay out; the admin was told how many.
    const rows = sorted.kind === "mcq"
      ? sorted.items.filter((item) => item.correctIndex >= 0).map((item, index) => ({ ...item, serial: index + 1 }))
      : sorted.items.filter((item) => item.answer.trim()).map((item, index) => ({ ...item, serial: index + 1 }));
    if (!rows.length) { toast.error("সঠিক উত্তরসহ কোনো প্রশ্ন নেই।"); return; }
    let created = 0, skipped = 0;
    setProgress({ label: "সেভ হচ্ছে", done: 0, total: rows.length });
    try {
      for (let start = 0; start < rows.length; start += BANK_IMPORT_BATCH) {
        const part = rows.slice(start, start + BANK_IMPORT_BATCH);
        const result = sorted.kind === "mcq"
          ? await importChapterRows({ kind: "mcq", chapterId, free, rows: part as ChapterMcqRow[] })
          : await importChapterRows({ kind: "short", chapterId, free, rows: part as ChapterShortRow[] });
        created += result.created;
        skipped += result.skipped;
        setProgress({ label: "সেভ হচ্ছে", done: Math.min(start + part.length, rows.length), total: rows.length });
      }
      toast.success(`${created}টি ${noun} যোগ হলো${skipped ? ` · ${skipped}টি আগেই ছিল` : ""}`);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(`${errorMessage(error, "সেভ থেমে গেছে")} — ${created}টি যোগ হয়েছে।`);
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-zinc-400";

  return <>
    <button type="button" onClick={() => setOpen(true)} className={adminButton}><ClipboardPaste className="size-4" /> Paste</button>
    <Dialog open={open} onOpenChange={(next) => { if (!progress) setOpen(next); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{noun} paste করো</DialogTitle></DialogHeader>

        {!sorted ? <div className="space-y-3">
          <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-950">
            {kind === "mcq"
              ? <>নিচের নমুনার মতো লিখলে (প্রশ্ন, ক–ঘ/ঙ option, <b>উত্তর:</b>, চাইলে <b>সমাধান:</b> আর <b>ব্যাখ্যা:</b> — একাধিক লাইনও চলবে) AI ছাড়াই সাজানো হবে। অন্যভাবে কপি করা লেখা AI সাজিয়ে দেবে। সেভের আগে দেখে নিতে পারবে।</>
              : "বই, PDF বা ওয়েবসাইট থেকে যেভাবে কপি হয় সেভাবেই paste করো — AI প্রশ্ন আর উত্তর আলাদা করে সাজিয়ে দেবে। সেভের আগে দেখে নিতে পারবে।"}
          </p>
          <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT))} rows={12} autoFocus aria-label="Paste করা লেখা"
            placeholder={kind === "mcq" ? "১. ‘পরমেশ’ শব্দের সন্ধি বিচ্ছেদ কোনটি?\nক) পরম + এশ  খ) পরম + ঈশ  গ) পরম + ইশ  ঘ) পরম + ঈশা\nউত্তর: খ\nসমাধান: পরম + ঈশ = পরমেশ (অ + ঈ = এ)\nব্যাখ্যা: এটি স্বরসন্ধির উদাহরণ।\n\n২. …" : "১. বাংলা ভাষার আদি নিদর্শন কী?\nউত্তর: চর্যাপদ\n\n২. …"}
            className={cn(field, "font-mono text-[13px]")} />
          <p className="text-right text-xs text-zinc-400 tabular-nums">{text.length.toLocaleString("bn-BD")} / {MAX_TEXT.toLocaleString("bn-BD")}</p>
          {progress ? <Progress {...progress} /> : null}
          <button type="button" disabled={!text.trim() || Boolean(progress)} onClick={() => void sort()} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-violet-700 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
            {progress ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {kind === "mcq" ? "সাজাও" : "AI দিয়ে সাজাও"}
          </button>
        </div> : <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" disabled={Boolean(progress)} onClick={() => setSorted(null)} className="flex h-9 items-center gap-1 rounded-lg px-2.5 font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"><ArrowLeft className="size-4" /> লেখায় ফেরো</button>
            <span className="font-semibold text-emerald-700">{sorted.items.length}টি পাওয়া গেছে</span>
          </div>
          {missing ? <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {missing}টিতে উত্তর নেই — {kind === "mcq" ? "সঠিক option-এ চাপো" : "উত্তর লিখে দাও"}, নইলে সেগুলো বাদ যাবে।</p> : null}

          <ol className="max-h-[50dvh] space-y-2 overflow-y-auto pr-1">
            {sorted.kind === "mcq" ? sorted.items.map((item, index) => <li key={index} className={cn("rounded-xl border p-3", item.correctIndex < 0 ? "border-amber-300 bg-amber-50/40" : "border-zinc-200")}>
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed"><span className="mr-1 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={item.text} book /></p>
                <button type="button" onClick={() => remove(index)} aria-label={`প্রশ্ন ${index + 1} বাদ দাও`} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button>
              </div>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {item.options.map((option, optionIndex) => {
                  const right = item.correctIndex === optionIndex;
                  return <li key={optionIndex}><button type="button" onClick={() => setMcq(index, { correctIndex: optionIndex })} aria-pressed={right}
                    className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm", right ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-900" : "border-zinc-200 hover:bg-zinc-50")}>
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", right ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600")}>{right ? <Check className="size-3" strokeWidth={3} /> : BANK_OPTION_LETTERS[optionIndex]}</span>
                    <MathText text={option} book />
                  </button></li>;
                })}
              </ul>
              {item.solution || item.explanation ? <p className="mt-2 text-xs text-zinc-500">{[item.solution && "সমাধান আছে", item.explanation && "ব্যাখ্যা আছে"].filter(Boolean).join(" · ")}</p> : null}
            </li>) : sorted.items.map((item, index) => <li key={index} className={cn("rounded-xl border p-3", !item.answer.trim() ? "border-amber-300 bg-amber-50/40" : "border-zinc-200")}>
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium leading-relaxed"><span className="mr-1 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={item.question} book /></p>
                <button type="button" onClick={() => remove(index)} aria-label={`প্রশ্ন ${index + 1} বাদ দাও`} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button>
              </div>
              <textarea value={item.answer} onChange={(event) => setShort(index, { answer: event.target.value.slice(0, 4000) })} rows={2} placeholder="উত্তর" aria-label={`প্রশ্ন ${index + 1}-এর উত্তর`} className={cn(field, "mt-2")} />
            </li>)}
          </ol>

          <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm">
            <input type="checkbox" checked={free} onChange={(event) => setFree(event.target.checked)} className="size-4 accent-emerald-600" />
            <span><span className="font-medium">Free</span> — plan ছাড়াই সবাই দেখতে পারবে (না দিলে Paid)</span>
          </label>
          {progress ? <Progress {...progress} /> : null}
          <button type="button" disabled={Boolean(progress) || sorted.items.length === missing} onClick={() => void save()} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {progress ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {sorted.items.length - missing}টি সেভ করো
          </button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}

function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  return <div className="space-y-1">
    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
    <p className="text-xs text-zinc-500">{label}… {done}/{total} — পাতা বন্ধ করো না</p>
  </div>;
}
