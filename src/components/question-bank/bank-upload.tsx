"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
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
import {
  BANK_CHECK_BATCH, BANK_EDITED, BANK_EXAMS, BANK_IMPORT_BATCH, checkRow, FIELD_LABELS, isBlankRow, mapColumns, questionFingerprint, repeatsInFile, rowContentHash, rowSetKey,
  type BankField, type BankRow, type CheckedRow,
} from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import { checkBankRows, deleteBankSets, importBankRows, type listAllBankSets } from "@/server/actions/question-bank";

type BankSetRow = Awaited<ReturnType<typeof listAllBankSets>>[number];
/** What uploading a row would do: add it, update it, nothing (already there), or nothing because an admin edited it in the app. */
type Fate = "new" | "changed" | "same" | "edited";
type Sorted = { line: number; row: BankRow; fate: Fate };
type Checked = { fileName: string; sheet: string; sheets: string[]; file: File; missing: BankField[]; rows: CheckedRow[]; repeats: Map<number, number>; sorted: Sorted[] };
type Progress = { done: number; total: number; created: number; updated: number; failed?: string };

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

/** Asks the server which of these questions the bank already has, and compares what's stored. */
async function sortAgainstBank(rows: Array<{ line: number; row: BankRow }>): Promise<Sorted[]> {
  const keyed = rows.map((item) => ({ ...item, print: questionFingerprint(item.row.text, item.row.options) }));
  const stored: Record<string, string> = {};
  for (let start = 0; start < keyed.length; start += BANK_CHECK_BATCH) {
    const batch = keyed.slice(start, start + BANK_CHECK_BATCH).map(({ row, print }) => ({ exam: row.exam, section: row.section, session: row.session, fingerprint: print }));
    Object.assign(stored, await checkBankRows(batch));
  }
  return keyed.map(({ line, row, print }) => {
    const hash = stored[`${rowSetKey(row)}|${print}`];
    return { line, row, fate: hash === undefined ? "new" : hash === BANK_EDITED ? "edited" : hash === rowContentHash(row) ? "same" : "changed" };
  });
}

async function readSheet(file: File, sheet?: string): Promise<Checked> {
  const { default: readXlsxFile, readSheetNames } = await import("read-excel-file");
  const sheets = await readSheetNames(file);
  const name = sheet ?? sheets[0];
  const raw = (await readXlsxFile(file, { sheet: name })) as unknown[][];
  const header = findHeader(raw);
  const base = { fileName: file.name, sheet: name, sheets, file, repeats: new Map<number, number>(), sorted: [] };
  if (header.missing.length) return { ...base, missing: header.missing, rows: [] };
  const rows = raw.slice(header.index + 1)
    .map((cells, offset) => ({ cells, line: header.index + offset + 2 }))
    .filter(({ cells }) => !isBlankRow(cells))
    .map(({ cells, line }) => checkRow(cells, header.map, line));
  const valid = rows.flatMap((item) => (item.row ? [{ line: item.line, row: item.row }] : []));
  // The same question twice in this file: only its first row counts.
  const repeats = repeatsInFile(valid);
  const sorted = await sortAgainstBank(valid.filter((item) => !repeats.has(item.line)));
  return { ...base, missing: [], rows, repeats, sorted };
}

/**
 * Super admin: read a sheet in the browser, check every row and compare it with the bank, then
 * upload only what is new or edited. The same data can't go in twice.
 */
export function BankUpload({ sets }: { sets: BankSetRow[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Checked | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [examFilter, setExamFilter] = useState<string>("ALL");
  const [confirmDelete, setConfirmDelete] = useState<BankSetRow[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const uploading = Boolean(progress && progress.done < progress.total && !progress.failed);

  async function open(file: File, sheet?: string) {
    setReading(true);
    setProgress(null);
    try {
      setChecked(await readSheet(file, sheet));
    } catch (error) {
      toast.error(error instanceof Error && error.message.includes("super admin") ? error.message : "ফাইলটা পড়া গেল না। Google Sheets থেকে File → Download → Microsoft Excel (.xlsx) দিয়ে নামিয়ে দিন।");
      setChecked(null);
    } finally {
      setReading(false);
    }
  }

  const sorted = checked?.sorted ?? [];
  const toSend = sorted.filter((item) => item.fate === "new" || item.fate === "changed");
  const count = (fate: Fate) => sorted.filter((item) => item.fate === fate).length;
  const errors = (checked?.rows ?? []).filter((row) => row.errors.length);
  const warnings = (checked?.rows ?? []).filter((row) => row.row && row.warnings.length);
  const skipped = (checked?.rows ?? []).filter((row) => row.skipped);
  const repeats = [...(checked?.repeats ?? [])];
  const setCount = new Set(sorted.map((item) => rowSetKey(item.row))).size;

  async function upload() {
    if (!checked) return;
    const rows = toSend.map((item) => item.row);
    let state: Progress = { done: 0, total: rows.length, created: 0, updated: 0 };
    setProgress(state);
    for (let start = 0; start < rows.length; start += BANK_IMPORT_BATCH) {
      const batch = rows.slice(start, start + BANK_IMPORT_BATCH);
      try {
        const result = await importBankRows(batch);
        state = { ...state, done: start + batch.length, created: state.created + result.created, updated: state.updated + result.updated };
        setProgress(state);
      } catch (error) {
        // Uploading is idempotent: running it again picks up where it stopped without duplicates.
        setProgress({ ...state, failed: error instanceof Error ? error.message : "আপলোড থেমে গেছে" });
        toast.error("আপলোড মাঝপথে থেমেছে — আবার চাপলে বাকিটা যাবে, কিছু দুবার হবে না।");
        return;
      }
    }
    toast.success(`আপলোড শেষ — নতুন ${state.created}, আপডেট ${state.updated}`);
    // Everything is in the bank now: the same file shows as "already there".
    setChecked({ ...checked, sorted: await sortAgainstBank(sorted.map(({ line, row }) => ({ line, row }))).catch(() => sorted) });
    router.refresh();
  }

  const shownSets = examFilter === "ALL" ? sets : sets.filter((set) => set.exam === examFilter);
  const allPicked = shownSets.length > 0 && shownSets.every((set) => picked.has(set.id));
  const toggle = (id: string) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(shownSets.map((set) => set.id)));
  const pickedSets = sets.filter((set) => picked.has(set.id));

  async function removePicked(list: BankSetRow[]) {
    setDeleting(true);
    try {
      const removed = await deleteBankSets(list.map((set) => set.id));
      toast.success(`${removed}টি set মুছে ফেলা হলো`);
      setPicked(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "মোছা গেল না।");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  const stat = (label: string, value: number, tone: string) => <div className={cn("rounded-xl px-3 py-2.5", tone)}><p className="text-xs">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>;

  return <div className="mx-auto max-w-3xl space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">প্রশ্ন ব্যাংক — আপলোড</h1>
      <p className="mt-1 text-sm text-zinc-500">Sheet-এর প্রতিটা সেশন একটা set হয়। আগে থেকে থাকা প্রশ্ন আর কখনো দুবার ওঠে না — শুধু নতুন আর বদলানো প্রশ্ন আপলোড হয়।</p>
    </div>

    <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition", reading ? "border-zinc-200" : "border-zinc-300 hover:border-zinc-400")}>
        {reading ? <Loader2 className="size-7 animate-spin text-zinc-400" /> : <FileSpreadsheet className="size-7 text-emerald-600" />}
        <span className="text-sm font-medium">{reading ? "পড়া আর ব্যাংকের সাথে মেলানো হচ্ছে…" : checked ? checked.fileName : ".xlsx ফাইল বেছে নিন"}</span>
        <span className="text-xs text-zinc-500">Google Sheets: File → Download → Microsoft Excel (.xlsx)। আপলোডের আগে এখানে মিলিয়ে দেখা হয়।</span>
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
          {stat("নতুন প্রশ্ন", count("new"), "bg-emerald-50 text-emerald-900")}
          {stat("বদলেছে (আপডেট হবে)", count("changed"), count("changed") ? "bg-sky-50 text-sky-900" : "bg-zinc-50 text-zinc-700")}
          {stat("আগেই আছে (বাদ)", count("same"), "bg-zinc-50 text-zinc-700")}
          {stat("ভুল (বাদ)", errors.length, errors.length ? "bg-red-50 text-red-900" : "bg-zinc-50 text-zinc-700")}
        </div>
        <p className="text-xs text-zinc-500">
          {setCount}টি set
          {repeats.length ? ` · ${repeats.length}টি সারি এই ফাইলেই দুবার আছে (একবার নেওয়া হবে)` : ""}
          {warnings.length ? ` · ${warnings.length}টি সতর্কতা` : ""}
          {skipped.length ? ` · ${skipped.length}টি MCQ নয় (বাদ)` : ""}
          {count("edited") ? ` · ${count("edited")}টি অ্যাপে edit করা — sheet দিয়ে বদলাবে না` : ""}
        </p>

        {errors.length || warnings.length || repeats.length ? <div className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 text-sm">
          {errors.slice(0, 200).map((row) => <p key={`e${row.line}`} className="flex gap-3 px-3 py-2"><span className="w-16 shrink-0 font-medium tabular-nums text-red-700">সারি {row.line}</span><span className="min-w-0 text-zinc-600">{row.errors.join(" · ")}</span></p>)}
          {repeats.slice(0, 200).map(([line, first]) => <p key={`r${line}`} className="flex gap-3 px-3 py-2"><span className="w-16 shrink-0 font-medium tabular-nums text-zinc-500">সারি {line}</span><span className="min-w-0 text-zinc-600">সারি {first}-এর একই প্রশ্ন — বাদ</span></p>)}
          {warnings.slice(0, 200).map((row) => <p key={`w${row.line}`} className="flex gap-3 px-3 py-2"><span className="w-16 shrink-0 font-medium tabular-nums text-amber-700">সারি {row.line}</span><span className="min-w-0 text-zinc-600">{row.warnings.join(" · ")}</span></p>)}
        </div> : null}

        {progress ? <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className={cn("h-full rounded-full transition-all", progress.failed ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
          <p className="text-xs text-zinc-600">{progress.done}/{progress.total} · নতুন {progress.created} · আপডেট {progress.updated}{progress.failed ? <span className="text-red-700"> · থেমেছে: {progress.failed}</span> : null}</p>
        </div> : null}

        {toSend.length ? <button type="button" onClick={() => void upload()} disabled={uploading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {progress?.failed ? "বাকিটা আবার পাঠাও" : `${toSend.length}টি প্রশ্ন আপলোড করো`}
        </button> : sorted.length ? <p className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 className="size-4" /> এই ফাইলের সব প্রশ্ন আগেই ব্যাংকে আছে — আপলোড করার মতো নতুন কিছু নেই।</p> : null}
      </> : null}
    </section>

    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">ব্যাংকে থাকা set ({sets.length})</h2>
        {sets.length ? <select value={examFilter} onChange={(event) => { setExamFilter(event.target.value); setPicked(new Set()); }} aria-label="পরীক্ষা অনুযায়ী দেখো" className="h-9 rounded-xl border border-zinc-200 bg-white px-2.5 text-sm">
          <option value="ALL">সব পরীক্ষা</option>
          {BANK_EXAMS.map((exam) => <option key={exam.id} value={exam.id}>{exam.label}</option>)}
        </select> : null}
      </div>

      {shownSets.length ? <>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-100 px-3 py-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={allPicked} onChange={toggleAll} className="size-4 accent-zinc-900" />
            সব বাছো ({shownSets.length})
          </label>
          <button type="button" disabled={!pickedSets.length || deleting} onClick={() => setConfirmDelete(pickedSets)} className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
            <Trash2 className="size-4" /> {pickedSets.length ? `${pickedSets.length}টি মুছে ফেলো` : "মুছে ফেলো"}
          </button>
        </div>
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {shownSets.map((set) => <label key={set.id} className={cn("flex cursor-pointer items-center gap-3 px-4 py-3", picked.has(set.id) && "bg-red-50/50")}>
            <input type="checkbox" checked={picked.has(set.id)} onChange={() => toggle(set.id)} className="size-4 shrink-0 accent-zinc-900" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-indigo-600">{examLabel(set.exam)} · {set.section}</span>
              <span className="block truncate font-medium">{set.name}</span>
              <span className="block text-xs text-zinc-500">{set.questionCount}টি প্রশ্ন · {set.copyCount} জন পাঠিয়েছে · {formatDateTime(set.updatedAt)}</span>
            </span>
          </label>)}
        </div>
      </> : <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">এখনো কোনো set নেই।</p>}
    </section>

    <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && !deleting && setConfirmDelete(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>{confirmDelete?.length}টি set ব্যাংক থেকে মুছবেন?</AlertDialogTitle>
        <AlertDialogDescription>
          এগুলোর মোট {confirmDelete?.reduce((sum, set) => sum + set.questionCount, 0)}টি প্রশ্ন ব্যাংক থেকে চলে যাবে, ফেরানো যাবে না। যারা আগেই Preliminary-তে পাঠিয়েছে, তাদের কপি থেকে যাবে।
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>রাখো</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={deleting} onClick={(event) => { event.preventDefault(); if (confirmDelete) void removePicked(confirmDelete); }}>
            {deleting ? "মোছা হচ্ছে…" : "মুছে ফেলো"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
