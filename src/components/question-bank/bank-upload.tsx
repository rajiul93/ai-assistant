"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime } from "@/lib/dayjs";
import { BANK_EXAMS, BANK_IMPORT_BATCH, checkRow, FIELD_LABELS, isBlankRow, mapColumns, type BankField, type BankRow, type CheckedRow } from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import { deleteBankSet, importBankRows, type listAllBankSets } from "@/server/actions/question-bank";

type Checked = { fileName: string; sheet: string; sheets: string[]; file: File; missing: BankField[]; rows: CheckedRow[] };
type Progress = { done: number; total: number; created: number; updated: number; unchanged: number; failed?: string };

const examLabel = (id: string) => BANK_EXAMS.find((exam) => exam.id === id)?.label ?? id;

/** The header is usually row 1, but a title row above it is common; look a few rows down. */
function findHeader(rows: unknown[][]) {
  for (let index = 0; index < Math.min(rows.length, 10); index++) {
    const { map, missing } = mapColumns(rows[index].map((value) => String(value ?? "")));
    if (!missing.length) return { index, map, missing };
  }
  const first = mapColumns((rows[0] ?? []).map((value) => String(value ?? "")));
  return { index: 0, ...first };
}

async function readSheet(file: File, sheet?: string): Promise<Checked> {
  const { default: readXlsxFile, readSheetNames } = await import("read-excel-file");
  const sheets = await readSheetNames(file);
  const name = sheet ?? sheets[0];
  const rows = (await readXlsxFile(file, { sheet: name })) as unknown[][];
  const header = findHeader(rows);
  if (header.missing.length) return { fileName: file.name, sheet: name, sheets, file, missing: header.missing, rows: [] };
  const checked = rows.slice(header.index + 1)
    .map((cells, offset) => ({ cells, line: header.index + offset + 2 }))
    .filter(({ cells }) => !isBlankRow(cells))
    .map(({ cells, line }) => checkRow(cells, header.map, line));
  return { fileName: file.name, sheet: name, sheets, file, missing: [], rows: checked };
}

/** Super admin: read a sheet in the browser, check every row, then upload in batches. */
export function BankUpload({ sets }: { sets: Awaited<ReturnType<typeof listAllBankSets>> }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Checked | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [deleting, setDeleting] = useState<(typeof sets)[number] | null>(null);
  const uploading = Boolean(progress && progress.done < progress.total && !progress.failed);

  async function open(file: File, sheet?: string) {
    setReading(true);
    setProgress(null);
    try {
      setChecked(await readSheet(file, sheet));
    } catch {
      toast.error("ফাইলটা পড়া গেল না। Google Sheets থেকে File → Download → Microsoft Excel (.xlsx) দিয়ে নামিয়ে দিন।");
      setChecked(null);
    } finally {
      setReading(false);
    }
  }

  const ready = (checked?.rows ?? []).map((row) => row.row).filter((row): row is BankRow => row !== null);
  const errors = (checked?.rows ?? []).filter((row) => row.errors.length);
  const warnings = (checked?.rows ?? []).filter((row) => row.row && row.warnings.length);
  const skipped = (checked?.rows ?? []).filter((row) => row.skipped);
  const setCount = new Set(ready.map((row) => `${row.exam}|${row.section}|${row.session}`)).size;

  async function upload() {
    const total = ready.length;
    let state: Progress = { done: 0, total, created: 0, updated: 0, unchanged: 0 };
    setProgress(state);
    for (let start = 0; start < total; start += BANK_IMPORT_BATCH) {
      const batch = ready.slice(start, start + BANK_IMPORT_BATCH);
      try {
        const result = await importBankRows(batch);
        state = { ...state, done: start + batch.length, created: state.created + result.created, updated: state.updated + result.updated, unchanged: state.unchanged + result.unchanged };
        setProgress(state);
      } catch (error) {
        // Uploading is idempotent: running it again picks up where it stopped without duplicates.
        setProgress({ ...state, failed: error instanceof Error ? error.message : "আপলোড থেমে গেছে" });
        toast.error("আপলোড মাঝপথে থেমেছে — আবার চাপলে বাকিটা যাবে, কিছু দুবার হবে না।");
        return;
      }
    }
    toast.success(`আপলোড শেষ — নতুন ${state.created}, আপডেট ${state.updated}`);
    router.refresh();
  }

  const stat = (label: string, value: number, tone: string) => <div className={cn("rounded-xl px-3 py-2.5", tone)}><p className="text-xs">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>;

  return <div className="mx-auto max-w-3xl space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">প্রশ্ন ব্যাংক — আপলোড</h1>
      <p className="mt-1 text-sm text-zinc-500">Sheet-এর প্রতিটা সেশন একটা set হয়। একই sheet আবার দিলে প্রশ্ন দুবার হয় না, বদলানো প্রশ্ন আপডেট হয়।</p>
    </div>

    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition", reading ? "border-zinc-200" : "border-zinc-300 hover:border-zinc-400")}>
        {reading ? <Loader2 className="size-7 animate-spin text-zinc-400" /> : <FileSpreadsheet className="size-7 text-emerald-600" />}
        <span className="text-sm font-medium">{checked ? checked.fileName : ".xlsx ফাইল বেছে নিন"}</span>
        <span className="text-xs text-zinc-500">Google Sheets: File → Download → Microsoft Excel (.xlsx)। ফাইল এখনই কোথাও যায় না — আগে এখানে মিলিয়ে দেখা হয়।</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={reading || uploading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void open(file); }} />
      </label>

      {checked && checked.sheets.length > 1 ? <label className="flex items-center gap-2 text-sm">
        <span className="text-zinc-600">Sheet:</span>
        <select value={checked.sheet} disabled={reading || uploading} onChange={(event) => void open(checked.file, event.target.value)} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
          {checked.sheets.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label> : null}

      {checked?.missing.length ? <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />এই কলামগুলো পাওয়া যায়নি: {checked.missing.map((field) => FIELD_LABELS[field]).join(", ")}। প্রথম সারিতে কলামের নাম আছে কি না দেখুন।</p> : null}

      {checked && !checked.missing.length ? <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat("প্রশ্ন (আপলোড হবে)", ready.length, "bg-emerald-50 text-emerald-900")}
          {stat("set", setCount, "bg-sky-50 text-sky-900")}
          {stat("ভুল (বাদ যাবে)", errors.length, errors.length ? "bg-red-50 text-red-900" : "bg-zinc-50 text-zinc-700")}
          {stat("সতর্কতা", warnings.length, warnings.length ? "bg-amber-50 text-amber-900" : "bg-zinc-50 text-zinc-700")}
        </div>
        {skipped.length ? <p className="text-xs text-zinc-500">{skipped.length}টি সারি MCQ নয়, তাই বাদ।</p> : null}

        {errors.length || warnings.length ? <div className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 text-sm">
          {[...errors, ...warnings].slice(0, 200).map((row) => <p key={row.line} className="flex gap-3 px-3 py-2">
            <span className={cn("w-16 shrink-0 font-medium tabular-nums", row.errors.length ? "text-red-700" : "text-amber-700")}>সারি {row.line}</span>
            <span className="min-w-0 text-zinc-600">{[...row.errors, ...row.warnings].join(" · ")}</span>
          </p>)}
        </div> : null}

        {progress ? <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className={cn("h-full rounded-full transition-all", progress.failed ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
          <p className="text-xs text-zinc-600">{progress.done}/{progress.total} · নতুন {progress.created} · আপডেট {progress.updated} · আগের মতোই {progress.unchanged}{progress.failed ? <span className="text-red-700"> · থেমেছে: {progress.failed}</span> : null}</p>
        </div> : null}

        <button type="button" onClick={() => void upload()} disabled={!ready.length || uploading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {progress?.failed ? "বাকিটা আবার পাঠাও" : `${ready.length}টি প্রশ্ন আপলোড করো`}
        </button>
      </> : null}
    </section>

    <section className="space-y-2">
      <h2 className="font-semibold">ব্যাংকে থাকা set ({sets.length})</h2>
      {sets.length ? <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {sets.map((set) => <div key={set.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-indigo-600">{examLabel(set.exam)} · {set.section}</p>
            <p className="truncate font-medium">{set.name}</p>
            <p className="text-xs text-zinc-500">{set.questionCount}টি প্রশ্ন · {set.copyCount} জন পাঠিয়েছে · {formatDateTime(set.updatedAt)}</p>
          </div>
          <button type="button" onClick={() => setDeleting(set)} aria-label={`${set.name} মুছে ফেলো`} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
        </div>)}
      </div> : <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">এখনো কোনো set নেই।</p>}
    </section>

    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>“{deleting?.name}” ব্যাংক থেকে মুছবেন?</AlertDialogTitle>
        <AlertDialogDescription>এর {deleting?.questionCount}টি প্রশ্ন ব্যাংক থেকে চলে যাবে। যারা আগেই Preliminary-তে পাঠিয়েছে, তাদের কপি থেকে যাবে।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখো</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
            const target = deleting;
            setDeleting(null);
            if (target) void deleteBankSet(target.id).then(() => { toast.success("মুছে ফেলা হলো"); router.refresh(); }).catch((error: Error) => toast.error(error.message));
          }}>মুছে ফেলো</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
