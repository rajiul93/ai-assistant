import { CalendarClock, CheckCircle2, ChevronDown, Crown, Sparkles, XCircle } from "lucide-react";
import { APP_TIMEZONE, dayjs, formatDateTime } from "@/lib/dayjs";
import { methodNames, taka } from "@/lib/billing-display";
import { cn } from "@/lib/utils";
import { PlanShop, type BillingOverview } from "@/components/billing/plan-shop";

const statusStyle = {
  PENDING: { label: "অপেক্ষায়", className: "bg-amber-50 text-amber-800 ring-amber-100" },
  APPROVED: { label: "চালু হয়েছে", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  REJECTED: { label: "বাতিল", className: "bg-red-50 text-red-700 ring-red-100" },
} as const;

const kindLabels = { message: "Message", scan: "Scan", suggestion: "Suggestion" } as const;
const shortDate = (date: Date) => dayjs(date).tz(APP_TIMEZONE).format("D MMM YYYY");

/** What came back from the online payment page (?payment=…). */
const paymentNotes = {
  success: { icon: CheckCircle2, text: "Payment হয়েছে — plan চালু হয়ে গেছে।", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  pending: { icon: CalendarClock, text: "Payment যাচাই হচ্ছে। কয়েক মিনিটের মধ্যে plan চালু হবে; না হলে admin-কে জানান।", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  failed: { icon: XCircle, text: "Payment হয়নি। আবার চেষ্টা করুন বা bKash/Nagad দিয়ে দিন।", className: "bg-red-50 text-red-700 ring-red-200" },
  cancelled: { icon: XCircle, text: "Payment বাতিল করেছেন — কোনো টাকা কাটা হয়নি।", className: "bg-slate-100 text-slate-700 ring-slate-200" },
} as const;

/** The Plans page: what the user has now, today's AI use, choosing and paying, and past payments. */
export function BillingView({ overview, paymentResult }: { overview: BillingOverview; paymentResult?: keyof typeof paymentNotes }) {
  const { plan, running, today, payments } = overview;
  const pending = payments.filter((payment) => payment.status === "PENDING").length;
  const note = paymentResult ? paymentNotes[paymentResult] : null;

  return <div className="space-y-3">
    {/* One small banner: what runs now (one line each), today's AI use, and payments waiting. */}
    <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3.5 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)]">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold tracking-tight">Plans</h1>
        {pending ? <span className="flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-950"><CalendarClock className="size-3.5" /> {pending}টা যাচাইয়ে</span> : null}
      </div>
      {running.length ? <ul className="mt-2 space-y-1">
        {running.map((item, index) => <li key={index} className="flex items-center gap-2 rounded-xl bg-white/15 px-2.5 py-1.5 text-[13px] ring-1 ring-white/20">
          {item.planType === "PROFESSIONAL" ? <Crown className="size-4 shrink-0" /> : <Sparkles className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1 truncate font-semibold">{item.exams === null || item.allTracks ? "সব পরীক্ষা" : item.exams.join(", ")} · {item.planType === "PROFESSIONAL" ? "Professional" : "Student"}</span>
          <span className="shrink-0 text-[11.5px] text-white/85">{shortDate(item.endsAt)} পর্যন্ত</span>
        </li>)}
      </ul> : <p className="mt-0.5 text-[13px] text-white/90">{plan.hasPlan ? `মেয়াদ শেষ${plan.endsAt ? ` (${shortDate(plan.endsAt)})` : ""} — নিচে থেকে নতুন plan নিন।` : "এখনো কোনো plan নেই — নিচে থেকে বেছে নিন।"}</p>}

      {today.tier ? <div className="mt-2 grid grid-cols-3 gap-1.5">
        {today.kinds.map((item) => <p key={item.kind} className="rounded-xl bg-white/15 px-1 py-1 text-center text-[11px] leading-tight text-white/85 ring-1 ring-white/20">
          <span className="block text-sm font-bold tabular-nums text-white">{item.used}<span className="text-[11px] font-medium text-white/75">/{item.limit}</span></span>আজ {kindLabels[item.kind]}
        </p>)}
      </div> : null}
    </section>

    {note ? <p className={cn("flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] ring-1", note.className)}><note.icon className="mt-0.5 size-4 shrink-0" /> {note.text}</p> : null}

    <PlanShop overview={overview} source="page" />

    {payments.length ? <details className="group rounded-3xl bg-white px-3.5 py-2.5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Payment history ({payments.length}) <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>
      <ul className="mt-2 divide-y divide-slate-100">
        {payments.map((payment) => <li key={payment.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
          <div className="min-w-0">
            <p className="font-medium">{payment.packageName} <span className="tabular-nums text-slate-600">{taka(payment.amountBdt)}</span></p>
            <p className="text-xs text-slate-500">{payment.source === "gift" ? "🎁 উপহার" : payment.source === "credit" ? "🤝 Affiliate credit দিয়ে" : <>{methodNames[payment.method]}{payment.method === "SSLCOMMERZ" ? null : <> · TrxID <span className="font-mono">{payment.transactionId}</span></>}</>} · {formatDateTime(payment.createdAt)}</p>
            {payment.adminNote && payment.method !== "SSLCOMMERZ" ? <p className="mt-0.5 text-xs text-slate-600">Admin: {payment.adminNote}</p> : null}
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", statusStyle[payment.status].className)}>{statusStyle[payment.status].label}</span>
        </li>)}
      </ul>
    </details> : null}
  </div>;
}
