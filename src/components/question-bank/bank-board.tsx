"use client";

import { useState } from "react";
import Link from "next/link";
import { Library, ListChecks, Search } from "lucide-react";
import { BANK_EXAMS } from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import type { listBankSets } from "@/server/actions/question-bank";
import { SendToPreliminary } from "./send-button";

type BankSetRow = Awaited<ReturnType<typeof listBankSets>>[number];

/**
 * /question-bank: only sets — one per exam session. Each can be read, or sent to the user's own
 * Preliminary, where the studying and the exam happen.
 */
export function BankBoard({ examSlug, sets }: { examSlug: string; sets: BankSetRow[] }) {
  const sections = [...new Set(sets.map((set) => set.section))];
  const [section, setSection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const shown = sets.filter((set) => (!section || set.section === section) && (!query.trim() || set.name.toLowerCase().includes(query.trim().toLowerCase())));

  return <div className="mx-auto max-w-3xl space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">প্রশ্ন ব্যাংক</h1>
      <p className="mt-1 text-sm text-zinc-500">বিগত সালের প্রশ্ন, set ধরে। পড়তে বা exam দিতে set-টা নিজের Preliminary-তে পাঠাও।</p>
    </div>

    <nav aria-label="পরীক্ষা" className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100 p-1">
      {BANK_EXAMS.map((exam) => <Link key={exam.slug} href={`/question-bank?exam=${exam.slug}`} scroll={false} aria-current={exam.slug === examSlug ? "page" : undefined} className={cn("flex h-10 items-center justify-center rounded-xl text-sm font-medium transition", exam.slug === examSlug ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>{exam.label}</Link>)}
    </nav>

    {sets.length ? <>
      {sections.length > 1 ? <div className="flex flex-wrap gap-2">
        {[null, ...sections].map((name) => <button key={name ?? "all"} type="button" onClick={() => setSection(name)} aria-pressed={section === name} className={cn("h-9 rounded-full px-3.5 text-sm font-medium ring-1 transition", section === name ? "bg-zinc-950 text-white ring-zinc-950" : "bg-white text-zinc-700 ring-zinc-200 hover:ring-zinc-300")}>{name ?? "সব"}</button>)}
      </div> : null}
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Set খুঁজুন (যেমন: গণপূর্ত, 2024)" aria-label="Set খুঁজুন" className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
      </label>
    </> : null}

    {shown.length ? <div className="space-y-3">
      {shown.map((set) => <article key={set.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="truncate text-xs font-medium text-indigo-600">{set.section}</p>
        <h2 className="mt-0.5 text-base font-semibold leading-snug">{set.name}</h2>
        <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><ListChecks className="size-3.5" />{set.questionCount}টি প্রশ্ন</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/question-bank/${set.id}`} className="flex h-10 items-center justify-center rounded-xl px-3.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">দেখো</Link>
          <SendToPreliminary setId={set.id} copyId={set.copyId} />
        </div>
      </article>)}
    </div> : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">
      <Library className="mx-auto mb-2 size-8 text-zinc-300" />
      {sets.length ? "এই খোঁজে কোনো set নেই।" : "এই পরীক্ষার প্রশ্ন এখনো যোগ হয়নি।"}
    </div>}
  </div>;
}
