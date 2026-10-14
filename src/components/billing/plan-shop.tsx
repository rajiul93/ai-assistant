"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { ArrowLeft, Check, CheckCircle2, ChevronDown, Copy, CreditCard, Crown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { methodNames, taka } from "@/lib/billing-display";
import { formatBdPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { startOnlinePayment, submitPayment, type getBillingOverview } from "@/server/actions/billing";

export type BillingOverview = Awaited<ReturnType<typeof getBillingOverview>>;
type Quote = BillingOverview["quotes"][number];
type Tier = "STUDENT" | "PROFESSIONAL";

const card = "rounded-3xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]";
const methodStyle: Record<PaymentMethod, string> = {
  BKASH: "bg-pink-50 text-pink-700 ring-pink-200 data-[on=true]:bg-pink-600 data-[on=true]:text-white data-[on=true]:ring-pink-600",
  NAGAD: "bg-orange-50 text-orange-700 ring-orange-200 data-[on=true]:bg-orange-500 data-[on=true]:text-white data-[on=true]:ring-orange-500",
  SSLCOMMERZ: "bg-blue-50 text-blue-700 ring-blue-200 data-[on=true]:bg-blue-600 data-[on=true]:text-white data-[on=true]:ring-blue-600",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" aria-label={`${label} কপি`} onClick={() => void navigator.clipboard.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => toast.error("কপি করা গেল না।"))} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
  </button>;
}

/** How a price is made up, line by line — the same numbers the server will charge. */
function Breakdown({ quote }: { quote: Quote }) {
  const lines: Array<[string, number]> = [["System", quote.system], [quote.tierName, quote.ai], [quote.allTracks ? `${quote.trackNames.length}টি পরীক্ষা` : quote.trackNames[0], quote.tracks]];
  const months = quote.days / 30;
  return <dl className="space-y-1 text-[13px]">
    {lines.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-600">{label}</dt><dd className="tabular-nums">{taka(value)}</dd></div>)}
    {quote.tracksDiscount ? <div className="flex justify-between gap-3 text-emerald-700"><dt>সব পরীক্ষায় ছাড়</dt><dd className="tabular-nums">−{taka(quote.tracksDiscount)}</dd></div> : null}
    {months !== 1 ? <div className="flex justify-between gap-3 text-slate-500"><dt>মাসে {taka(quote.monthly)} × {Number(months.toFixed(2))}</dt><dd className="tabular-nums">{taka(quote.total + quote.durationDiscount)}</dd></div> : null}
    {quote.durationDiscount ? <div className="flex justify-between gap-3 text-emerald-700"><dt>{quote.durationLabel}-এর ছাড়</dt><dd className="tabular-nums">−{taka(quote.durationDiscount)}</dd></div> : null}
  </dl>;
}

const field = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-[15px] outline-none focus:border-blue-300 focus:bg-white";
const payButton = "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.9)] transition hover:bg-blue-700 disabled:opacity-50";

/** Pay for one quote: bKash/Nagad Send Money (checked by an admin) or online through SSLCommerz. */
function Checkout({ quote, overview, source, onBack, onSubmitted }: { quote: Quote; overview: BillingOverview; source: "page" | "chat"; onBack: () => void; onSubmitted?: () => void }) {
  const router = useRouter();
  const methods: PaymentMethod[] = [...overview.accounts.map((account) => account.method), ...(overview.gateway ? ["SSLCOMMERZ" as const] : [])];
  const [method, setMethod] = useState<PaymentMethod | null>(methods.length === 1 ? methods[0] : null);
  const [sender, setSender] = useState("");
  const [trxId, setTrxId] = useState("");
  const [phone, setPhone] = useState(overview.phone ? formatBdPhone(overview.phone).replace("-", "") : "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ amount: number; label: string } | null>(null);
  const account = overview.accounts.find((item) => item.method === method) ?? null;
  const choice = { planType: quote.planType, track: quote.track, durationId: quote.durationId, source };

  async function payManually() {
    if (!account) return;
    setSaving(true);
    try {
      const result = await submitPayment({ ...choice, method: account.method, senderNumber: sender, transactionId: trxId });
      setDone({ amount: result.amountBdt, label: result.label });
      onSubmitted?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment জমা দেওয়া গেল না।");
    } finally {
      setSaving(false);
    }
  }

  async function payOnline() {
    setSaving(true);
    try {
      const { url } = await startOnlinePayment({ ...choice, phone });
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Online payment খোলা গেল না।");
      setSaving(false);
    }
  }

  if (done) return <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
    <p className="flex items-center gap-2 text-base font-bold"><CheckCircle2 className="size-5" /> Payment জমা হয়েছে</p>
    <p className="mt-1 leading-relaxed">{done.label} — {taka(done.amount)}। Admin Transaction ID মিলিয়ে approve করলেই plan চালু হবে।</p>
  </div>;

  return <section className={cn(card, "space-y-3 p-3.5 sm:p-5")}>
    {/* What is being bought: name and total on one line, the make-up folded under it. */}
    <div className="flex items-start gap-2">
      <button type="button" onClick={onBack} aria-label="অন্য plan বাছুন" className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><ArrowLeft className="size-5" /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold leading-tight">{quote.allTracks ? "সব পরীক্ষা" : quote.trackNames[0]} · {quote.tierName}</p>
        <p className="text-xs text-slate-500">{quote.durationLabel}</p>
      </div>
      <p className="shrink-0 text-xl font-extrabold tabular-nums">{taka(quote.total)}</p>
    </div>
    <details className="group rounded-2xl bg-slate-50 px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-slate-600">দামের হিসাব <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
      <div className="mt-2"><Breakdown quote={quote} /></div>
    </details>

    {methods.length ? <div className={cn("grid gap-2", methods.length === 3 ? "grid-cols-3" : methods.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {methods.map((item) => <button key={item} type="button" data-on={method === item} onClick={() => setMethod(item)} className={cn("flex h-11 items-center justify-center gap-1.5 rounded-2xl px-2 text-sm font-semibold ring-1 transition", methodStyle[item])}>
        {item === "SSLCOMMERZ" ? <><CreditCard className="size-4" /> Card/অন্য</> : methodNames[item]}
      </button>)}
    </div> : <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">এখন কোনো payment পদ্ধতি চালু নেই। একটু পরে আবার চেষ্টা করুন।</p>}
    {!method && methods.length > 1 ? <p className="text-center text-xs text-slate-500">কীভাবে দেবেন, বেছে নিন</p> : null}

    {account ? <form className="space-y-2.5" onSubmit={(event) => { event.preventDefault(); void payManually(); }}>
      <p className="text-[13px] text-slate-600">{methodNames[account.method]} app থেকে এই নম্বরে <b>Send Money</b> করুন:</p>
      <div className="grid grid-cols-[1fr_auto] divide-y divide-slate-100 rounded-2xl bg-slate-50 ring-1 ring-slate-200">
        <div className="col-span-2 flex items-center gap-2 px-3 py-1.5"><span className="w-10 shrink-0 text-[11px] text-slate-500">নম্বর</span><span className="min-w-0 flex-1 truncate font-mono text-base font-semibold">{account.number}</span><span className="text-[10.5px] text-slate-400">{account.accountType}</span><CopyButton value={account.number} label="নম্বর" /></div>
        <div className="col-span-2 flex items-center gap-2 px-3 py-1.5"><span className="w-10 shrink-0 text-[11px] text-slate-500">টাকা</span><span className="min-w-0 flex-1 text-base font-semibold tabular-nums">{taka(quote.total)}</span><CopyButton value={String(quote.total)} label="টাকা" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0 space-y-1"><span className="block text-[11px] font-medium text-slate-600">যে নম্বর থেকে</span><input value={sender} onChange={(event) => setSender(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required className={field} /></label>
        <label className="min-w-0 space-y-1"><span className="block text-[11px] font-medium text-slate-600">TrxID (SMS-এ)</span><input value={trxId} onChange={(event) => setTrxId(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="9GH4K2L8QX" required className={cn(field, "uppercase")} /></label>
      </div>
      <button type="submit" disabled={saving || !sender.trim() || !trxId.trim()} className={payButton}>{saving ? <Loader2 className="size-4 animate-spin" /> : null} জমা দিন · {taka(quote.total)}</button>
    </form> : null}

    {method === "SSLCOMMERZ" ? <form className="space-y-2.5" onSubmit={(event) => { event.preventDefault(); void payOnline(); }}>
      <p className="text-[13px] text-slate-600">Card, bKash, Nagad, Rocket বা internet banking — SSLCommerz-এর নিরাপদ পাতায়। টাকা কাটা হলেই plan চালু।</p>
      <label className="block space-y-1"><span className="block text-[11px] font-medium text-slate-600">আপনার মোবাইল নম্বর</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required className={field} /></label>
      <button type="submit" disabled={saving || !phone.trim()} className={payButton}>{saving ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} {taka(quote.total)} দিন</button>
    </form> : null}
  </section>;
}

/**
 * Choosing a plan: the AI tier and how long in one small card, then "all exams" (best value) and
 * each exam as one line — and paying. Made to fit a phone screen; every number comes from the
 * server's quotes and the client only sends what was picked.
 */
export function PlanShop({ overview, source, onSubmitted }: { overview: BillingOverview; source: "page" | "chat"; onSubmitted?: () => void }) {
  const tiers = overview.catalog.tiers;
  const durations = overview.catalog.durations;
  const [tier, setTier] = useState<Tier>(tiers.find((item) => item.planType === "STUDENT")?.planType ?? tiers[0]?.planType ?? "STUDENT");
  const [durationId, setDurationId] = useState(durations[0]?.id ?? "");
  const [picked, setPicked] = useState<Quote | null>(null);

  if (!tiers.length || !durations.length || !overview.catalog.tracks.length) return <p className="rounded-3xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">এখন কোনো plan বিক্রি হচ্ছে না।</p>;
  if (picked) return <Checkout quote={picked} overview={overview} source={source} onBack={() => setPicked(null)} onSubmitted={onSubmitted} />;

  const find = (track: string) => overview.quotes.find((item) => item.planType === tier && item.durationId === durationId && item.track === track);
  const all = find("all");
  const singles = overview.catalog.tracks.map((track) => find(track.id)).filter((item): item is Quote => Boolean(item));
  const tierInfo = overview.tiers.find((item) => item.planType === tier);
  const tierName = tiers.find((item) => item.planType === tier)?.name ?? "";
  const saved = all ? all.tracksDiscount + all.durationDiscount : 0;

  return <div className="space-y-3">
    {/* Tier and duration together */}
    <section className={cn(card, "space-y-2.5 p-2.5")}>
      <div role="radiogroup" aria-label="AI Tier" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        {tiers.map((item) => <button key={item.planType} type="button" role="radio" aria-checked={tier === item.planType} onClick={() => setTier(item.planType)} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold transition", tier === item.planType ? "bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]" : "text-slate-600")}>
          {item.planType === "PROFESSIONAL" ? <Crown className="size-4" /> : <Sparkles className="size-4" />}{item.name}
        </button>)}
      </div>
      {tierInfo ? <p className="text-center text-[12px] text-slate-500">প্রতিদিন <b className="text-slate-800">{tierInfo.messagesPerDay}</b> message · <b className="text-slate-800">{tierInfo.scansPerDay}</b> scan · <b className="text-slate-800">{tierInfo.suggestionsPerDay}</b> suggestion</p> : null}
      {durations.length > 1 ? <div role="radiogroup" aria-label="মেয়াদ" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(durations.length, 4)}, minmax(0, 1fr))` }}>
        {durations.map((item) => <button key={item.id} type="button" role="radio" aria-checked={durationId === item.id} onClick={() => setDurationId(item.id)} className={cn("flex h-11 flex-col items-center justify-center rounded-xl text-[13px] font-semibold leading-tight ring-1 transition", durationId === item.id ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200")}>
          {item.label}
          {item.discountPct ? <span className={cn("text-[10.5px] font-bold", durationId === item.id ? "text-emerald-300" : "text-emerald-600")}>−{item.discountPct}%</span> : null}
        </button>)}
      </div> : null}
    </section>

    {/* All exams — best value */}
    {all ? <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-[1.5px] shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)]">
      <div className="rounded-[calc(1.5rem-1.5px)] bg-white p-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold">সব পরীক্ষা</span>
              <span className="rounded-full bg-amber-400 px-2 py-px text-[10.5px] font-bold text-amber-950">Best Value</span>
              {overview.catalog.allTracksDiscountPct ? <span className="rounded-full bg-emerald-50 px-2 py-px text-[10.5px] font-bold text-emerald-700">−{overview.catalog.allTracksDiscountPct}%</span> : null}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">{all.trackNames.join(" · ")}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-extrabold tabular-nums leading-tight">{taka(all.total)}</p>
            {saved ? <p className="text-[11px] font-semibold text-emerald-700">{taka(saved)} সাশ্রয়</p> : null}
          </div>
        </div>
        <button type="button" onClick={() => setPicked(all)} className="mt-2.5 flex h-10 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.99]">সব পরীক্ষা নিন</button>
      </div>
    </section> : null}

    {/* One exam, one line each */}
    <section className={cn(card, "overflow-hidden")}>
      <p className="px-3.5 pt-3 text-[12px] text-slate-500"><b className="text-slate-800">একটা পরীক্ষা</b> · প্রতিটায় System + {tierName}</p>
      <ul className="divide-y divide-slate-100">
        {singles.map((item) => <li key={item.key}>
          <button type="button" onClick={() => setPicked(item)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition active:bg-slate-50">
            <span className="min-w-0 flex-1 truncate font-semibold">{item.trackNames[0]}</span>
            <span className="shrink-0 font-bold tabular-nums">{taka(item.total)}</span>
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-[13px] font-semibold text-blue-700">নিন</span>
          </button>
        </li>)}
      </ul>
    </section>

    {/* The two tiers side by side, folded */}
    {overview.tiers.length > 1 ? <details className={cn(card, "group px-3.5 py-2.5 [&_summary::-webkit-details-marker]:hidden")}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold">AI Tier তুলনা <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>
      <table className="mt-2 w-full text-[13px]">
        <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">প্রতিদিন</th>{overview.tiers.map((item) => <th key={item.planType} className={cn("py-1 text-right font-semibold", item.planType === tier && "text-blue-700")}>{item.name}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {([["Message", "messagesPerDay"], ["ছবি/PDF scan", "scansPerDay"], ["Suggestion", "suggestionsPerDay"]] as const).map(([label, key]) => <tr key={key}><td className="py-1.5 text-slate-600">{label}</td>{overview.tiers.map((item) => <td key={item.planType} className={cn("py-1.5 text-right font-semibold tabular-nums", item.planType === tier && "text-blue-700")}>{item[key]}</td>)}</tr>)}
          <tr><td className="py-1.5 text-slate-600">মোট AI ব্যবহার</td>{overview.tiers.map((item) => <td key={item.planType} className={cn("py-1.5 text-right font-semibold tabular-nums", item.planType === tier && "text-blue-700")}>{item.aiTimes}×</td>)}</tr>
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] text-slate-500">দিনের সীমা প্রতিদিন রাত ১২টায় নতুন হয়।</p>
    </details> : null}
  </div>;
}
