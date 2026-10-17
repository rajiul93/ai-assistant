"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, HandCoins, Loader2, Plus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { taka } from "@/lib/billing-display";
import { formatDateTime } from "@/lib/dayjs";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { recordAffiliatePayout, saveAffiliateSettings, setAffiliateActive, voidAffiliateCommission, type getAffiliateAdmin } from "@/server/actions/affiliate";

type Data = Awaited<ReturnType<typeof getAffiliateAdmin>>;
type Settings = Data["settings"];
type Affiliate = Data["affiliates"][number];

const card = "rounded-2xl border border-zinc-200 bg-white p-4";
const field = "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400";

/** A server action with a toast and a refresh. */
function useRun() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (action: () => Promise<unknown>, done: string, after?: () => void) => start(async () => {
    try {
      await action();
      toast.success(done);
      after?.();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "করা গেল না।"));
    }
  });
  return { busy, run };
}

/** Two (or more) choices, one active — every rule of the program is one of these. */
function Choice<T extends string | boolean>({ label, value, options, onChange, disabled }: { label: string; value: T; options: Array<{ value: T; label: string; hint?: string }>; onChange: (value: T) => void; disabled: boolean }) {
  return <fieldset className="space-y-1.5">
    <legend className="text-sm font-medium text-zinc-700">{label}</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const on = option.value === value;
        return <button key={String(option.value)} type="button" disabled={disabled} onClick={() => onChange(option.value)} aria-pressed={on}
          className={cn("rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed", on ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-zinc-200 hover:bg-zinc-50")}>
          <span className="flex items-center gap-2 font-semibold">{on ? <Check className="size-4 text-emerald-600" /> : <span className="size-4 rounded-full border border-zinc-300" />}{option.label}</span>
          {option.hint ? <span className="mt-0.5 block pl-6 text-xs text-zinc-500">{option.hint}</span> : null}
        </button>;
      })}
    </div>
  </fieldset>;
}

function Rules({ initial, editable }: { initial: Settings; editable: boolean }) {
  const [form, setForm] = useState({ ...initial });
  const { busy, run } = useRun();
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((current) => ({ ...current, [key]: value }));
  const number = (value: string) => Number(value.replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit))) || 0);

  return <section className={cn(card, "space-y-4")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">নিয়ম</h2>
      {editable ? null : <span className="text-xs text-zinc-500">শুধু super admin বদলাতে পারে</span>}
    </div>
    <Choice label="Affiliate program" value={form.enabled} onChange={(value) => set("enabled", value)} disabled={!editable}
      options={[{ value: true, label: "চালু" }, { value: false, label: "বন্ধ", hint: "কেউ নতুন commission পাবে না, link-ও গুনবে না" }]} />
    <Choice label="কে affiliate হবে" value={form.openToAll} onChange={(value) => set("openToAll", value)} disabled={!editable}
      options={[{ value: false, label: "শুধু admin যাদের বাছবে", hint: "নিচে email দিয়ে যোগ করো" }, { value: true, label: "সবাই", hint: "প্রত্যেক user নিজের link পাবে" }]} />
    <Choice label="Commission" value={form.commissionMode} onChange={(value) => set("commissionMode", value)} disabled={!editable}
      options={[{ value: "PERCENT", label: "দামের শতাংশ" }, { value: "FIXED", label: "নির্দিষ্ট টাকা" }]} />
    {form.commissionMode === "PERCENT"
      ? <label className="block space-y-1"><span className="text-sm text-zinc-600">শতাংশ (%)</span><input value={form.percent} onChange={(event) => set("percent", number(event.target.value))} inputMode="numeric" disabled={!editable} className={field} /></label>
      : <label className="block space-y-1"><span className="text-sm text-zinc-600">প্রতি কেনায় টাকা (৳)</span><input value={form.fixedBdt} onChange={(event) => set("fixedBdt", number(event.target.value))} inputMode="numeric" disabled={!editable} className={field} /></label>}
    <Choice label="কোন কেনায়" value={form.recurring} onChange={(value) => set("recurring", value)} disabled={!editable}
      options={[{ value: false, label: "শুধু প্রথম কেনায়" }, { value: true, label: "প্রতিটা কেনায়", hint: "Renew করলেও" }]} />
    <label className="block space-y-1"><span className="text-sm text-zinc-600">সময়সীমা (দিন) — link-এ click করার কত দিনের মধ্যে ঢুকলে বা কিনলে গুনবে</span>
      <input value={form.windowDays} onChange={(event) => set("windowDays", number(event.target.value))} inputMode="numeric" disabled={!editable} className={field} /></label>
    <Choice label="পাওনা কীভাবে দেওয়া হবে" value={form.payoutMode} onChange={(value) => set("payoutMode", value)} disabled={!editable}
      options={[{ value: "CASH", label: "টাকা (bKash/Nagad)", hint: "Admin পাঠিয়ে এখানে লিখে রাখবে" }, { value: "CREDIT", label: "Plan-এর ছাড়", hint: "Affiliate নিজে plan কিনলে দাম থেকে কাটা যাবে" }]} />
    {editable ? <button type="button" disabled={busy} onClick={() => run(() => saveAffiliateSettings({ enabled: form.enabled, openToAll: form.openToAll, commissionMode: form.commissionMode, percent: form.percent, fixedBdt: form.fixedBdt, recurring: form.recurring, windowDays: form.windowDays, payoutMode: form.payoutMode }), "নিয়ম সেভ হলো")}
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} সেভ</button> : null}
  </section>;
}

function PayoutDialog({ affiliate, onClose }: { affiliate: Affiliate | null; onClose: () => void }) {
  const [amount, setAmount] = useState(String(affiliate?.balanceBdt ?? ""));
  const [note, setNote] = useState("");
  const { busy, run } = useRun();
  return <Dialog open={Boolean(affiliate)} onOpenChange={(open) => !open && !busy && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>টাকা পাঠানো লিখে রাখো</DialogTitle></DialogHeader>
      {affiliate ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); run(() => recordAffiliatePayout({ affiliateId: affiliate.id, amountBdt: Number(amount) || 0, note }), "লিখে রাখা হলো", onClose); }}>
        <p className="text-sm text-zinc-600">{affiliate.name ?? affiliate.email} · পাওনা {taka(affiliate.balanceBdt)}{affiliate.affiliatePayoutNumber ? ` · নম্বর ${affiliate.affiliatePayoutNumber.replace(/^\+88/, "")}` : " · নম্বর দেয়নি"}</p>
        <label className="block space-y-1"><span className="text-sm text-zinc-600">কত টাকা পাঠালে (৳)</span><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={field} /></label>
        <label className="block space-y-1"><span className="text-sm text-zinc-600">নোট (TrxID ইত্যাদি)</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} className={field} /></label>
        <button type="submit" disabled={busy || !Number(amount)} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} সেভ</button>
      </form> : null}
    </DialogContent>
  </Dialog>;
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }): ReactNode {
  return <span className="flex flex-col"><span className="text-[11px] text-zinc-500">{label}</span><span className={cn("tabular-nums", strong ? "font-bold text-emerald-700" : "font-medium")}>{taka(value)}</span></span>;
}

/**
 * /admin/affiliates (docs/affiliate-plan.md): the rules — every choice two-way, the super admin
 * picks which is active — the affiliates with what their links brought and what they are owed,
 * and the latest commissions (void one after a refund).
 */
export function AffiliateAdmin({ data }: { data: Data }) {
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState<Affiliate | null>(null);
  const { busy, run } = useRun();
  const { settings } = data;

  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Affiliates</h1>
      <p className="mt-1 text-sm text-zinc-500">Link-এ `?ref=CODE` — Facebook, WhatsApp, Messenger, Telegram, email, SMS বা যেখানেই share হোক, click থেকে কেনা পর্যন্ত নিজে থেকে গোনা হয়।</p>
    </div>

    <Rules initial={settings} editable={data.canEditRules} />

    <section className={cn(card, "space-y-3")}>
      <h2 className="font-semibold">Affiliate ({data.affiliates.length})</h2>
      {settings.openToAll ? <p className="text-sm text-zinc-500">এখন সবাই affiliate — যাদের link কাজে লেগেছে তারা এখানে দেখাবে।</p> : null}
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (email.trim()) run(() => setAffiliateActive({ email, active: true }), "Affiliate বানানো হলো", () => setEmail("")); }}>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="user-এর email" aria-label="Affiliate বানাতে email" className={cn(field, "h-11 min-w-0 flex-1")} />
        <button type="submit" disabled={busy || !email.trim()} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Plus className="size-4" /> যোগ</button>
      </form>
      {data.affiliates.length ? <ul className="space-y-2">
        {data.affiliates.map((affiliate) => <li key={affiliate.id} className="rounded-xl border border-zinc-200 p-3">
          <div className="flex flex-wrap items-start gap-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{affiliate.name ?? affiliate.email}</span>
              <span className="block truncate text-xs text-zinc-500">{affiliate.email}{affiliate.affiliateCode ? <> · code <span className="font-mono">{affiliate.affiliateCode}</span></> : null}{affiliate.affiliatePayoutNumber ? ` · ${affiliate.affiliatePayoutNumber.replace(/^\+88/, "")}` : ""}</span>
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", affiliate.earning ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600")}>{affiliate.earning ? "চালু" : "বন্ধ"}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
            <span className="flex flex-col"><span className="text-[11px] text-zinc-500">Click</span><span className="font-medium tabular-nums">{affiliate.clicks}</span></span>
            <span className="flex flex-col"><span className="text-[11px] text-zinc-500">ঢুকেছে</span><span className="font-medium tabular-nums">{affiliate.signups}</span></span>
            <Money label="মোট আয়" value={affiliate.earnedBdt} />
            <Money label="পাঠানো" value={affiliate.paidBdt} />
            <Money label="Plan-এ কাটা" value={affiliate.creditUsedBdt} />
            <Money label="পাওনা" value={affiliate.balanceBdt} strong />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {affiliate.balanceBdt > 0 ? <button type="button" onClick={() => setPaying(affiliate)} className="flex h-9 items-center gap-1.5 rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white"><HandCoins className="size-4" /> টাকা দিয়েছি</button> : null}
            {settings.openToAll ? null : affiliate.affiliateActive
              ? <button type="button" disabled={busy} onClick={() => run(() => setAffiliateActive({ email: affiliate.email, active: false }), "Affiliate বন্ধ হলো")} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"><UserMinus className="size-4" /> বন্ধ করো</button>
              : <button type="button" disabled={busy} onClick={() => run(() => setAffiliateActive({ email: affiliate.email, active: true }), "Affiliate চালু হলো")} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50"><Check className="size-4" /> চালু করো</button>}
          </div>
        </li>)}
      </ul> : <p className="text-sm text-zinc-500">এখনো কেউ নেই।</p>}
    </section>

    <section className={cn(card, "space-y-2")}>
      <h2 className="font-semibold">শেষ commission-গুলো</h2>
      {data.commissions.length ? <ul className="divide-y divide-zinc-100">
        {data.commissions.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{item.affiliate.name ?? item.affiliate.email} ← {item.customer.name ?? item.customer.email}</span>
            <span className="block text-xs text-zinc-500">{taka(item.basisBdt)}-এর {item.rule} · {formatDateTime(item.createdAt)}{item.canceledAt ? " · বাতিল" : ""}</span>
          </span>
          <span className={cn("font-semibold tabular-nums", item.canceledAt ? "text-zinc-400 line-through" : "text-emerald-700")}>{taka(item.amountBdt)}</span>
          {item.canceledAt ? null : <button type="button" disabled={busy} onClick={() => { if (window.confirm("এই commission বাতিল করবে? (refund হলে)")) run(() => voidAffiliateCommission(item.id), "বাতিল হলো"); }} aria-label="Commission বাতিল করো" title="বাতিল (refund হলে)" className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Ban className="size-4" /></button>}
        </li>)}
      </ul> : <p className="text-sm text-zinc-500">এখনো নেই।</p>}
    </section>

    <PayoutDialog key={paying?.id ?? "none"} affiliate={paying} onClose={() => setPaying(null)} />
  </div>;
}
