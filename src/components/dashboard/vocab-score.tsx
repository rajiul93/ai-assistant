import Link from "next/link";
import { ChevronRight, Languages, Lock, Trophy } from "lucide-react";
import { BATCH_SIZE, PASS_PERCENT } from "@/lib/vocabulary/exam";
import type { getVocabStatus } from "@/server/vocab-progress";

/**
 * The vocabulary exam score on the home page: one bar, the current set's three best scores averaged,
 * with the 80% line that opens the next 50 words (owner, 2026-10-18).
 */
export function VocabScore({ status, words }: { status: Awaited<ReturnType<typeof getVocabStatus>>; words: number }) {
  const note = status.passed ? `পাস! নতুন ${BATCH_SIZE}টা শব্দ খোলা`
    : status.locked ? `তিনটা exam-এ ${PASS_PERCENT}% পেলে নতুন ${BATCH_SIZE}টা খুলবে`
    : `সেট ${status.batch}: ${status.inBatch}/${BATCH_SIZE} শব্দ`;
  return <Link href="/vocabulary?tab=done" className="mt-5 block rounded-3xl bg-white p-4 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)] transition hover:shadow-md">
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-lime-400 to-green-600 text-white"><Languages className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-slate-900">Vocabulary exam</span>
        <span className="flex items-center gap-1 truncate text-xs text-slate-500">{status.locked ? <Lock className="size-3 shrink-0" /> : status.passed ? <Trophy className="size-3 shrink-0" /> : null}{note} · শেখা {status.learned}/{words}</span>
      </span>
      <span className="shrink-0 text-xl font-bold tabular-nums text-slate-900">{status.score}%</span>
      <ChevronRight className="size-4 shrink-0 text-slate-400" />
    </div>
    <div className="relative mt-3 h-3 rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${status.score >= PASS_PERCENT ? "bg-linear-to-r from-emerald-400 to-teal-500" : "bg-linear-to-r from-blue-400 to-indigo-500"}`} style={{ width: `${status.score}%` }} />
      {/* The pass line. */}
      <span aria-hidden className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full bg-slate-400" style={{ left: `${PASS_PERCENT}%` }} />
    </div>
  </Link>;
}
