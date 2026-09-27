"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Payment, PaymentAccount, PaymentMethod, PlanPackage } from "@prisma/client";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { formatTokens } from "@/lib/ai-limits";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { reviewPayment, savePaymentAccount, updatePackage } from "@/server/actions/billing";
import { Pagination } from "@/components/pagination";
import { methodNames, planInfo, taka } from "@/lib/billing-display";

type AdminPayment = Payment & { user: { name: string | null; email: string } };
type Tab = "payments" | "pricing" | "numbers";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<unknown>, success: string) => start(async () => {
    try { await action(); toast.success(success); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Something went wrong."); }
  });
  return { pending, run };
}

function PaymentRow({ payment }: { payment: AdminPayment }) {
  const { pending, run } = useAction();
  const [note, setNote] = useState("");
  const copy = (value: string) => void navigator.clipboard.writeText(value).then(() => toast.success("Copied"));
  return <li className={cn("rounded-xl border p-3", payment.status === "PENDING" ? "border-amber-200 bg-amber-50/50" : "border-zinc-200 bg-white")}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-medium">{payment.user.name || payment.user.email}</p>
        <p className="truncate text-xs text-zinc-500">{payment.user.email} · {formatDateTime(payment.createdAt)} · from {payment.source}</p>
      </div>
      <p className="text-right"><span className="text-lg font-semibold tabular-nums">{taka(payment.amountBdt)}</span><span className="block text-xs text-zinc-500">{planInfo[payment.planType].label} · {payment.packageName} · {payment.durationDays}d · {formatTokens(payment.tokens)}</span></p>
    </div>
    {payment.source === "gift" ? <p className="mt-2 text-sm text-zinc-600">🎁 Gift — no money was sent.</p> : <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-3">
      <div className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-100"><dt className="text-[11px] text-zinc-500">Method</dt><dd className="font-medium">{methodNames[payment.method]}</dd></div>
      <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-100"><div><dt className="text-[11px] text-zinc-500">Sender</dt><dd className="font-mono">{payment.senderNumber}</dd></div><button type="button" onClick={() => copy(payment.senderNumber)} aria-label="Copy sender number" className="rounded p-1.5 text-zinc-400 hover:text-zinc-900"><Copy className="size-3.5" /></button></div>
      <div className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-100"><div className="min-w-0"><dt className="text-[11px] text-zinc-500">TrxID</dt><dd className="truncate font-mono font-semibold">{payment.transactionId}</dd></div><button type="button" onClick={() => copy(payment.transactionId)} aria-label="Copy transaction ID" className="rounded p-1.5 text-zinc-400 hover:text-zinc-900"><Copy className="size-3.5" /></button></div>
    </dl>}
    {payment.status === "PENDING" ? <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note to the user (optional)" className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400" />
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => reviewPayment({ paymentId: payment.id, approve: false, note }), "Payment rejected")} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 sm:flex-none"><X className="size-4" /> Reject</button>
        <button type="button" disabled={pending} onClick={() => run(() => reviewPayment({ paymentId: payment.id, approve: true, note }), "Approved — benefit added")} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:flex-none"><Check className="size-4" /> Approve</button>
      </div>
    </div> : <p className={cn("mt-2 text-xs font-medium", payment.status === "APPROVED" ? "text-emerald-700" : "text-red-600")}>{payment.status === "APPROVED" ? "Approved" : "Rejected"}{payment.reviewedAt ? ` · ${formatDateTime(payment.reviewedAt)}` : ""}{payment.reviewedBy ? ` · ${payment.reviewedBy}` : ""}{payment.adminNote ? ` · “${payment.adminNote}”` : ""}</p>}
  </li>;
}

function PackageRow({ pkg }: { pkg: PlanPackage }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState({ name: pkg.name, priceBdt: String(pkg.priceBdt), durationDays: String(pkg.durationDays), tokens: String(pkg.tokens), active: pkg.active });
  const dirty = form.name !== pkg.name || Number(form.priceBdt) !== pkg.priceBdt || Number(form.durationDays) !== pkg.durationDays || Number(form.tokens) !== pkg.tokens || form.active !== pkg.active;
  const field = (key: "name" | "priceBdt" | "durationDays" | "tokens", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="min-w-0 space-y-1">
    <span className="text-[11px] text-zinc-500">{label}</span>
    <input value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm tabular-nums outline-none focus:border-zinc-400" {...props} />
  </label>;
  return <li className="rounded-xl border border-zinc-200 bg-white p-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {field("name", "Name")}
      {field("priceBdt", "Price (৳)", { inputMode: "numeric" })}
      {field("durationDays", "Days", { inputMode: "numeric" })}
      {field("tokens", "Tokens", { inputMode: "numeric" })}
    </div>
    <div className="mt-2 flex items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="size-4" /> On sale</label>
      <span className="text-xs text-zinc-500">{formatTokens(Number(form.tokens) || 0)} tokens · {taka(Number(form.priceBdt) || 0)}</span>
      <button type="button" disabled={!dirty || pending} onClick={() => run(() => updatePackage({ id: pkg.id, name: form.name, priceBdt: form.priceBdt, durationDays: form.durationDays, tokens: form.tokens, active: form.active }), "Price saved — new payments use it")} className="h-9 rounded-lg bg-zinc-950 px-3.5 text-sm font-medium text-white disabled:opacity-40">Save</button>
    </div>
  </li>;
}

function AccountRow({ method, account }: { method: PaymentMethod; account?: PaymentAccount }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState({ number: account?.number ?? "", accountType: account?.accountType ?? "Personal", enabled: account?.enabled ?? true });
  return <li className="rounded-xl border border-zinc-200 bg-white p-3">
    <p className="font-medium">{methodNames[method]}</p>
    <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
      <input value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} inputMode="tel" placeholder="01XXXXXXXXX" className="h-10 rounded-lg border border-zinc-200 px-3 font-mono text-sm outline-none focus:border-zinc-400" />
      <input value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value })} placeholder="Personal" className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400" />
    </div>
    <div className="mt-2 flex items-center justify-between">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4" /> Show to users</label>
      <button type="button" disabled={pending || !form.number.trim()} onClick={() => run(() => savePaymentAccount({ method, ...form }), `${methodNames[method]} saved`)} className="h-9 rounded-lg bg-zinc-950 px-3.5 text-sm font-medium text-white disabled:opacity-40">Save</button>
    </div>
  </li>;
}

/** Admins: check and approve payments, set prices/days/tokens, and set where users send money. */
export function AdminBilling({ payments, pendingCount, page, limit, total, packages, accounts }: {
  payments: AdminPayment[];
  pendingCount: number;
  page: number;
  limit: number;
  total: number;
  packages: PlanPackage[];
  accounts: PaymentAccount[];
}) {
  const [tab, setTab] = useState<Tab>("payments");
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "payments", label: `Payments${pendingCount ? ` (${pendingCount})` : ""}` },
    { id: "pricing", label: "Pricing" },
    { id: "numbers", label: "Payment numbers" },
  ];
  return <div className="mx-auto max-w-3xl space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-zinc-500">Approve a payment after matching its Transaction ID in bKash/Nagad. Price changes apply to new payments only.</p>
    </div>
    <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn("h-9 truncate rounded-lg px-2 text-sm font-medium", tab === item.id ? "bg-white shadow-sm" : "text-zinc-500")}>{item.label}</button>)}
    </div>

    {tab === "payments" ? (payments.length
      ? <div className="space-y-3">
        <ul className="space-y-2">{payments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)}</ul>
        <Pagination page={page} limit={limit} total={total} label="payments" />
      </div>
      : <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">No payments yet.</p>) : null}

    {tab === "pricing" ? <div className="space-y-4">
      {(["STUDENT", "PROFESSIONAL"] as const).map((type) => <section key={type}>
        <h2 className={cn("mb-2 text-sm font-semibold", planInfo[type].accent)}>{planInfo[type].label} Plan</h2>
        <ul className="space-y-2">{packages.filter((pkg) => pkg.planType === type).map((pkg) => <PackageRow key={pkg.id} pkg={pkg} />)}</ul>
      </section>)}
    </div> : null}

    {tab === "numbers" ? <ul className="space-y-2">
      {(["BKASH", "NAGAD"] as const).map((method) => <AccountRow key={method} method={method} account={accounts.find((item) => item.method === method)} />)}
    </ul> : null}
  </div>;
}
