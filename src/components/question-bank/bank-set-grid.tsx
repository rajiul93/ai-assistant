"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, CalendarDays, FolderInput, History, KeyRound, ListChecks, Loader2, Pencil, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { moveBankSets, setBankSetsFree, updateBankSet, type getBankCategory } from "@/server/actions/question-bank";
import { FreePill, iconButton, MoveDialog, useBankRun } from "./bank-admin";
import { BankEmpty } from "./bank-nav";
import { MoveToChapter, type MoveSource } from "./move-to-chapter";
import { SendToPreliminary } from "./send-button";

type Category = NonNullable<Awaited<ReturnType<typeof getBankCategory>>>;
type BankSetRow = Category["years"][number]["sets"][number];

const toLatin = (text: string) => text.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));

/** Staff: a set's name, year (empty = "অন্যান্য") and Free/Paid. */
function SetEditDialog({ set, onClose }: { set: BankSetRow | null; onClose: () => void }) {
  const [name, setName] = useState(set?.name ?? "");
  const [year, setYear] = useState(set?.year ? String(set.year) : "");
  const [free, setFree] = useState(set?.free ?? false);
  const { busy, run } = useBankRun();
  const yearNumber = year.trim() ? Number(toLatin(year.trim())) : null;
  const badYear = yearNumber !== null && !(Number.isInteger(yearNumber) && yearNumber >= 1950 && yearNumber <= 2100);

  return <Dialog open={Boolean(set)} onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Set বদলাও</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!set || badYear || !name.trim()) return;
        run(() => updateBankSet({ id: set.id, name: name.trim(), year: yearNumber, free }), "সেভ হলো", onClose);
      }}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">নাম</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-400" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">সাল (ফাঁকা = অন্যান্য)</span>
          <input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" placeholder="যেমন 2024" className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-400" />
          {badYear ? <span className="text-xs text-red-600">১৯৫০ থেকে ২১০০-এর মধ্যে একটা সাল লেখো</span> : null}
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm">
          <input type="checkbox" checked={free} onChange={(event) => setFree(event.target.checked)} className="size-4 accent-emerald-600" />
          <span><span className="font-medium">Free</span> — plan ছাড়াই সবাই পুরো set দেখবে আর পাঠাতে পারবে</span>
        </label>
        <button type="submit" disabled={busy || badYear || !name.trim()} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} সেভ
        </button>
      </form>
    </DialogContent>
  </Dialog>;
}

/** A category's sets, a section per year (newest first), with a search when there are many. */
export function BankYears({ category }: { category: Category }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<BankSetRow | null>(null);
  const [moving, setMoving] = useState<BankSetRow | null>(null);
  const [toChapter, setToChapter] = useState<MoveSource | null>(null);
  const { busy, run } = useBankRun();
  const all = category.years.flatMap((group) => group.sets);
  const needle = toLatin(query.trim().toLowerCase());
  const years = category.years
    .map((group) => ({ ...group, sets: group.sets.filter((set) => !needle || toLatin(set.name.toLowerCase()).includes(needle)) }))
    .filter((group) => group.sets.length);

  if (!all.length) return <BankEmpty icon={History} text="এই পরীক্ষার প্রশ্ন এখনো যোগ হয়নি।" />;

  return <div className="space-y-5">
    {category.canSend ? null : <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <KeyRound className="mt-0.5 size-4 shrink-0" />
      <span>বিনা plan-এ যেকোনো {category.unlocks.limit}টা set পুরো খুলে পড়তে পারবে — খোলা হয়েছে {category.unlocks.used}/{category.unlocks.limit}। Set খুলে &quot;এই set খোলো&quot; চাপো। Preliminary-তে নিতে plan লাগবে।</span>
    </p>}
    {all.length > 6 ? <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Set খুঁজুন (যেমন: গণপূর্ত, 2024)" aria-label="Set খুঁজুন" className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
    </label> : null}

    {years.length ? years.map((group) => <section key={group.year ?? "other"} className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
        <CalendarDays className="size-4 text-zinc-400" />{group.year ?? "অন্যান্য"}<span className="font-normal text-zinc-400">· {group.sets.length}টি set</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.sets.map((set) => {
          const href = `/question-bank/previous/${category.slug}/${set.id}`;
          return <article key={set.id} className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex items-start gap-2">
              <Link href={href} className="group block min-w-0 flex-1">
                <h3 className="text-base font-semibold leading-snug group-hover:underline group-hover:underline-offset-2">{set.name}</h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><ListChecks className="size-3.5" />{set.questionCount}টি প্রশ্ন</p>
              </Link>
              {category.canEdit ? <span className="flex shrink-0 items-center gap-0.5">
                <FreePill free={set.free} busy={busy} onToggle={() => run(() => setBankSetsFree([set.id], !set.free), set.free ? "Paid করা হলো" : "Free করা হলো")} />
                <button type="button" onClick={() => setEditing(set)} aria-label={`${set.name} বদলাও`} title="নাম, সাল, Free" className={iconButton}><Pencil className="size-3.5" /></button>
                <button type="button" onClick={() => setMoving(set)} aria-label={`${set.name} সরাও`} title="অন্য category-তে সরাও" className={iconButton}><ArrowRightLeft className="size-3.5" /></button>
                <button type="button" onClick={() => setToChapter({ kind: "set", setId: set.id, name: set.name })} aria-label={`${set.name} General-এর chapter-এ সরাও`} title="General-এর chapter-এ সরাও" className={iconButton}><FolderInput className="size-3.5" /></button>
              </span> : set.free ? <FreePill free /> : set.picked ? <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200"><KeyRound className="size-3" />খোলা</span> : null}
            </div>
            <div className="mt-4 grid gap-2">
              <Link href={href} className="flex h-10 items-center justify-center rounded-xl text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">দেখো</Link>
              <SendToPreliminary setId={set.id} copyId={set.copyId} locked={set.locked || !category.canSend} />
            </div>
          </article>;
        })}
      </div>
    </section>) : <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">এই খোঁজে কোনো set নেই।</p>}

    <MoveToChapter key={`chapter-${toChapter?.kind === "set" ? toChapter.setId : "none"}`} source={toChapter} onClose={() => setToChapter(null)} />
    <SetEditDialog key={`edit-${editing?.id ?? "none"}`} set={editing} onClose={() => setEditing(null)} />
    <MoveDialog open={Boolean(moving)} onOpenChange={(open) => !open && setMoving(null)} title="Set-টা কোন category-তে যাবে?" busy={busy}
      targets={category.others.map((other) => ({ id: other.id, label: other.name }))}
      onSubmit={(target) => moving && run(() => moveBankSets([moving.id], target), (result) => (result.skipped ? "ওই category-তে এই নামে set আগেই আছে — সরানো হয়নি" : "সরানো হলো"), () => setMoving(null))} />
  </div>;
}
