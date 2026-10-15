import Link from "next/link";
import { Activity, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Timer, Users } from "lucide-react";
import { formatTokens, quotaPercent, type AiQuota } from "@/lib/ai-limits";
import { dayjs, formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { AiUsageBreakdown, AiUserUsage, getAiUsage } from "@/server/queries";

export const usagePeriods = [
  { key: "7d", label: "৭ দিন" },
  { key: "30d", label: "৩০ দিন" },
  { key: "all", label: "সব সময়" },
] as const;
export type UsagePeriod = (typeof usagePeriods)[number]["key"];

const featureLabels: Record<string, string> = {
  assistant: "Assistant commands",
  file_assistant: "Reading images & PDFs",
  answer: "Chat answers",
  answer_search: "Answers with web search",
  note_writer: "Note writing",
  bank_beautify: "Question bank clean-up",
  bank_solve: "Question bank solutions & explanations",
  vocab_explain: "Vocabulary explanations",
  speech: "Voice replies (spoken aloud)",
  transcribe: "Understanding your voice",
  voice_fix: "Fixing spelling & math in what you said",
  image: "Image generation",
};
const statusLabels: Record<string, string> = {
  ok: "Succeeded",
  rate_limited: "Quota limit (429)",
  overloaded: "OpenAI busy (503)",
  timeout: "Timed out",
  error: "Other error",
};

const number = (value: number) => value.toLocaleString("en-US");
function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return number(value);
}

/** The white card every section sits on (soft shadow, no border), as on the home page. */
const card = "rounded-3xl bg-white p-5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]";
const heading = "text-[15px] font-bold tracking-tight text-slate-900";
// Bars cycle through these, so rows in a list are told apart at a glance.
const BAR_COLORS = ["from-blue-500 to-indigo-500", "from-fuchsia-500 to-pink-500", "from-emerald-400 to-teal-500", "from-orange-400 to-amber-500", "from-violet-500 to-purple-500", "from-cyan-400 to-sky-500"];

/**
 * An Apple-style activity ring: `percent` of the circle in a gradient (`id` must be unique on the
 * page, it names the SVG gradient). Red past 100 or near the end, as a warning.
 */
function Ring({ id, percent, size = 120, stroke = 14, from, to, children }: { id: string; percent: number; size?: number; stroke?: number; from: string; to: string; children?: React.ReactNode }) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const shown = Math.max(0, Math.min(100, percent));
  return <div className="relative shrink-0" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={from} strokeOpacity={0.14} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(shown / 100) * length} ${length}`} />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
  </div>;
}

const ringColors = (percent: number) => (percent >= 100 ? { from: "#f43f5e", to: "#e11d48" } : percent >= 80 ? { from: "#fbbf24", to: "#f97316" } : { from: "#3f6ef3", to: "#a855f7" });

function Breakdown({ title, rows, labels }: { title: string; rows: AiUsageBreakdown[]; labels?: Record<string, string> }) {
  const max = Math.max(...rows.map((row) => row.requests), 1);
  return <section className={card}>
    <h2 className={heading}>{title}</h2>
    {rows.length === 0 ? <p className="mt-4 text-sm text-slate-500">এখনো কিছু নেই।</p> : <ul className="mt-4 space-y-3.5">
      {rows.map((row, index) => <li key={row.key} title={`${labels?.[row.key] ?? row.key}: ${number(row.requests)} requests · ${number(row.inputTokens)} input · ${number(row.outputTokens)} output tokens`}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800"><span className={cn("size-2.5 shrink-0 rounded-full bg-linear-to-br", BAR_COLORS[index % BAR_COLORS.length])} /><span className="truncate">{labels?.[row.key] ?? row.key}</span></span>
          <span className="shrink-0 tabular-nums"><span className="font-bold text-slate-900">{number(row.requests)}</span><span className="ml-2 text-xs text-slate-500">{compact(row.tokens)} tokens</span></span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full bg-linear-to-r", BAR_COLORS[index % BAR_COLORS.length])} style={{ width: `${Math.max(2, (row.requests / max) * 100)}%` }} /></div>
        <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400">{compact(row.inputTokens)} in · {compact(row.outputTokens)} out</p>
      </li>)}
    </ul>}
  </section>;
}

function DailyChart({ daily }: { daily: Awaited<ReturnType<typeof getAiUsage>>["daily"] }) {
  const max = Math.max(...daily.map((day) => day.requests), 1);
  const label = (day: string) => dayjs(day).format("D MMM");
  return <section className={card}>
    <div className="flex items-baseline justify-between gap-3">
      <h2 className={heading}>প্রতিদিনের request</h2>
      <p className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">সর্বোচ্চ {number(max)}</p>
    </div>
    <div className="mt-5 flex h-44 items-end gap-1 border-b border-slate-100" aria-hidden>
      {daily.map((day, index) => <div key={day.day} tabIndex={-1} className="group relative flex h-full flex-1 items-end outline-none">
        <div className={cn("w-full rounded-t-full bg-linear-to-t transition group-hover:brightness-110 group-focus:brightness-110", day.failed ? "from-orange-400 to-rose-500" : "from-[#3f6ef3] to-[#a78bfa]")} style={{ height: day.requests ? `${Math.max(4, (day.requests / max) * 100)}%` : 0 }} />
        {/* Hover on desktop, tap on phones (tap focuses the bar). Edge bars anchor inward so the label stays on screen. */}
        <div className={cn(
          "pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-xl bg-slate-900/90 px-2.5 py-1.5 backdrop-blur text-[11px] leading-snug text-white shadow-lg group-hover:block group-focus:block",
          index < daily.length / 3 ? "left-0" : index > (daily.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2",
        )}>
          <p className="font-semibold">{label(day.day)}</p>
          <p>{number(day.requests)} requests{day.failed ? ` · ${day.failed} failed` : ""}</p>
          <p className="text-white/70">{number(day.inputTokens)} in · {number(day.outputTokens)} out</p>
        </div>
      </div>)}
    </div>
    <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
      <span>{daily[0] ? label(daily[0].day) : ""}</span>
      <span>{daily.length > 1 ? label(daily[daily.length - 1].day) : ""}</span>
    </div>
    {/* sr-only on a <table> doesn't shrink it (tables ignore width: 1px), which widened the page on phones; the wrapper does. */}
    <div className="sr-only"><table>
      <caption>Requests per day</caption>
      <thead><tr><th>Day</th><th>Requests</th><th>Failed</th><th>Input tokens</th><th>Output tokens</th></tr></thead>
      <tbody>{daily.map((day) => <tr key={day.day}><td>{label(day.day)}</td><td>{day.requests}</td><td>{day.failed}</td><td>{day.inputTokens}</td><td>{day.outputTokens}</td></tr>)}</tbody>
    </table></div>
  </section>;
}

/** A coloured initial for a user row. */
function Initial({ name, index }: { name: string; index: number }) {
  return <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white", BAR_COLORS[index % BAR_COLORS.length])}>{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}

function UserTable({ users, showEmail }: { users: AiUserUsage[]; showEmail: boolean }) {
  const max = Math.max(...users.map((user) => user.requests), 1);
  return <section className={card}>
    <h2 className={heading}>কে কতটা ব্যবহার করেছে</h2>
    {users.length === 0 ? <p className="mt-4 text-sm text-slate-500">এই সময়ে কোনো AI call নেই।</p> : <>
    {/* Phones: one card per user instead of a wide table that would need sideways scrolling. */}
    <ul className="mt-4 divide-y divide-slate-100 sm:hidden">
      {users.map((user, index) => <li key={user.userId ?? "deleted"} className="py-3 first:pt-0 last:pb-0">
        <div className="flex items-center gap-2.5">
          <Initial name={user.name} index={index} />
          <p className="min-w-0 flex-1 truncate font-semibold">{user.name}</p>
          <p className="shrink-0 text-xs text-slate-500">{user.lastUsedAt ? formatDateTime(user.lastUsedAt) : "—"}</p>
        </div>
        {showEmail && user.email ? <p className="truncate text-xs text-zinc-500">{user.email}</p> : null}
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-blue-50 py-1.5"><dt className="text-[11px] text-blue-700/80">Requests</dt><dd className="font-semibold tabular-nums">{number(user.requests)}{user.failed ? <span className="ml-1 text-[11px] font-normal text-amber-700">({user.failed} failed)</span> : null}</dd></div>
          <div className="rounded-xl bg-violet-50 py-1.5"><dt className="text-[11px] text-violet-700/80">Input</dt><dd className="font-semibold tabular-nums">{compact(user.inputTokens)}</dd></div>
          <div className="rounded-xl bg-pink-50 py-1.5"><dt className="text-[11px] text-pink-700/80">Output</dt><dd className="font-semibold tabular-nums">{compact(user.outputTokens)}</dd></div>
        </dl>
      </li>)}
    </ul>
    <div className="mt-4 hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Requests</th>
            <th className="py-2 pr-4 text-right font-medium">Failed</th>
            <th className="py-2 pr-4 text-right font-medium">Input</th>
            <th className="py-2 pr-4 text-right font-medium">Output</th>
            <th className="py-2 pr-4 text-right font-medium">Total tokens</th>
            <th className="py-2 text-right font-medium">Last used</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => <tr key={user.userId ?? "deleted"} className="border-b border-slate-100 last:border-0">
            <td className="py-2.5 pr-4">
              <div className="flex items-center gap-2.5">
                <Initial name={user.name} index={index} />
                <div className="min-w-0">
                  <p className="font-semibold">{user.name}</p>
                  {showEmail && user.email ? <p className="text-xs text-slate-500">{user.email}</p> : null}
                </div>
              </div>
            </td>
            <td className="w-[30%] py-2.5 pr-4">
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 tabular-nums font-semibold">{number(user.requests)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full bg-linear-to-r", BAR_COLORS[index % BAR_COLORS.length])} style={{ width: `${Math.max(2, (user.requests / max) * 100)}%` }} /></div>
              </div>
            </td>
            <td className={cn("py-2.5 pr-4 text-right tabular-nums", user.failed ? "text-amber-700" : "text-zinc-500")}>{number(user.failed)}</td>
            <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-600">{number(user.inputTokens)}</td>
            <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-600">{number(user.outputTokens)}</td>
            <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{number(user.tokens)}</td>
            <td className="py-2.5 text-right text-xs text-zinc-500">{user.lastUsedAt ? formatDateTime(user.lastUsedAt) : "—"}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    </>}
  </section>;
}

/** The signed-in user's own total against their limit (all time, not just the chosen period). */
function QuotaCard({ quota }: { quota: AiQuota }) {
  const percent = quotaPercent(quota);
  const remaining = quota.limit ? Math.max(0, quota.limit - quota.used) : null;
  return <section className={card}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className={heading}>আপনার token limit</h2>
      <p className="text-xs text-slate-500">সব সময়, সব AI feature</p>
    </div>
    {quota.planEndsAt === null ? <p className="mt-3 text-sm text-slate-600">এখনো কোনো plan নেই। <Link href="/billing" className="font-semibold text-blue-700 underline underline-offset-4">Plan নাও</Link> — তারপর এখানে token-এর হিসাব দেখাবে।</p> : quota.limit ? <div className="mt-3 flex items-center gap-5">
      <Ring id="quota-ring" percent={percent} size={112} {...ringColors(percent)}><span className="text-2xl font-bold tabular-nums">{percent}%</span></Ring>
      <div className="min-w-0">
        <p className="text-sm tabular-nums text-slate-600"><b className="text-slate-900">{number(quota.used)}</b> / {number(quota.limit)} tokens</p>
        <p className={cn("mt-1 text-sm", percent >= 100 ? "font-semibold text-rose-600" : "text-slate-500")}>
          {percent >= 100 ? "Limit শেষ — admin বাড়ানো পর্যন্ত AI বন্ধ।" : `${formatTokens(remaining ?? 0)} tokens বাকি${percent >= 80 ? " — প্রায় শেষ।" : ""}`}
        </p>
      </div>
    </div> : <div className="mt-3 flex items-center gap-4">
      <Ring id="quota-ring" percent={100} size={88} stroke={12} from="#10b981" to="#3f6ef3"><span className="text-lg font-bold">∞</span></Ring>
      <p className="text-sm text-slate-600"><b className="tabular-nums text-slate-900">{number(quota.used)}</b> tokens ব্যবহার · কোনো limit নেই</p>
    </div>}
  </section>;
}

/** A customer's allowance as a share only — token counts are for admins. */
function CustomerQuotaCard({ quota }: { quota: AiQuota }) {
  const percent = quotaPercent(quota);
  return <section className={card}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className={heading}>মোট খরচ</h2>
      <p className="text-xs text-slate-500">সব plan মিলিয়ে</p>
    </div>
    {quota.planEndsAt === null ? <p className="mt-3 text-sm text-slate-600">এখনো কোনো plan নেই। <Link href="/billing" className="font-semibold text-blue-700 underline underline-offset-4">Plan নাও</Link> — তারপর এখানে ব্যবহারের হিসাব দেখাবে।</p> : <div className="mt-3 flex items-center gap-5">
      <Ring id="plan-ring" percent={percent} size={112} {...ringColors(percent)}><span className="text-2xl font-bold tabular-nums">{percent}%</span><span className="text-[10px] text-slate-500">ব্যবহার</span></Ring>
      <div className="min-w-0">
        <p className="text-sm text-slate-600"><b className="tabular-nums text-slate-900">{Math.max(0, Math.round((100 - percent) * 10) / 10)}%</b> বাকি</p>
        <p className={cn("mt-1 text-sm", percent >= 100 ? "text-rose-600" : "text-slate-500")}>
          {percent >= 100 ? <>ব্যবহার শেষ — <Link href="/billing" className="font-semibold underline underline-offset-4">আরেকটা package নাও</Link>, বাকি দিনের সাথে যোগ হবে।</> : percent >= 80 ? <>প্রায় শেষ — দরকার হলে <Link href="/billing" className="font-semibold underline underline-offset-4">আরেকটা package</Link> নিতে পারো।</> : "নতুন package নিলে বাকি ব্যবহারের সাথে যোগ হয়।"}
        </p>
      </div>
    </div>}
  </section>;
}

type TodayShare = {
  todayPercent: number;
  dailySharePercent: number;
  /** Only present in development (the server leaves it out in production). */
  dev?: { todayTokens: number; dailyShareTokens: number; planTokens: number; planUsedTokens: number };
};

/** Today's use, big, as a share of today's allowance (the plan spread evenly over its days) — nothing else. */
function TodayUsageCard({ today }: { today: TodayShare }) {
  const ofShare = today.dailySharePercent ? Math.round((today.todayPercent / today.dailySharePercent) * 100) : 0;
  const colors = ofShare > 100 ? { from: "#f43f5e", to: "#e11d48" } : ofShare >= 80 ? { from: "#fbbf24", to: "#f97316" } : { from: "#34d399", to: "#3f6ef3" };
  return <section className={cn(card, "flex flex-col items-center text-center")}>
    <h2 className={cn(heading, "self-start")}>আজকের ব্যবহার</h2>
    <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, ofShare)} aria-label="Today's use">
      <Ring id="today-ring" percent={ofShare} size={168} stroke={18} {...colors}>
        <span className={cn("text-4xl font-bold tabular-nums tracking-tight", ofShare > 100 ? "text-rose-600" : "text-slate-900")}>{ofShare}%</span>
        <span className="text-xs text-slate-500">আজকের ভাগের</span>
      </Ring>
    </div>
    {ofShare > 100 ? <p className="mt-2 text-xs font-medium text-rose-600">আজকের ভাগের বেশি খরচ হয়েছে।</p> : <p className="mt-2 text-xs text-slate-500">প্রতিদিন সমান ভাগে ব্যবহার করলে plan শেষ পর্যন্ত চলবে।</p>}
    {today.dev ? <dl className="mt-3 grid w-full grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-dashed border-violet-300 bg-violet-50 p-2.5 font-mono text-[11px] text-violet-900">
      <dt className="col-span-2 font-sans text-[10px] font-semibold uppercase tracking-wide text-violet-500">Dev only · tokens</dt>
      <dt>today</dt><dd className="text-right tabular-nums">{number(today.dev.todayTokens)}</dd>
      <dt>daily share</dt><dd className="text-right tabular-nums">{number(today.dev.dailyShareTokens)}</dd>
      <dt>plan used</dt><dd className="text-right tabular-nums">{number(today.dev.planUsedTokens)}</dd>
      <dt>plan total</dt><dd className="text-right tabular-nums">{number(today.dev.planTokens)}</dd>
    </dl> : null}
  </section>;
}

/** A customer's usage page: today's use and the total spent, both as progress bars; no history, no token counts. */
export function CustomerUsageView({ quota, requests, failed, today }: { quota: AiQuota; requests: number; failed: number; today: TodayShare | null }) {
  return <div className="mx-auto max-w-xl space-y-4">
    <div>
      <h1 className="text-[28px] font-bold tracking-tight text-slate-900">AI ব্যবহার</h1>
      <p className="mt-1 text-sm text-slate-500">আজ কতটা AI ব্যবহার হলো, আর তোমার plan-এর মোট কতটা খরচ হয়েছে।</p>
    </div>
    {today ? <TodayUsageCard today={today} /> : null}
    <CustomerQuotaCard quota={quota} />
    <section className={cn(card, "flex items-center gap-4")}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-[0_8px_16px_-10px_rgba(37,99,235,0.9)]"><Activity className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-slate-500">AI requests · এই plan-এ</h2>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{number(requests)}</p>
      </div>
      <p className="shrink-0 text-right text-xs text-slate-500"><span className="font-semibold text-emerald-600">{number(requests - failed)}</span> সফল<br /><span className={cn("font-semibold", failed ? "text-orange-600" : "text-slate-400")}>{number(failed)}</span> ব্যর্থ</p>
    </section>
  </div>;
}

export function AiUsageView({ usage, period, admin, quota, balance }: { usage: Awaited<ReturnType<typeof getAiUsage>>; period: UsagePeriod; admin: boolean; quota: AiQuota; balance?: React.ReactNode }) {
  const { totals } = usage;
  const successRate = totals.requests ? Math.round((totals.succeeded / totals.requests) * 100) : 0;
  const tiles = [
    { label: "AI requests", value: number(totals.requests), detail: `${number(totals.succeeded)} সফল · ${number(totals.failed)} ব্যর্থ`, icon: Activity, tone: "from-blue-500 to-indigo-600" },
    { label: "Input tokens", value: compact(totals.inputTokens), detail: "AI-কে পাঠানো (prompt, file, পড়ার লেখা)", icon: ArrowUpFromLine, tone: "from-violet-500 to-purple-600" },
    { label: "Output tokens", value: compact(totals.outputTokens), detail: `AI-এর লেখা বা বলা · মোট ${compact(totals.totalTokens)}`, icon: ArrowDownToLine, tone: "from-fuchsia-500 to-pink-600" },
    { label: "সফলতার হার", value: `${successRate}%`, detail: totals.failed ? "ব্যর্থ বেশিরভাগ provider ব্যস্ত থাকায়" : "কোনো ব্যর্থ call নেই", icon: CheckCircle2, tone: "from-emerald-400 to-teal-600" },
    admin
      ? { label: "Active users", value: number(usage.perUser.length), detail: "এই সময়ে AI ব্যবহার করেছে", icon: Users, tone: "from-orange-400 to-amber-500" }
      : { label: "গড় উত্তরের সময়", value: totals.averageLatencyMs ? `${(totals.averageLatencyMs / 1000).toFixed(1)}s` : "—", detail: "সফল call-এ", icon: Timer, tone: "from-orange-400 to-amber-500" },
  ];

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">AI ব্যবহার</h1>
        <p className="mt-1 text-sm text-slate-500">{admin ? "সব user-এর AI ব্যবহার (OpenAI)।" : "আপনার AI ব্যবহার (OpenAI)।"} প্রতিটা call গোনা হয়, backup model-এ আবার চেষ্টাও।</p>
      </div>
      {/* An iOS-style segmented control. */}
      <nav aria-label="Period" className="grid grid-cols-3 gap-1 self-stretch rounded-2xl bg-slate-200/70 p-1 sm:self-auto">
        {usagePeriods.map((item) => <Link
          key={item.key}
          href={`/usage?period=${item.key}`}
          scroll={false}
          aria-current={item.key === period ? "page" : undefined}
          className={cn("rounded-xl px-4 py-1.5 text-center text-[13px] font-semibold transition", item.key === period ? "bg-white text-slate-900 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.2)]" : "text-slate-500 hover:text-slate-800")}
        >{item.label}</Link>)}
      </nav>
    </div>

    {balance}
    <QuotaCard quota={quota} />

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {/* Two per row on phones; the odd last tile takes the full row instead of sitting alone. */}
      {tiles.map((tile, index) => {
        const Icon = tile.icon;
        return <div key={tile.label} className={cn("min-w-0 rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]", index === tiles.length - 1 && tiles.length % 2 === 1 && "col-span-2 lg:col-span-1")}>
          <span className={cn("flex size-9 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-[0_6px_14px_-8px_rgba(15,23,42,0.7)]", tile.tone)}><Icon className="size-[18px]" strokeWidth={2.2} /></span>
          <p className="mt-3 text-[12px] font-semibold text-slate-500">{tile.label}</p>
          <p className="mt-0.5 text-[26px] font-bold leading-tight tabular-nums tracking-tight text-slate-900">{tile.value}</p>
          <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{tile.detail}</p>
        </div>;
      })}
    </section>

    {totals.requests === 0 ? <p className={cn(card, "p-8 text-center text-sm text-slate-500")}>
      এই সময়ে কোনো AI call নেই। Assistant-কে কিছু জিজ্ঞেস করলে বা Notes-এ “AI দিয়ে লিখুন” চাপলে এখানে দেখাবে।
    </p> : <>
      <DailyChart daily={usage.daily} />
      <UserTable users={usage.perUser} showEmail={admin} />
      {/* Which features and models cost what is for admins only. */}
      {/* minmax(0,1fr): a long feature or model name truncates instead of widening the page. */}
      {admin ? <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Breakdown title="কোন feature-এ" rows={usage.byFeature} labels={featureLabels} />
        <Breakdown title="কোন model-এ" rows={usage.byModel} />
        <Breakdown title="ফলাফল" rows={usage.byStatus} labels={statusLabels} />
      </div> : null}
    </>}
  </div>;
}
