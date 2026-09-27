"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AccountStatus, UserRole } from "@prisma/client";
import { Ban, ChevronDown, Crown, PauseCircle, Search } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pagination } from "@/components/pagination";
import { formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { cancelUserSubscription, setUserAiPaused, setUserBlocked, setUserRole } from "@/server/actions/roles";

type Row = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: AccountStatus;
  aiPaused: boolean;
  superAdmin: boolean;
  createdAt: Date;
  plan: { active: boolean; endsAt: Date | null; daysLeft: number; leftPercent: number };
};

type Confirm = { title: string; body: string; action: string; run: () => Promise<unknown>; done: string } | null;

const roleStyle: Record<UserRole, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-800",
  ADMIN: "bg-sky-100 text-sky-800",
  USER: "bg-zinc-100 text-zinc-700",
};

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<unknown>, done: string) => start(async () => {
    try { await action(); toast.success(done); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't do that."); }
  });
  return { pending, run };
}

function planText(user: Row) {
  if (user.role !== "USER") return "no limits";
  if (!user.plan.endsAt) return "no plan";
  if (!user.plan.active) return `plan ended ${formatDate(user.plan.endsAt)}`;
  return `${user.plan.daysLeft} days · ${user.plan.leftPercent}% left`;
}

function UserRow({ user, onConfirm }: { user: Row; onConfirm: (confirm: Confirm) => void }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  const name = user.name || user.email;
  const blocked = user.status === "BLOCKED";
  return <li className={cn("px-3 py-2.5", blocked && "bg-red-50/40")}>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {name}
          {blocked ? <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700"><Ban className="size-3" /> Blocked</span> : null}
          {user.aiPaused ? <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800"><PauseCircle className="size-3" /> AI off</span> : null}
        </p>
        <p className="truncate text-xs text-zinc-500">{user.email} · {planText(user)}</p>
      </div>
      {user.superAdmin
        ? <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", roleStyle.SUPER_ADMIN)}><Crown className="size-3.5" /> Super admin</span>
        : <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Manage <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} /></button>}
    </div>

    {open && !user.superAdmin ? <div className="mt-2.5 grid gap-2 rounded-xl bg-zinc-50 p-2.5 sm:grid-cols-2">
      <label className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-100">
        <span className="text-xs text-zinc-600">Role</span>
        <select
          aria-label={`Role of ${user.email}`}
          value={user.role}
          disabled={pending}
          onChange={(event) => run(() => setUserRole({ userId: user.id, role: event.target.value }), `${name} is now ${event.target.value === "ADMIN" ? "an admin" : "a user"}`)}
          className={cn("h-8 rounded-full border-0 px-3 text-xs font-semibold disabled:opacity-50", roleStyle[user.role])}
        >
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>

      <button type="button" disabled={pending} onClick={() => run(() => setUserAiPaused({ userId: user.id, paused: !user.aiPaused }), user.aiPaused ? `AI turned back on for ${name}` : `AI paused for ${name}`)} className={cn("h-11 rounded-lg px-3 text-sm font-medium ring-1 disabled:opacity-50", user.aiPaused ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-amber-800 ring-amber-200 hover:bg-amber-50")}>
        {user.aiPaused ? "Activate AI" : "Deactivate AI"}
      </button>

      <button
        type="button"
        disabled={pending || user.role !== "USER" || !user.plan.active}
        title={user.role !== "USER" ? "Admins have no plan" : !user.plan.active ? "No running plan" : undefined}
        onClick={() => onConfirm({
          title: `Cancel ${name}'s subscription?`,
          body: `The plan ends right now and the ${user.plan.daysLeft} remaining days and ${user.plan.leftPercent}% remaining use are removed. Their payment history stays. This can't be undone.`,
          action: "Cancel subscription",
          run: () => cancelUserSubscription({ userId: user.id }),
          done: `${name}'s subscription was cancelled`,
        })}
        className="h-11 rounded-lg bg-white px-3 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-40"
      >Cancel subscription</button>

      <button
        type="button"
        disabled={pending}
        onClick={() => blocked
          ? run(() => setUserBlocked({ userId: user.id, blocked: false }), `${name} was unblocked`)
          : onConfirm({
            title: `Block ${name}?`,
            body: "They'll be locked out of the whole app and see only a notice. Their data and plan stay, and unblocking restores everything.",
            action: "Block",
            run: () => setUserBlocked({ userId: user.id, blocked: true }),
            done: `${name} was blocked`,
          })}
        className={cn("h-11 rounded-lg px-3 text-sm font-semibold disabled:opacity-50", blocked ? "bg-emerald-600 text-white" : "bg-red-600 text-white hover:bg-red-700")}
      >{blocked ? "Unblock" : "Block"}</button>
    </div> : null}
  </li>;
}

/**
 * Super admin only: every user's role, account and plan. Block locks the whole account,
 * Deactivate AI pauses only the AI, Cancel subscription ends the plan now.
 */
export function UserRoles({ users, page, limit, total, blocked: blockedCount, query }: { users: Row[]; page: number; limit: number; total: number; blocked: number; query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { pending, run } = useRun();
  const visible = users;
  // Search runs on the server across all users: after a short pause it goes into the URL (?q=), back to page 1.
  useEffect(() => {
    const value = search.trim();
    if (value === query) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value); else params.delete("q");
      params.delete("page");
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, query, pathname, router, searchParams]);
  return <div className="mx-auto max-w-3xl space-y-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Users & roles</h1>
      <p className="text-xs text-zinc-500 sm:text-sm">Only you (super admin) can change roles, block accounts, pause AI or cancel subscriptions.</p>
    </div>
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" aria-label="Search users" className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
      </div>
      <p className="shrink-0 text-xs text-zinc-500">{total} {query ? "found" : "users"}{blockedCount ? ` · ${blockedCount} blocked` : ""}</p>
    </div>
    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
      {visible.map((user) => <UserRow key={user.id} user={user} onConfirm={setConfirm} />)}
      {visible.length === 0 ? <li className="px-3 py-6 text-center text-sm text-zinc-500">No users match.</li> : null}
    </ul>
    {total > 0 ? <Pagination page={page} limit={limit} total={total} label="users" /> : null}

    <AlertDialog open={Boolean(confirm)} onOpenChange={(value) => !value && setConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
        <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => { if (confirm) run(confirm.run, confirm.done); setConfirm(null); }} className="bg-red-600 hover:bg-red-700">{confirm?.action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
