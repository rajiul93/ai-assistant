"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Plus, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addAiCredit, deleteAiCredit } from "@/server/actions/ai-credit";

export type CreditRow = { id: string; amountCents: number; addedAt: string; note: string | null };
export type CostsView = { ok: true; days: Array<{ day: string; usd: number }> } | { ok: false; reason: "no_key" | "failed"; detail?: string };

const usd = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayKey = (iso: string) => iso.slice(0, 10);

/**
 * OpenAI money for the owner: dollars added (entered here), dollars spent (OpenAI's Costs API,
 * by UTC day like OpenAI's own billing) and what is left. Spending counts from the earliest top-up.
 */
export function OpenAiBalance({ credits, costs, today }: { credits: CreditRow[]; costs: CostsView; /** UTC day, YYYY-MM-DD (from the server) */ today: string }) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [addedOn, setAddedOn] = useState(today);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const addedUsd = credits.reduce((sum, credit) => sum + credit.amountCents, 0) / 100;
  const from = credits.length ? credits.map((credit) => dayKey(credit.addedAt)).sort()[0] : null;
  const days = costs.ok ? costs.days : [];
  const sumFrom = (key: string | null) => days.filter((day) => !key || dayKey(day.day) >= key).reduce((sum, day) => sum + day.usd, 0);
  const spent = from ? sumFrom(from) : null;
  const left = spent === null ? null : addedUsd - spent;
  const weekAgo = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  const perDay = sumFrom(weekAgo) / 7;
  const daysLeft = left !== null && left > 0 && perDay > 0 ? Math.floor(left / perDay) : null;
  const usedPercent = addedUsd > 0 && spent !== null ? Math.min(100, Math.round((spent / addedUsd) * 100)) : 0;
  const tone = left === null ? "text-zinc-900" : left <= 0 ? "text-red-600" : addedUsd && left / addedUsd < 0.15 ? "text-amber-600" : "text-emerald-700";

  function save() {
    const value = Number(amount);
    if (!(value > 0)) { toast.error("কত ডলার, লিখুন"); return; }
    startTransition(async () => {
      try {
        await addAiCredit({ amountUsd: value, addedOn, note: note.trim() || undefined });
        toast.success(`${usd(value)} যোগ হলো`);
        setAdding(false); setAmount(""); setNote(""); setAddedOn(today);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "সেভ করা গেল না");
      }
    });
  }

  function remove(credit: CreditRow) {
    if (!window.confirm(`${usd(credit.amountCents / 100)} (${dayKey(credit.addedAt)}) মুছে ফেলবেন?`)) return;
    startTransition(async () => {
      try { await deleteAiCredit(credit.id); toast.success("মুছে ফেলা হলো"); } catch (error) { toast.error(error instanceof Error ? error.message : "মোছা গেল না"); }
    });
  }

  return <section className="rounded-3xl bg-white p-5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
    <div className="flex items-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-teal-600 text-white shadow-[0_8px_16px_-10px_rgba(5,150,105,0.9)]"><Wallet className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">OpenAI balance</h2>
        <p className="text-xs text-zinc-500">শুধু আপনি (super admin) দেখছেন · খরচ OpenAI-এর হিসাব থেকে</p>
      </div>
      {!adding ? <button type="button" onClick={() => setAdding(true)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] px-3.5 text-sm font-semibold text-white shadow-[0_8px_16px_-10px_rgba(37,99,235,0.9)] hover:brightness-105"><Plus className="size-4" /> ডলার যোগ</button> : null}
    </div>

    {costs.ok ? null : costs.reason === "no_key"
      ? <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900"><KeyRound className="mt-0.5 size-4 shrink-0" /><span>খরচ দেখাতে OpenAI-এর <b>Admin key</b> লাগবে: platform.openai.com → Settings → Organization → <b>Admin keys</b> → নতুন key বানিয়ে <code className="rounded bg-white px-1">OPENAI_ADMIN_KEY</code> নামে <code>.env</code> আর Vercel-এ রাখুন। সাধারণ API key দিয়ে খরচ পড়া যায় না।</span></p>
      : <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-800">OpenAI থেকে খরচ আনা গেল না{costs.detail ? `: ${costs.detail}` : ""}। একটু পরে আবার খুলুন।</p>}

    {credits.length ? <>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-blue-50 px-2 py-3"><p className="text-[11px] font-semibold text-blue-700/80">যোগ করেছেন</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{usd(addedUsd)}</p></div>
        <div className="rounded-2xl bg-orange-50 px-2 py-3"><p className="text-[11px] font-semibold text-orange-700/80">খরচ হয়েছে</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{spent === null || !costs.ok ? "—" : usd(spent)}</p></div>
        <div className="rounded-2xl bg-emerald-50 px-2 py-3"><p className="text-[11px] font-semibold text-emerald-700/80">বাকি আছে</p><p className={cn("mt-0.5 text-lg font-bold tabular-nums", tone)}>{left === null || !costs.ok ? "—" : usd(left)}</p></div>
      </div>
      {costs.ok ? <>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPercent} aria-label="Balance used">
          <div className={cn("h-full rounded-full bg-linear-to-r", usedPercent >= 100 ? "from-rose-500 to-red-600" : usedPercent >= 85 ? "from-amber-400 to-orange-500" : "from-emerald-400 to-teal-600")} style={{ width: `${usedPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {usedPercent}% খরচ · আজ {usd(sumFrom(today))} · গত ৭ দিনে গড়ে দিনে {usd(perDay)}
          {daysLeft !== null ? ` · এভাবে চললে আর প্রায় ${daysLeft} দিন চলবে` : ""}
          {left !== null && left <= 0 ? " · টাকা শেষ — OpenAI-এ এখনই ভরুন, নইলে AI বন্ধ হয়ে যাবে" : ""}
        </p>
      </> : null}
    </> : costs.ok ? <div className="mt-4 rounded-xl bg-zinc-50 p-3">
      <p className="text-sm text-zinc-700">গত ৩০ দিনে খরচ: <b className="tabular-nums">{usd(days.reduce((sum, day) => sum + day.usd, 0))}</b> · আজ <b className="tabular-nums">{usd(sumFrom(today))}</b></p>
      <p className="mt-1 text-xs text-zinc-500">বাকি কত আছে দেখতে “ডলার যোগ” চাপুন: OpenAI-এ যত ভরেছেন (বা আজ Billing পাতায় যত balance দেখাচ্ছে) সেটা লিখুন।</p>
    </div> : <p className="mt-4 text-xs text-zinc-500">OpenAI-এ যত ডলার ভরেছেন (বা আজ Billing পাতায় যত balance দেখাচ্ছে) “ডলার যোগ” দিয়ে লিখুন।</p>}

    {adding ? <div className="mt-4 space-y-2 rounded-xl border border-zinc-200 p-3">
      <div className="flex gap-2">
        <label className="min-w-0 flex-1 space-y-1"><span className="text-xs font-medium text-zinc-600">কত ডলার</span>
          <div className="flex h-10 items-center rounded-lg border border-zinc-200 px-2.5 focus-within:border-zinc-400"><span className="text-zinc-400">$</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="20" className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" autoFocus /></div>
        </label>
        <label className="w-36 shrink-0 space-y-1"><span className="text-xs font-medium text-zinc-600">কবে</span>
          <input type="date" value={addedOn} max={today} onChange={(event) => setAddedOn(event.target.value)} className="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm outline-none focus:border-zinc-400" />
        </label>
      </div>
      <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="নোট (ঐচ্ছিক), যেমন: card দিয়ে top-up" className="h-10 w-full rounded-lg border border-zinc-200 px-2.5 text-sm outline-none focus:border-zinc-400" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setAdding(false)} disabled={pending} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-medium ring-1 ring-zinc-200 hover:bg-zinc-50"><X className="size-4" /> বাতিল</button>
        <button type="button" onClick={save} disabled={pending} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} যোগ করো</button>
      </div>
    </div> : null}

    {credits.length ? <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
      {credits.map((credit) => <li key={credit.id} className="flex items-center gap-2 py-2 text-sm">
        <span className="font-semibold tabular-nums">{usd(credit.amountCents / 100)}</span>
        <span className="text-xs text-zinc-500">{dayKey(credit.addedAt)}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{credit.note}</span>
        <button type="button" onClick={() => remove(credit)} disabled={pending} aria-label="মুছে ফেলো" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
      </li>)}
    </ul> : null}
  </section>;
}
