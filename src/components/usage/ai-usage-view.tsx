import Link from "next/link";
import { formatTokens, quotaPercent, type AiQuota } from "@/lib/ai-limits";
import { dayjs, formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import type { AiUsageBreakdown, AiUserUsage, getAiUsage } from "@/server/queries";

export const usagePeriods = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
] as const;
export type UsagePeriod = (typeof usagePeriods)[number]["key"];

const featureLabels: Record<string, string> = {
  assistant: "Assistant commands",
  file_assistant: "Reading images & PDFs",
  answer: "Chat answers",
  answer_search: "Answers with web search",
  note_writer: "Note writing",
  speech: "Voice replies (spoken aloud)",
  transcribe: "Understanding your voice",
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

function Breakdown({ title, rows, labels }: { title: string; rows: AiUsageBreakdown[]; labels?: Record<string, string> }) {
  const max = Math.max(...rows.map((row) => row.requests), 1);
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5">
    <h2 className="text-sm font-semibold">{title}</h2>
    {rows.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No calls yet.</p> : <ul className="mt-4 space-y-3">
      {rows.map((row) => <li key={row.key} title={`${labels?.[row.key] ?? row.key}: ${number(row.requests)} requests · ${number(row.inputTokens)} input · ${number(row.outputTokens)} output tokens`}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate">{labels?.[row.key] ?? row.key}</span>
          <span className="shrink-0 tabular-nums"><span className="font-semibold">{number(row.requests)}</span><span className="ml-2 text-xs text-zinc-500">{compact(row.tokens)} tokens</span></span>
        </div>
        <p className="mt-0.5 text-right text-[11px] tabular-nums text-zinc-500">{compact(row.inputTokens)} in · {compact(row.outputTokens)} out</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-900" style={{ width: `${(row.requests / max) * 100}%` }} /></div>
      </li>)}
    </ul>}
  </section>;
}

function DailyChart({ daily }: { daily: Awaited<ReturnType<typeof getAiUsage>>["daily"] }) {
  const max = Math.max(...daily.map((day) => day.requests), 1);
  const label = (day: string) => dayjs(day).format("D MMM");
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold">Requests per day</h2>
      <p className="text-xs text-zinc-500">peak {number(max)}</p>
    </div>
    <div className="mt-4 flex h-40 items-end gap-0.5 border-b border-zinc-200" aria-hidden>
      {daily.map((day, index) => <div key={day.day} tabIndex={-1} className="group relative flex h-full flex-1 items-end outline-none">
        <div className="w-full rounded-t-[4px] bg-zinc-900 transition-opacity group-hover:opacity-70 group-focus:opacity-70" style={{ height: day.requests ? `${Math.max(3, (day.requests / max) * 100)}%` : 0 }} />
        {/* Hover on desktop, tap on phones (tap focuses the bar). Edge bars anchor inward so the label stays on screen. */}
        <div className={cn(
          "pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg bg-zinc-950 px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg group-hover:block group-focus:block",
          index < daily.length / 3 ? "left-0" : index > (daily.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2",
        )}>
          <p className="font-semibold">{label(day.day)}</p>
          <p>{number(day.requests)} requests{day.failed ? ` · ${day.failed} failed` : ""}</p>
          <p className="text-white/70">{number(day.inputTokens)} in · {number(day.outputTokens)} out</p>
        </div>
      </div>)}
    </div>
    <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
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

function UserTable({ users, showEmail }: { users: AiUserUsage[]; showEmail: boolean }) {
  const max = Math.max(...users.map((user) => user.requests), 1);
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5">
    <h2 className="text-sm font-semibold">Usage by user</h2>
    {users.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No AI calls in this period.</p> : <>
    {/* Phones: one card per user instead of a wide table that would need sideways scrolling. */}
    <ul className="mt-4 divide-y divide-zinc-100 sm:hidden">
      {users.map((user) => <li key={user.userId ?? "deleted"} className="py-3 first:pt-0 last:pb-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate font-medium">{user.name}</p>
          <p className="shrink-0 text-xs text-zinc-500">{user.lastUsedAt ? formatDateTime(user.lastUsedAt) : "—"}</p>
        </div>
        {showEmail && user.email ? <p className="truncate text-xs text-zinc-500">{user.email}</p> : null}
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-zinc-50 py-1.5"><dt className="text-[11px] text-zinc-500">Requests</dt><dd className="font-semibold tabular-nums">{number(user.requests)}{user.failed ? <span className="ml-1 text-[11px] font-normal text-amber-700">({user.failed} failed)</span> : null}</dd></div>
          <div className="rounded-lg bg-zinc-50 py-1.5"><dt className="text-[11px] text-zinc-500">Input</dt><dd className="font-semibold tabular-nums">{compact(user.inputTokens)}</dd></div>
          <div className="rounded-lg bg-zinc-50 py-1.5"><dt className="text-[11px] text-zinc-500">Output</dt><dd className="font-semibold tabular-nums">{compact(user.outputTokens)}</dd></div>
        </dl>
      </li>)}
    </ul>
    <div className="mt-4 hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr className="border-b border-zinc-100">
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
          {users.map((user) => <tr key={user.userId ?? "deleted"} className="border-b border-zinc-100 last:border-0">
            <td className="py-2.5 pr-4">
              <p className="font-medium">{user.name}</p>
              {showEmail && user.email ? <p className="text-xs text-zinc-500">{user.email}</p> : null}
            </td>
            <td className="w-[30%] py-2.5 pr-4">
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 tabular-nums font-semibold">{number(user.requests)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-900" style={{ width: `${(user.requests / max) * 100}%` }} /></div>
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
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold">Your token limit</h2>
      <p className="text-xs text-zinc-500">All time, every AI feature</p>
    </div>
    {quota.limit ? <>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tabular-nums">{percent}%</p>
        <p className="text-sm tabular-nums text-zinc-600">{number(quota.used)} of {number(quota.limit)} tokens used</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Token limit used">
        <div className={cn("h-full rounded-full transition-all", percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-zinc-900")} style={{ width: `${percent}%` }} />
      </div>
      <p className={cn("mt-2 text-xs", percent >= 100 ? "text-red-700" : "text-zinc-500")}>
        {percent >= 100 ? "Limit reached — the AI is paused for you until an admin raises it." : `${formatTokens(remaining ?? 0)} tokens left${percent >= 80 ? " — running low; ask an admin if you need more." : "."}`}
      </p>
    </> : <p className="mt-3 text-sm text-zinc-600"><span className="font-semibold tabular-nums">{number(quota.used)}</span> tokens used · no limit</p>}
  </section>;
}

export function AiUsageView({ usage, period, admin, quota }: { usage: Awaited<ReturnType<typeof getAiUsage>>; period: UsagePeriod; admin: boolean; quota: AiQuota }) {
  const { totals } = usage;
  const successRate = totals.requests ? Math.round((totals.succeeded / totals.requests) * 100) : 0;
  const tiles = [
    { label: "AI requests", value: number(totals.requests), detail: `${number(totals.succeeded)} succeeded · ${number(totals.failed)} failed` },
    { label: "Input tokens", value: compact(totals.inputTokens), detail: "sent to the AI (prompts, files, text to speak)" },
    { label: "Output tokens", value: compact(totals.outputTokens), detail: `written or spoken by the AI · ${compact(totals.totalTokens)} total` },
    { label: "Success rate", value: `${successRate}%`, detail: totals.failed ? "Failures are mostly a provider being busy" : "No failed calls" },
    admin
      ? { label: "Active users", value: number(usage.perUser.length), detail: "used the AI in this period" }
      : { label: "Avg response time", value: totals.averageLatencyMs ? `${(totals.averageLatencyMs / 1000).toFixed(1)}s` : "—", detail: "successful calls" },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI usage</h1>
        <p className="mt-1 text-sm text-zinc-500">{admin ? "Every user's AI usage — OpenAI (you're an admin)." : "Your AI usage — OpenAI."} Each call is counted, including retries on the fallback model.</p>
      </div>
      <nav aria-label="Period" className="flex gap-1 self-start rounded-xl bg-zinc-100 p-1 sm:self-auto">
        {usagePeriods.map((item) => <Link
          key={item.key}
          href={`/usage?period=${item.key}`}
          scroll={false}
          aria-current={item.key === period ? "page" : undefined}
          className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", item.key === period ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
        >{item.label}</Link>)}
      </nav>
    </div>

    <QuotaCard quota={quota} />

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {/* Two per row on phones; the odd last tile takes the full row instead of sitting alone. */}
      {tiles.map((tile, index) => <div key={tile.label} className={cn("min-w-0 rounded-xl border border-zinc-200 bg-white p-4", index === tiles.length - 1 && tiles.length % 2 === 1 && "col-span-2 lg:col-span-1")}>
        <p className="text-xs text-zinc-500">{tile.label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{tile.detail}</p>
      </div>)}
    </section>

    {totals.requests === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
      No AI calls recorded in this period yet. Usage is tracked from now on — ask the assistant something or use “Write with AI” in Notes.
    </p> : <>
      <DailyChart daily={usage.daily} />
      <UserTable users={usage.perUser} showEmail={admin} />
      {/* Which features and models cost what is for admins only. */}
      {admin ? <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By feature" rows={usage.byFeature} labels={featureLabels} />
        <Breakdown title="By model" rows={usage.byModel} />
        <Breakdown title="By result" rows={usage.byStatus} labels={statusLabels} />
      </div> : null}
    </>}
  </div>;
}
