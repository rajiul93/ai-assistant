"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, MousePointerClick, Share2, ShoppingBag, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { shareTargets } from "@/lib/affiliate";
import { taka } from "@/lib/billing-display";
import { formatDateTime } from "@/lib/dayjs";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { saveAffiliatePayoutNumber, type getMyAffiliate } from "@/server/actions/affiliate";

type Data = Awaited<ReturnType<typeof getMyAffiliate>>;
type Rules = Data["rules"];

const noSubscribe = () => () => {};

const card = "rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";

/** The rules in one sentence, as the admin set them. */
function rulesText(rules: Rules) {
  const share = rules.commissionMode === "PERCENT" ? `দামের ${rules.percent}%` : `${taka(rules.fixedBdt)}`;
  const when = rules.recurring ? "প্রতিটা plan কেনায়" : "প্রথম plan কেনায়";
  const pay = rules.payoutMode === "CASH" ? "টাকা bKash/Nagad-এ পাঠানো হবে" : "তোমার নিজের plan কেনার সময় দাম থেকে কাটা যাবে";
  return `তোমার link-এ click করে ${rules.windowDays} দিনের মধ্যে কেউ ঢুকলে সে তোমার। সে ${when} তুমি পাবে ${share}; ${pay}।`;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3">
    <span className={cn("flex size-8 items-center justify-center rounded-xl", tone)}><Icon className="size-4" /></span>
    <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{value}</p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>;
}

/** Cash payouts go to this number; the affiliate keeps it up to date. */
function PayoutNumber({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial?.replace(/^\+88/, "") ?? "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await saveAffiliatePayoutNumber(value);
      toast.success("নম্বর সেভ হলো");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "সেভ করা গেল না।"));
    } finally {
      setSaving(false);
    }
  }
  return <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="flex gap-2">
    <input value={value} onChange={(event) => setValue(event.target.value)} inputMode="tel" placeholder="bKash/Nagad নম্বর, যেমন 017XXXXXXXX" aria-label="bKash/Nagad নম্বর" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-emerald-400" />
    <button type="submit" disabled={saving} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} সেভ</button>
  </form>;
}

/**
 * /affiliate (docs/affiliate-plan.md): the link to share anywhere — one tap for the usual apps,
 * the phone's own share sheet, or copy — what it brought, and what the affiliate is owed.
 */
export function AffiliateView({ data }: { data: Data }) {
  const [copied, setCopied] = useState(false);
  // The phone's own share sheet, where there is one (known only in the browser, after hydration).
  const canNativeShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  if (!data.eligible) {
    return <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Affiliate</h1>
      <div className={cn(card, "text-center")}>
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Share2 className="size-6" /></span>
        <p className="mt-3 font-semibold">{data.enabled ? "তুমি এখনো affiliate নও" : "Affiliate program এখন বন্ধ"}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{data.enabled ? "Admin তোমাকে affiliate বানালে এখানে তোমার নিজের link পাবে — সেটা share করে কেউ plan কিনলে commission পাবে।" : "চালু হলে এখানে তোমার নিজের link পাবে।"}</p>
      </div>
    </div>;
  }

  const shareText = "Prep — চাকরির প্রস্তুতি, এখন আরও সহজ";
  const targets = shareTargets(data.link, shareText);

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.eligible ? data.link : "");
      setCopied(true);
      toast.success("Link কপি হলো — যেকোনো জায়গায় paste করো");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("কপি করা গেল না — link-টা হাতে select করে কপি করো।");
    }
  }

  async function nativeShare() {
    if (!data.eligible) return;
    try { await navigator.share({ title: "Prep", text: shareText, url: data.link }); } catch { /* closed */ }
  }

  const { money, stats, rules } = data;

  return <div className="space-y-4">
    <section className="rounded-3xl bg-linear-to-br from-emerald-500 via-teal-500 to-cyan-500 p-4 text-white shadow-[0_14px_32px_-18px_rgba(13,148,136,0.7)] sm:p-5">
      <h1 className="text-xl font-bold tracking-tight">Affiliate</h1>
      <p className="mt-1 text-[13px] leading-snug text-white/90">{rulesText(rules)}</p>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-1.5 pl-3 text-slate-900">
        <Link2 className="size-4 shrink-0 text-teal-600" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={data.link}>{data.link}</span>
        <button type="button" onClick={() => void copy()} className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} কপি</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canNativeShare ? <button type="button" onClick={() => void nativeShare()} className="flex h-9 items-center gap-1.5 rounded-full bg-white/20 px-3.5 text-[13px] font-semibold ring-1 ring-white/30 hover:bg-white/30"><Share2 className="size-4" /> Share</button> : null}
        {targets.map((target) => <a key={target.id} href={target.href} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center rounded-full bg-white/20 px-3.5 text-[13px] font-semibold ring-1 ring-white/30 hover:bg-white/30">{target.label}</a>)}
      </div>
      <p className="mt-2 text-[12px] text-white/80">তোমার code: <span className="font-mono font-semibold">{data.code}</span> · link যেকোনো জায়গায় দিলেই চলবে</p>
    </section>

    <section className={card}>
      <h2 className="font-semibold">তোমার link কী এনেছে</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat icon={MousePointerClick} label="Click" value={String(stats.clicks)} tone="bg-sky-50 text-sky-600" />
        <Stat icon={UserPlus} label="ঢুকেছে" value={String(stats.signups)} tone="bg-violet-50 text-violet-600" />
        <Stat icon={ShoppingBag} label="কিনেছে" value={String(stats.customers)} tone="bg-amber-50 text-amber-600" />
      </div>
    </section>

    <section className={card}>
      <h2 className="font-semibold">টাকা</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Wallet} label="মোট আয়" value={taka(money.earnedBdt)} tone="bg-emerald-50 text-emerald-600" />
        <Stat icon={Check} label="পেয়েছ (টাকা)" value={taka(money.paidBdt)} tone="bg-slate-100 text-slate-600" />
        <Stat icon={ShoppingBag} label="Plan-এ কাটা গেছে" value={taka(money.creditUsedBdt)} tone="bg-slate-100 text-slate-600" />
        <Stat icon={Wallet} label="পাওনা" value={taka(money.balanceBdt)} tone="bg-teal-50 text-teal-700" />
      </div>
      {rules.payoutMode === "CASH" ? <div className="mt-4 space-y-2">
        <p className="text-sm text-slate-600">পাওনা টাকা admin এই নম্বরে পাঠাবে:</p>
        <PayoutNumber initial={data.payoutNumber} />
      </div> : <p className="mt-4 rounded-2xl bg-teal-50 px-3 py-2.5 text-sm text-teal-900">পাওনা {taka(money.balanceBdt)} তোমার পরের plan কেনার সময় দাম থেকে নিজে থেকেই কাটা যাবে। <Link href="/billing" className="font-semibold underline underline-offset-2">Plans দেখো</Link></p>}
    </section>

    <section className={card}>
      <h2 className="font-semibold">Commission</h2>
      {data.commissions.length ? <ul className="mt-2 divide-y divide-slate-100">
        {data.commissions.map((item) => <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{item.customer} · {taka(item.basisBdt)}-এর {item.rule}</span>
            <span className="block text-xs text-slate-500">{formatDateTime(item.createdAt)}{item.canceledAt ? " · বাতিল" : ""}</span>
          </span>
          <span className={cn("shrink-0 font-semibold tabular-nums", item.canceledAt ? "text-slate-400 line-through" : "text-emerald-700")}>+{taka(item.amountBdt)}</span>
        </li>)}
      </ul> : <p className="mt-2 text-sm text-slate-500">এখনো নেই — link share করো, কেউ plan কিনলে এখানে দেখাবে।</p>}
      {data.payouts.length ? <>
        <h3 className="mt-4 text-sm font-semibold text-slate-700">পাঠানো টাকা</h3>
        <ul className="mt-1 divide-y divide-slate-100">
          {data.payouts.map((payout) => <li key={payout.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate text-slate-600">{formatDateTime(payout.createdAt)}{payout.note ? ` · ${payout.note}` : ""}</span>
            <span className="shrink-0 font-semibold tabular-nums">{taka(payout.amountBdt)}</span>
          </li>)}
        </ul>
      </> : null}
    </section>
  </div>;
}
