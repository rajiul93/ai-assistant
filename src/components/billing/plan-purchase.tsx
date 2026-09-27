"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentAccount, PaymentMethod, PlanPackage, PlanType } from "@prisma/client";
import { ArrowLeft, Check, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { methodNames, planInfo, taka } from "@/lib/billing-display";
import { cn } from "@/lib/utils";
import { submitPayment } from "@/server/actions/billing";

const methodStyles: Record<PaymentMethod, string> = {
  BKASH: "border-pink-200 bg-pink-50 text-pink-700 data-[on=true]:border-pink-600 data-[on=true]:ring-2 data-[on=true]:ring-pink-200",
  NAGAD: "border-orange-200 bg-orange-50 text-orange-700 data-[on=true]:border-orange-600 data-[on=true]:ring-2 data-[on=true]:ring-orange-200",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <button
    type="button"
    onClick={() => { void navigator.clipboard.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => toast.error("Couldn't copy.")); }}
    aria-label={`Copy ${label}`}
    className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-white hover:text-zinc-900"
  >{copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}</button>;
}

/**
 * The whole purchase: plan → package → payment method → Send Money → sender number → Transaction
 * ID → submit. Prices, days and tokens all come from the database (`packages`); the same flow runs
 * on the Plans page and inside the chat.
 */
export function PlanPurchase({ packages, accounts, source, onSubmitted }: {
  packages: PlanPackage[];
  accounts: PaymentAccount[];
  source: "page" | "chat";
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const types = (["STUDENT", "PROFESSIONAL"] as const).filter((type) => packages.some((pkg) => pkg.planType === type));
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [sender, setSender] = useState("");
  const [trxId, setTrxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ amount: number; name: string } | null>(null);

  const pkg = packages.find((item) => item.id === packageId) ?? null;
  // Customers never see token counts; a package's AI allowance is shown relative to the smallest one.
  const baseTokens = Math.min(...packages.map((item) => item.tokens));
  const usageTimes = (tokens: number) => `${Number((tokens / baseTokens).toFixed(1))}×`;
  const account = accounts.find((item) => item.method === method) ?? null;

  async function submit() {
    if (!pkg || !method) return;
    setSaving(true);
    try {
      const result = await submitPayment({ packageId: pkg.id, method, senderNumber: sender, transactionId: trxId, source });
      setDone({ amount: result.amountBdt, name: `${planInfo[pkg.planType].label} · ${pkg.name}` });
      onSubmitted?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't submit the payment.");
    } finally {
      setSaving(false);
    }
  }

  if (!packages.length) return <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">No packages are on sale right now.</p>;

  if (done) return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
    <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5" /> Payment submitted</p>
    <p className="mt-1.5">{done.name} — {taka(done.amount)}. Admin Transaction ID মিলিয়ে দেখে approve করলেই তোমার plan চালু হবে। বাকি দিন আর ব্যবহার থাকলে সেগুলোর সাথে যোগ হবে।</p>
  </div>;

  const step = !planType ? 1 : !pkg ? 2 : !method ? 3 : 4;
  const back = () => { if (step === 4) setMethod(null); else if (step === 3) setPackageId(null); else setPlanType(null); };

  return <div className="space-y-3">
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      {step > 1 ? <button type="button" onClick={back} className="flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-zinc-700 hover:bg-zinc-100"><ArrowLeft className="size-3.5" /> Back</button> : null}
      <span>ধাপ {step} / 4 · {["Plan বাছো", "Package বাছো", "কীভাবে পাঠাবে", "টাকা পাঠিয়ে তথ্য দাও"][step - 1]}</span>
    </div>

    {step === 1 ? <div className={cn("grid gap-2", source === "page" && "sm:grid-cols-2")}>
      {types.map((type) => {
        const info = planInfo[type];
        const Icon = info.icon;
        const options = packages.filter((item) => item.planType === type);
        return <button key={type} type="button" onClick={() => setPlanType(type)} className={cn("rounded-xl border p-3 text-left transition hover:shadow-md active:scale-[0.99]", info.card)}>
          <span className={cn("flex items-center gap-2 font-semibold", info.accent)}><Icon className="size-5" /> {info.label} Plan</span>
          <span className="mt-0.5 block text-xs text-zinc-600">{info.blurb}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">{options.map((item) => <span key={item.id} className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-800 ring-1 ring-black/5">{item.name} · {taka(item.priceBdt)}</span>)}</span>
        </button>;
      })}
    </div> : null}

    {step === 2 && planType ? <div className={cn("grid gap-2", source === "page" && "sm:grid-cols-2")}>
      {packages.filter((item) => item.planType === planType).map((item) => <button key={item.id} type="button" onClick={() => setPackageId(item.id)} className={cn("rounded-xl border p-3 text-left transition hover:shadow-md active:scale-[0.99]", planInfo[planType].card)}>
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{item.name}</span>
          <span className="text-xl font-bold tabular-nums">{taka(item.priceBdt)}</span>
        </span>
        <span className="mt-1 block text-xs text-zinc-600">{item.durationDays} দিন · {usageTimes(item.tokens)} AI ব্যবহার</span>
        <span className="mt-0.5 block text-[11px] text-zinc-500">দিনে প্রায় {taka(Math.round(item.priceBdt / item.durationDays))}</span>
      </button>)}
    </div> : null}

    {step === 3 && pkg ? <div className="space-y-2">
      <p className="text-sm text-zinc-600">{planInfo[pkg.planType].label} · {pkg.name} — <span className="font-semibold text-zinc-900">{taka(pkg.priceBdt)}</span></p>
      {accounts.length ? <div className="grid grid-cols-2 gap-2">
        {accounts.map((item) => <button key={item.method} type="button" data-on={method === item.method} onClick={() => setMethod(item.method)} className={cn("rounded-xl border px-3 py-3 text-center text-sm font-semibold transition", methodStyles[item.method])}>{methodNames[item.method]}</button>)}
      </div> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">এখন কোনো payment নম্বর সেট করা নেই। একটু পরে আবার চেষ্টা করো।</p>}
    </div> : null}

    {step === 4 && pkg && account ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="rounded-xl bg-zinc-50 p-3 text-sm">
        <p className="font-medium">{methodNames[account.method]} app থেকে <span className="font-semibold">Send Money</span> করো:</p>
        <dl className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 ring-1 ring-zinc-200"><dt className="w-16 shrink-0 text-xs text-zinc-500">নম্বর</dt><dd className="flex-1 font-mono text-base font-semibold">{account.number}</dd><span className="text-[11px] text-zinc-400">{account.accountType}</span><CopyButton value={account.number} label="number" /></div>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 ring-1 ring-zinc-200"><dt className="w-16 shrink-0 text-xs text-zinc-500">টাকা</dt><dd className="flex-1 text-base font-semibold tabular-nums">{taka(pkg.priceBdt)}</dd><CopyButton value={String(pkg.priceBdt)} label="amount" /></div>
        </dl>
        <p className="mt-2 text-xs text-zinc-500">টাকা পাঠানোর পর SMS-এ আসা Transaction ID নিচে দাও।</p>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-600">যে নম্বর থেকে পাঠিয়েছ</span>
        <input value={sender} onChange={(event) => setSender(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" className="h-11 w-full rounded-lg border border-zinc-200 px-3 font-mono outline-none focus:border-zinc-400" required />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-600">Transaction ID (TrxID)</span>
        <input value={trxId} onChange={(event) => setTrxId(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="যেমন 9GH4K2L8QX" className="h-11 w-full rounded-lg border border-zinc-200 px-3 font-mono uppercase outline-none focus:border-zinc-400" required />
      </label>
      <button type="submit" disabled={saving || !sender.trim() || !trxId.trim()} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50">
        {saving ? <Loader2 className="size-4 animate-spin" /> : null} Submit payment · {taka(pkg.priceBdt)}
      </button>
    </form> : null}
  </div>;
}
