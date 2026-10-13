"use client";

import { useState } from "react";
import Link from "next/link";
import { ListChecks, Search } from "lucide-react";
import type { listBankSets } from "@/server/actions/question-bank";
import { sectionHref } from "./bank-nav";
import { SendToPreliminary } from "./send-button";

type BankSetRow = Awaited<ReturnType<typeof listBankSets>>[number];

/** The set cards of one section, with a search when there are many. */
export function BankSetGrid({ examSlug, sets, locked }: { examSlug: string; sets: BankSetRow[]; locked: boolean }) {
  const [query, setQuery] = useState("");
  const shown = sets.filter((set) => !query.trim() || set.name.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="space-y-4">
    {sets.length > 6 ? <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Set খুঁজুন (যেমন: গণপূর্ত, 2024)" aria-label="Set খুঁজুন" className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
    </label> : null}

    {shown.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((set) => {
        const href = `${sectionHref(examSlug, set.section)}/${set.id}`;
        return <article key={set.id} className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4">
          <Link href={href} className="group block">
            <h2 className="text-base font-semibold leading-snug group-hover:underline group-hover:underline-offset-2">{set.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><ListChecks className="size-3.5" />{set.questionCount}টি প্রশ্ন</p>
          </Link>
          <div className="mt-4 grid gap-2">
            <Link href={href} className="flex h-10 items-center justify-center rounded-xl text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">দেখো</Link>
            <SendToPreliminary setId={set.id} copyId={set.copyId} locked={locked} />
          </div>
        </article>;
      })}
    </div> : <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">এই খোঁজে কোনো set নেই।</p>}
  </div>;
}
