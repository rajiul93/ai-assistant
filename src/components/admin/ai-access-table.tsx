"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AiAccess } from "@prisma/client";
import { formatTokens, quotaPercent, TOKEN_LIMIT_OPTIONS } from "@/lib/ai-limits";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { setUserAiAccess, setUserTokenLimit } from "@/server/actions/ai-access";

type Row = { id: string; name: string | null; email: string; aiAccess: AiAccess; aiRequestedAt: Date | null; aiTokenLimit: number | null; tokensUsed: number; createdAt: Date; admin: boolean; usage: number };

const statusStyles: Record<AiAccess, { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Enabled", className: "bg-emerald-100 text-emerald-800" },
  DISABLED: { label: "Disabled", className: "bg-zinc-200 text-zinc-700" },
  NONE: { label: "No access", className: "bg-zinc-100 text-zinc-500" },
};

function AccessButton({ user }: { user: Row }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const enabled = user.aiAccess === "APPROVED";
  const change = (value: boolean) => startTransition(async () => {
    setError("");
    try { await setUserAiAccess({ userId: user.id, enabled: value }); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  });
  return <div className="flex flex-col items-end gap-1">
    <div className="flex gap-2">
      {user.aiAccess === "REQUESTED" ? <button type="button" disabled={pending} onClick={() => change(false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50">Decline</button> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => change(!enabled)}
        className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50", enabled ? "border border-zinc-200 text-zinc-700 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800")}
      >{pending ? "Saving…" : enabled ? "Disable" : user.aiAccess === "REQUESTED" ? "Approve" : "Enable"}</button>
    </div>
    {error ? <p role="alert" className="text-[11px] text-red-700">{error}</p> : null}
  </div>;
}

/** Token limit picker plus how much of it the user has used. */
function TokenLimit({ user }: { user: Row }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const quota = { used: user.tokensUsed, limit: user.admin ? null : user.aiTokenLimit };
  const percent = quotaPercent(quota);
  const change = (value: string) => startTransition(async () => {
    setError("");
    try { await setUserTokenLimit({ userId: user.id, limit: value === "unlimited" ? null : Number(value) }); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  });
  return <div className="w-full sm:w-56">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="tabular-nums text-zinc-600">{formatTokens(quota.used)} / {quota.limit ? formatTokens(quota.limit) : "∞"}{quota.limit ? ` · ${percent}%` : ""}</span>
      {user.admin ? <span className="text-zinc-400">Unlimited</span> : <select
        aria-label={`Token limit for ${user.email}`}
        value={user.aiTokenLimit ?? "unlimited"}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium disabled:opacity-50"
      >
        {TOKEN_LIMIT_OPTIONS.map((option) => <option key={option} value={option}>{formatTokens(option)} tokens</option>)}
        {/* A limit set some other way still shows as the current value. */}
        {user.aiTokenLimit && !(TOKEN_LIMIT_OPTIONS as readonly number[]).includes(user.aiTokenLimit) ? <option value={user.aiTokenLimit}>{formatTokens(user.aiTokenLimit)} tokens</option> : null}
        <option value="unlimited">Unlimited</option>
      </select>}
    </div>
    {quota.limit ? <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className={cn("h-full rounded-full", percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-zinc-900")} style={{ width: `${percent}%` }} /></div> : null}
    {error ? <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p> : null}
  </div>;
}

/** Admins decide who may use the AI: approve requests, and turn access on or off at any time. */
export function AiAccessTable({ users }: { users: Row[] }) {
  const waiting = users.filter((user) => user.aiAccess === "REQUESTED" && !user.admin).length;
  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">AI access</h1>
      <p className="mt-1 text-sm text-zinc-500">New users can&apos;t use the AI until an admin approves their request. Admins always have access. Token limits count every AI call a user has ever made; at the limit the AI stops for them.{waiting ? ` ${waiting} waiting for approval.` : ""}</p>
    </div>
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <ul className="divide-y divide-zinc-100">
        {users.map((user) => <li key={user.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name || user.email}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Joined {formatDateTime(user.createdAt)}
              {user.aiAccess === "REQUESTED" && user.aiRequestedAt ? ` · requested ${formatDateTime(user.aiRequestedAt)}` : ""}
              {` · ${user.usage.toLocaleString("en-US")} AI calls`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <TokenLimit user={user} />
            <div className="flex items-center justify-between gap-3 sm:justify-end">
            {user.admin
              ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">Admin</span>
              : <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusStyles[user.aiAccess].className)}>{statusStyles[user.aiAccess].label}</span>}
            {user.admin ? null : <AccessButton user={user} />}
            </div>
          </div>
        </li>)}
      </ul>
    </section>
  </div>;
}
