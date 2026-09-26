import Link from "next/link";
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
};
const statusLabels: Record<string, string> = {
  ok: "Succeeded",
  rate_limited: "Quota limit (429)",
  overloaded: "Google busy (503)",
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
      {rows.map((row) => <li key={row.key} title={`${labels?.[row.key] ?? row.key}: ${number(row.requests)} requests · ${number(row.tokens)} tokens`}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate">{labels?.[row.key] ?? row.key}</span>
          <span className="shrink-0 tabular-nums"><span className="font-semibold">{number(row.requests)}</span><span className="ml-2 text-xs text-zinc-500">{compact(row.tokens)} tokens</span></span>
        </div>
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
          <p className="text-white/70">{number(day.tokens)} tokens</p>
        </div>
      </div>)}
    </div>
    <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
      <span>{daily[0] ? label(daily[0].day) : ""}</span>
      <span>{daily.length > 1 ? label(daily[daily.length - 1].day) : ""}</span>
    </div>
    <table className="sr-only">
      <caption>Requests per day</caption>
      <thead><tr><th>Day</th><th>Requests</th><th>Failed</th><th>Tokens</th></tr></thead>
      <tbody>{daily.map((day) => <tr key={day.day}><td>{label(day.day)}</td><td>{day.requests}</td><td>{day.failed}</td><td>{day.tokens}</td></tr>)}</tbody>
    </table>
  </section>;
}

function UserTable({ users, showEmail }: { users: AiUserUsage[]; showEmail: boolean }) {
  const max = Math.max(...users.map((user) => user.requests), 1);
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5">
    <h2 className="text-sm font-semibold">Usage by user</h2>
    {users.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No AI calls in this period.</p> : <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr className="border-b border-zinc-100">
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Requests</th>
            <th className="py-2 pr-4 text-right font-medium">Failed</th>
            <th className="py-2 pr-4 text-right font-medium">Tokens</th>
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
            <td className="py-2.5 pr-4 text-right tabular-nums">{number(user.tokens)}</td>
            <td className="py-2.5 text-right text-xs text-zinc-500">{user.lastUsedAt ? formatDateTime(user.lastUsedAt) : "—"}</td>
          </tr>)}
        </tbody>
      </table>
    </div>}
  </section>;
}

export function AiUsageView({ usage, period, admin }: { usage: Awaited<ReturnType<typeof getAiUsage>>; period: UsagePeriod; admin: boolean }) {
  const { totals } = usage;
  const successRate = totals.requests ? Math.round((totals.succeeded / totals.requests) * 100) : 0;
  const tiles = [
    { label: "AI requests", value: number(totals.requests), detail: `${number(totals.succeeded)} succeeded · ${number(totals.failed)} failed` },
    { label: "Tokens used", value: compact(totals.totalTokens), detail: `${compact(totals.inputTokens)} in · ${compact(totals.outputTokens)} out` },
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

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {tiles.map((tile) => <div key={tile.label} className="rounded-xl border border-zinc-200 bg-white p-4">
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
      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By feature" rows={usage.byFeature} labels={featureLabels} />
        <Breakdown title="By model" rows={usage.byModel} />
        <Breakdown title="By result" rows={usage.byStatus} labels={statusLabels} />
      </div>
    </>}
  </div>;
}
