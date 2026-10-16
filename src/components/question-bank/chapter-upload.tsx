"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BANK_IMPORT_BATCH, checkChapterMcqRow, checkChapterShortRow, FIELD_LABELS, isBlankRow, mapChapterColumns,
  type ChapterMcqRow, type ChapterSheetKind, type ChapterShortRow, type CheckedChapterRow,
} from "@/lib/question-bank";
import { importChapterRows } from "@/server/actions/question-bank-general";
import { adminButton } from "./bank-admin";

type Read = { fileName: string; missing: string[]; rows: Array<CheckedChapterRow<ChapterMcqRow | ChapterShortRow>> };

/** The first of the top rows that names every needed column is the header (sheets often have a title row above it). */
async function readChapterSheet(file: File, kind: ChapterSheetKind): Promise<Read> {
  const { default: readXlsxFile } = await import("read-excel-file");
  const raw = (await readXlsxFile(file)) as unknown[][];
  let best = { index: 0, ...mapChapterColumns((raw[0] ?? []).map((cell) => String(cell ?? "")), kind) };
  for (let index = 0; index < Math.min(raw.length, 10); index++) {
    const found = mapChapterColumns(raw[index].map((cell) => String(cell ?? "")), kind);
    if (found.missing.length < best.missing.length) best = { index, ...found };
    if (!found.missing.length) break;
  }
  if (best.missing.length) return { fileName: file.name, missing: best.missing.map((field) => (field === "answer" ? "উত্তর" : FIELD_LABELS[field])), rows: [] };
  const check = kind === "mcq" ? checkChapterMcqRow : checkChapterShortRow;
  const rows = raw.slice(best.index + 1)
    .map((cells, offset) => ({ cells, line: best.index + offset + 2 }))
    .filter(({ cells }) => !isBlankRow(cells))
    .map(({ cells, line }) => check(cells, best.map, line));
  return { fileName: file.name, missing: [], rows };
}

/**
 * Staff: a chapter's MCQs or short questions from an Excel sheet. Checked in the browser first;
 * questions already in the chapter (same wording) are skipped, so the same sheet can go up again.
 */
export function ChapterUpload({ chapterId, kind }: { chapterId: string; kind: ChapterSheetKind }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const valid = read?.rows.flatMap((item) => (item.row ? [item.row] : [])) ?? [];
  const bad = read?.rows.filter((item) => !item.row) ?? [];

  async function pick(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try { setRead(await readChapterSheet(file, kind)); } catch { toast.error("ফাইলটা পড়া গেল না — .xlsx ফাইল দাও।"); } finally { setReading(false); }
  }

  async function upload() {
    let created = 0, skipped = 0;
    setProgress({ done: 0, total: valid.length });
    try {
      for (let start = 0; start < valid.length; start += BANK_IMPORT_BATCH) {
        const rows = valid.slice(start, start + BANK_IMPORT_BATCH);
        const result = kind === "mcq"
          ? await importChapterRows({ kind, chapterId, rows: rows as ChapterMcqRow[] })
          : await importChapterRows({ kind, chapterId, rows: rows as ChapterShortRow[] });
        created += result.created;
        skipped += result.skipped;
        setProgress({ done: Math.min(start + rows.length, valid.length), total: valid.length });
      }
      toast.success(`${created}টি যোগ হলো${skipped ? ` · ${skipped}টি আগেই ছিল` : ""}`);
      setOpen(false);
      setRead(null);
    } catch (error) {
      toast.error(`${error instanceof Error ? error.message : "আপলোড থেমে গেছে"} — ${created}টি যোগ হয়েছে।`);
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  const columns = kind === "mcq" ? "প্রশ্ন, ক, খ, গ, ঘ, (অতিরিক্ত অপশন), সঠিক উত্তর (ক/খ/গ/ঘ), সমাধান, ব্যাখ্যা, ক্রম" : "প্রশ্ন, উত্তর, ক্রম";

  return <>
    <button type="button" onClick={() => setOpen(true)} className={adminButton}><FileSpreadsheet className="size-4" /> Excel</button>
    <Dialog open={open} onOpenChange={(next) => { if (!progress) { setOpen(next); if (!next) setRead(null); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{kind === "mcq" ? "MCQ" : "Short Question"} — Excel থেকে</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-zinc-600">কলাম: {columns}। প্রথম সারিতে কলামের নাম থাকবে। নতুনগুলো Paid হিসেবে যোগ হবে।</p>
          <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50">
            {reading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
            <span>{read?.fileName ?? ".xlsx ফাইল বাছো"}</span>
            <input type="file" accept=".xlsx" className="sr-only" onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {read?.missing.length ? <p className="rounded-xl bg-red-50 px-3 py-2 text-red-800">এই কলামগুলো পাওয়া যায়নি: {read.missing.join(", ")}</p> : null}
          {read && !read.missing.length ? <div className="space-y-2">
            <p><span className="font-semibold text-emerald-700">{valid.length}টি ঠিক আছে</span>{bad.length ? <span className="text-red-700"> · {bad.length}টিতে সমস্যা (বাদ যাবে)</span> : null}</p>
            {bad.length ? <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
              {bad.slice(0, 30).map((item) => <li key={item.line}>সারি {item.line}: {item.errors.join(", ")}</li>)}
            </ul> : null}
          </div> : null}
          {progress ? <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div> : null}
          <button type="button" disabled={!valid.length || Boolean(progress)} onClick={() => void upload()} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {progress ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {valid.length ? `${valid.length}টি আপলোড করো` : "আপলোড করো"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
