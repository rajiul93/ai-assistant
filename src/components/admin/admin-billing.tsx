"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Payment, PaymentAccount, PaymentMethod } from "@prisma/client";
import { Check, Copy, MessageSquarePlus, X } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { reviewPayment, savePaymentAccount } from "@/server/actions/billing";
import { PricingPanel, type PricingAdmin } from "@/components/admin/pricing-panel";
import { Pagination } from "@/components/pagination";
import { methodNames, planInfo, taka } from "@/lib/billing-display";
import { errorMessage } from "@/lib/user-error";

type AdminPayment = Payment & { user: { name: string | null; email: string } };
type Tab = "payments" | "pricing" | "numbers";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<unknown>, success: string) => start(async () => {
    try { await action(); toast.success(success); router.refresh(); } catch (error) { toast.error(errorMessage(error, "Something went wrong.")); }
  });
  return { pending, run };
}

const methodChip: Record<PaymentMethod, string> = { BKASH: "bg-pink-100 text-pink-700", NAGAD: "bg-orange-100 text-orange-700", SSLCOMMERZ: "bg-blue-100 text-blue-700" };

/** What was bought. New plans carry their tier in the name already ("BCS · Student AI · ১ মাস"); old packages don't. */
const planLabel = (payment: AdminPayment) => (payment.breakdown ? payment.packageName : `${planInfo[payment.planType].label} · ${payment.packageName}`);

/** Compact on phones: who (name and email) and how much, the TrxID to match (with copy), then Approve/Reject. */
function PaymentRow({ payment }: { payment: AdminPayment }) {
  const { pending, run } = useAction();
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const copy = (value: string, what: string) => void navigator.clipboard.writeText(value).then(() => toast.success(`${what} copied`));
  const isPending = payment.status === "PENDING";
  const gift = payment.source === "gift";

  if (!isPending) {
    // Reviewed: one short line, so the ones still waiting stand out.
    return <li className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm"><span className="font-medium">{payment.user.name || payment.user.email}</span> <span className="text-zinc-500">· {planLabel(payment)}</span></p>
        {payment.user.name ? <p className="truncate text-[11px] text-zinc-500">{payment.user.email}</p> : null}
        <p className="truncate text-[11px] text-zinc-500">{gift ? "🎁 Gift" : <>{methodNames[payment.method]} · <span className="font-mono">{payment.transactionId}</span></>} · {formatDateTime(payment.createdAt)}{payment.adminNote ? ` · “${payment.adminNote}”` : ""}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{taka(payment.amountBdt)}</p>
        <p className={cn("text-[11px] font-semibold", payment.status === "APPROVED" ? "text-emerald-700" : "text-red-600")}>{payment.status === "APPROVED" ? "✓ Approved" : "✕ Rejected"}</p>
      </div>
    </li>;
  }

  return <li className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 sm:p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{payment.user.name || <span className="font-normal text-zinc-400">নাম দেওয়া নেই</span>}</p>
        <button type="button" onClick={() => copy(payment.user.email, "Email")} title="Email কপি করুন" className="flex max-w-full items-center gap-1 truncate text-left text-xs text-zinc-600 hover:text-zinc-950"><span className="truncate">{payment.user.email}</span><Copy className="size-3 shrink-0 text-zinc-400" /></button>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
          <span className={cn("rounded px-1.5 py-px font-semibold", methodChip[payment.method])}>{methodNames[payment.method]}</span>
          <span>{planLabel(payment)}</span>
          <span className="text-zinc-400">{formatDateTime(payment.createdAt)}</span>
        </p>
      </div>
      <p className="shrink-0 text-lg font-bold tabular-nums">{taka(payment.amountBdt)}</p>
    </div>

    {/* What to match in the bKash/Nagad app: the TrxID and the sender, each a tap to copy. */}
    <div className="mt-2 grid grid-cols-[1.25fr_1fr] divide-x divide-amber-100 rounded-lg bg-white ring-1 ring-amber-100">
      <button type="button" onClick={() => copy(payment.transactionId, "TrxID")} className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-zinc-50">
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-medium uppercase tracking-wide text-zinc-400">TrxID</span><span className="block truncate font-mono text-[15px] font-semibold">{payment.transactionId}</span></span>
        <Copy className="size-3.5 shrink-0 text-zinc-400" />
      </button>
      <button type="button" onClick={() => copy(payment.senderNumber, "Number")} className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-zinc-50">
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-medium uppercase tracking-wide text-zinc-400">From</span><span className="block truncate font-mono text-[13px] font-medium">{payment.senderNumber}</span></span>
        <Copy className="size-3.5 shrink-0 text-zinc-400" />
      </button>
    </div>

    {noting ? <input value={note} onChange={(event) => setNote(event.target.value)} autoFocus placeholder="Note to the user (optional)" className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400" /> : null}
    <div className="mt-2 flex gap-2">
      {noting ? null : <button type="button" onClick={() => setNoting(true)} aria-label="Note যোগ করুন" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white"><MessageSquarePlus className="size-4" /></button>}
      <button type="button" disabled={pending} onClick={() => run(() => reviewPayment({ paymentId: payment.id, approve: false, note }), "Payment rejected")} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"><X className="size-4" /> Reject</button>
      <button type="button" disabled={pending} onClick={() => run(() => reviewPayment({ paymentId: payment.id, approve: true, note }), "Approved — benefit added")} className="flex h-10 flex-[1.4] items-center justify-center gap-1 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="size-4" /> Approve</button>
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
const statusFilters = [
  { value: "PENDING", label: "Pending" },
  { value: "ALL", label: "All" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;
export type PaymentFilter = (typeof statusFilters)[number]["value"];

/** Status filter chips; the choice lives in the URL (?status=), with the page reset to 1. */
function StatusFilter({ value, pendingCount }: { value: PaymentFilter; pendingCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const choose = (next: PaymentFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "PENDING") params.delete("status"); else params.set("status", next);
    params.delete("page");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };
  return <div role="tablist" aria-label="Payment status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
    {statusFilters.map((item) => <button key={item.value} type="button" role="tab" aria-selected={value === item.value} onClick={() => choose(item.value)} className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium", value === item.value ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700")}>
      {item.label}{item.value === "PENDING" && pendingCount ? <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", value === item.value ? "bg-white/20" : "bg-amber-100 text-amber-800")}>{pendingCount}</span> : null}
    </button>)}
  </div>;
}

export function AdminBilling({ payments, status, pendingCount, page, limit, total, pricing, gatewayConfigured, accounts }: {
  payments: AdminPayment[];
  status: PaymentFilter;
  pendingCount: number;
  page: number;
  limit: number;
  total: number;
  /** Only for the super admin, who alone sets prices. */
  pricing: PricingAdmin | null;
  gatewayConfigured: boolean;
  accounts: PaymentAccount[];
}) {
  const [tab, setTab] = useState<Tab>("payments");
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "payments", label: `Payments${pendingCount ? ` ${pendingCount}` : ""}` },
    { id: "pricing", label: "Prices" },
    { id: "numbers", label: "Numbers" },
  ];
  return <div className="space-y-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Billing</h1>
      <p className="hidden text-sm text-zinc-500 sm:block">bKash/Nagad-এর TrxID মিলিয়ে approve করুন; online payment নিজে থেকেই approve হয়। নতুন দাম শুধু নতুন কেনায় লাগে।</p>
    </div>
    <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn("h-9 truncate rounded-lg px-2 text-sm font-medium", tab === item.id ? "bg-white shadow-sm" : "text-zinc-500")}>{item.label}</button>)}
    </div>

    {tab === "payments" ? <div className="space-y-3">
      <StatusFilter value={status} pendingCount={pendingCount} />
      {payments.length
        ? <>
          <ul className="space-y-2">{payments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)}</ul>
          <Pagination page={page} limit={limit} total={total} label="payments" />
        </>
        : <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{status === "PENDING" ? "Nothing waiting for approval. 🎉" : "No payments here."}</p>}
    </div> : null}

    {tab === "pricing" ? pricing
      ? <PricingPanel data={pricing} gatewayConfigured={gatewayConfigured} />
      : <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">দাম শুধু super admin বদলাতে পারেন।</p> : null}

    {tab === "numbers" ? <ul className="space-y-2">
      {(["BKASH", "NAGAD"] as const).map((method) => <AccountRow key={method} method={method} account={accounts.find((item) => item.method === method)} />)}
    </ul> : null}
  </div>;
}
