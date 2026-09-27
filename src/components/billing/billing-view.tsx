import type { Payment, PaymentAccount, PlanPackage } from "@prisma/client";
import { CalendarClock, ChevronDown, Coins, Sparkles } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { PlanStatus } from "@/server/billing";
import { PlanPurchase } from "@/components/billing/plan-purchase";
import { methodNames, planInfo, taka } from "@/lib/billing-display";

const statusStyle = {
  PENDING: { label: "অপেক্ষায়", className: "bg-amber-50 text-amber-800 ring-amber-100" },
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-700 ring-red-100" },
} as const;

/** The signed-in user's plan: what they have left, how to buy more, and every payment they made. */
export function BillingView({ packages, accounts, plan, payments }: { packages: PlanPackage[]; accounts: PaymentAccount[]; plan: PlanStatus; payments: Payment[] }) {
  const pending = payments.filter((payment) => payment.status === "PENDING").length;
  const leftPercent = plan.tokensTotal ? Math.round((plan.tokensLeft / plan.tokensTotal) * 100) : 0;
  // Compact enough to fit one phone screen: a one-line plan summary, the picker, and folded history.
  return <div className="mx-auto max-w-3xl space-y-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Plans</h1>
      <p className="text-xs text-zinc-500 sm:text-sm">নতুন কিনলে আগের বাকি দিন আর ব্যবহারের সাথে যোগ হয় — কিছু হারায় না।</p>
    </div>

    <section className={cn("rounded-xl border px-3 py-2.5", plan.active ? "border-emerald-200 bg-emerald-50/60" : "border-zinc-200 bg-white")}>
      {plan.hasPlan ? <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Sparkles className="size-4 shrink-0 text-emerald-700" />
        {plan.active
          ? <><span className="font-semibold tabular-nums">{plan.daysLeft} দিন বাকি</span><span className="text-zinc-300">·</span><span className={cn("font-semibold tabular-nums", leftPercent <= 0 && "text-red-600")}>{leftPercent}% বাকি</span><span className="text-zinc-300">·</span><span className="text-zinc-600">{plan.endsAt ? formatDate(plan.endsAt) : ""} পর্যন্ত</span></>
          : <span className="font-semibold text-red-600">Plan-এর মেয়াদ শেষ{plan.endsAt ? ` (${formatDate(plan.endsAt)})` : ""}</span>}
      </p> : <p className="flex items-center gap-2 text-sm text-zinc-600"><Sparkles className="size-4" /> এখনো কোনো plan নেই — নিচে থেকে বেছে নাও।</p>}
      {pending ? <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-800"><CalendarClock className="size-3.5" /> {pending}টা payment যাচাইয়ের অপেক্ষায় — approve হলে যোগ হবে।</p> : null}
    </section>

    <section className="rounded-xl border border-zinc-200 bg-white p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Coins className="size-4" /> {plan.hasPlan ? "আরও কেনো" : "Plan বাছো"}</h2>
      <PlanPurchase packages={packages} accounts={accounts} source="page" />
    </section>

    {payments.length ? <details className="group rounded-xl border border-zinc-200 bg-white px-3 py-2.5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Payment history ({payments.length}) <ChevronDown className="size-4 text-zinc-400 transition-transform group-open:rotate-180" /></summary>
      <ul className="mt-2 divide-y divide-zinc-100">
        {payments.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{planInfo[payment.planType].label} · {payment.packageName} <span className="tabular-nums text-zinc-600">{taka(payment.amountBdt)}</span></p>
            <p className="text-xs text-zinc-500">{payment.source === "gift" ? "🎁 উপহার" : <>{methodNames[payment.method]} · TrxID <span className="font-mono">{payment.transactionId}</span></>} · {formatDateTime(payment.createdAt)}</p>
            {payment.adminNote ? <p className="mt-0.5 text-xs text-zinc-600">Admin: {payment.adminNote}</p> : null}
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", statusStyle[payment.status].className)}>{statusStyle[payment.status].label}</span>
        </li>)}
      </ul>
    </details> : null}
  </div>;
}
