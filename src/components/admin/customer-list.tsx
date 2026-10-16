"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, BadgeCheck, ChevronDown, Clock3, Mail, Package, PauseCircle, Phone, Search, UserRound } from "lucide-react";
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
import { formatBdPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { cancelUserSubscription, setUserAiPaused, setUserBlocked } from "@/server/actions/roles";
import { errorMessage } from "@/lib/user-error";

export type CustomerTab = "paid" | "ended" | "free";
type Row = { id: string; name: string | null; email: string; phone: string | null; image: string | null; blocked: boolean; aiPaused: boolean; joinedAt: string; paidBdt: number; payments: number; planEndsAt: string | null; plans: Array<{ label: string; priceBdt: number; endsAt: string }>; lastAiAt: string | null };

const TABS: Array<{ id: CustomerTab; label: string; hint: string }> = [
  { id: "paid", label: "Paid", hint: "এখন plan চলছে" },
  { id: "ended", label: "আগে নিয়েছিল", hint: "plan শেষ, আর নেয়নি" },
  { id: "free", label: "Free", hint: "কখনো plan নেয়নি" },
];

const DAY = 86_400_000;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
const taka = (value: number) => `৳${value.toLocaleString("en-IN")}`;

type Confirm = { title: string; body: string; action: string; run: () => Promise<unknown>; done: string } | null;

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<unknown>, done: string) => start(async () => {
    try { await action(); toast.success(done); router.refresh(); } catch (error) { toast.error(errorMessage(error, "করা গেল না।")); }
  });
  return { pending, run };
}

/** Block (whole account), AI on/off, and cancel a running plan — behind "Manage" so they aren't tapped by accident. */
function Controls({ row, paid, onConfirm }: { row: Row; paid: boolean; onConfirm: (confirm: Confirm) => void }) {
  const { pending, run } = useRun();
  const name = row.name || row.email;
  return <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-2">
    <button type="button" disabled={pending} onClick={() => run(() => setUserAiPaused({ userId: row.id, paused: !row.aiPaused }), row.aiPaused ? `${name}-এর AI আবার চালু` : `${name}-এর AI বন্ধ`)} className={cn("h-10 rounded-lg px-2 text-[13px] font-semibold ring-1 disabled:opacity-50", row.aiPaused ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-amber-800 ring-amber-200")}>{row.aiPaused ? "AI চালু করো" : "AI বন্ধ করো"}</button>
    <button
      type="button"
      disabled={pending}
      onClick={() => row.blocked
        ? run(() => setUserBlocked({ userId: row.id, blocked: false }), `${name} আবার চালু`)
        : onConfirm({ title: `${name} কে block করবেন?`, body: "পুরো app বন্ধ হয়ে যাবে, শুধু একটা নোটিস দেখবে। ডেটা আর plan থাকবে; unblock করলে সব আগের মতো।", action: "Block", run: () => setUserBlocked({ userId: row.id, blocked: true }), done: `${name} block হলো` })}
      className={cn("h-10 rounded-lg px-2 text-[13px] font-semibold disabled:opacity-50", row.blocked ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}
    >{row.blocked ? "Unblock" : "Block"}</button>
    {paid ? <button
      type="button"
      disabled={pending}
      onClick={() => onConfirm({ title: `${name}-এর subscription cancel করবেন?`, body: "Plan এখনই শেষ হবে, বাকি দিন আর ব্যবহার বাদ যাবে। পেমেন্টের হিসাব থাকবে। এটা ফেরানো যায় না।", action: "Cancel subscription", run: () => cancelUserSubscription({ userId: row.id }), done: `${name}-এর subscription cancel হলো` })}
      className="col-span-2 h-10 rounded-lg bg-white px-2 text-[13px] font-semibold text-red-600 ring-1 ring-red-200 disabled:opacity-50"
    >Subscription cancel</button> : null}
  </div>;
}

/** "আজ", "৩ দিন", "২ মাস" — how far `iso` is from `now`. */
function span(iso: string, now: string) {
  const days = Math.round(Math.abs(Date.parse(iso) - Date.parse(now)) / DAY);
  if (days === 0) return "আজ";
  if (days < 60) return `${days} দিন`;
  return `${Math.round(days / 30)} মাস`;
}

/** Customers by plan state: paid now, paid before (ended), never paid — with search and paging. */
export function CustomerList({ tab, counts, rows, page, limit, total, query, now }: { tab: CustomerTab; counts: Record<CustomerTab, number>; rows: Row[]; page: number; limit: number; total: number; query: string; now: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { pending, run } = useRun();

  // Search runs on the server: after a short pause it goes into the URL (?q=), back to page 1.
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

  const tabHref = (id: CustomerTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    params.delete("page");
    return `${pathname}?${params}`;
  };

  return <div className="space-y-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Customers</h1>
      <p className="text-xs text-zinc-500 sm:text-sm">কে এখন plan-এ আছে, কার plan শেষ হয়ে গেছে, কে কখনো নেয়নি।</p>
    </div>

    <nav aria-label="Customer groups" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-zinc-100 p-1.5">
      {TABS.map((item) => <Link
        key={item.id}
        href={tabHref(item.id)}
        scroll={false}
        aria-current={tab === item.id ? "page" : undefined}
        className={cn("min-w-0 rounded-xl px-2 py-2 text-center transition", tab === item.id ? "bg-white shadow-sm" : "hover:bg-white/60")}
      >
        <span className={cn("block text-lg font-bold tabular-nums leading-tight", tab === item.id ? (item.id === "paid" ? "text-emerald-700" : item.id === "ended" ? "text-amber-700" : "text-zinc-900") : "text-zinc-500")}>{counts[item.id]}</span>
        <span className={cn("block truncate text-[13px] font-semibold", tab === item.id ? "text-zinc-900" : "text-zinc-500")}>{item.label}</span>
        <span className="hidden truncate text-[11px] text-zinc-500 sm:block">{item.hint}</span>
      </Link>)}
    </nav>

    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নাম, email বা phone দিয়ে খুঁজুন" aria-label="Search customers" className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
    </div>

    {rows.length ? <ul className="space-y-2">
      {rows.map((row) => {
        const ends = row.planEndsAt;
        return <li key={row.id} className={cn("min-w-0 rounded-2xl border border-l-4 bg-white p-3.5", tab === "paid" ? "border-zinc-200 border-l-emerald-500" : tab === "ended" ? "border-zinc-200 border-l-amber-500" : "border-zinc-200 border-l-zinc-300")}>
          <div className="flex items-start gap-3">
            {row.image
              // eslint-disable-next-line @next/next/no-img-element -- Google profile photos; next/image would need their host configured.
              ? <img src={row.image} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full object-cover" />
              : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><UserRound className="size-5" /></span>}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-semibold">{row.name || "নাম নেই"}
                {row.blocked ? <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700"><Ban className="size-3" /> Blocked</span> : null}
                {row.aiPaused ? <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800"><PauseCircle className="size-3" /> AI বন্ধ</span> : null}
              </p>
              <p className="flex min-w-0 items-center gap-1 text-xs text-zinc-500"><Mail className="size-3.5 shrink-0" /><span className="truncate">{row.email}</span></p>
              {row.phone ? <a href={`tel:${row.phone}`} className="flex w-fit items-center gap-1 text-xs font-medium text-blue-700"><Phone className="size-3.5" />{formatBdPhone(row.phone)}</a> : null}
            </div>
            {row.paidBdt ? <span className="shrink-0 text-right"><span className="block text-sm font-bold tabular-nums">{taka(row.paidBdt)}</span><span className="block text-[11px] text-zinc-500">{row.payments} বার কিনেছে</span></span> : null}
          </div>

          {/* Which plan: every running one for paid customers, the last one bought for the rest. */}
          {row.plans.length ? <ul className="mt-2.5 space-y-1">
            {row.plans.map((plan, index) => <li key={index} className={cn("flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px]", tab === "paid" ? "bg-emerald-50/70 text-emerald-950" : "bg-zinc-50 text-zinc-700")}>
              <Package className={cn("size-4 shrink-0", tab === "paid" ? "text-emerald-700" : "text-zinc-400")} />
              <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{tab === "paid" ? "" : "শেষ plan: "}{plan.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">{plan.priceBdt ? taka(plan.priceBdt) : "উপহার"}</span>
            </li>)}
          </ul> : null}

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-medium">
            {tab === "paid" && ends ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800"><BadgeCheck className="size-3.5" />{span(ends, now)} বাকি · {date(ends)} পর্যন্ত</span> : null}
            {tab === "ended" && ends ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800"><Clock3 className="size-3.5" />{span(ends, now)} আগে শেষ · {date(ends)}</span> : null}
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">যোগ দিয়েছে {date(row.joinedAt)}</span>
            {row.lastAiAt ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">শেষ AI ব্যবহার {span(row.lastAiAt, now) === "আজ" ? "আজ" : `${span(row.lastAiAt, now)} আগে`}</span> : null}
            <button type="button" onClick={() => setOpen(open === row.id ? null : row.id)} aria-expanded={open === row.id} className="ml-auto inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">Manage <ChevronDown className={cn("size-3.5 transition-transform", open === row.id && "rotate-180")} /></button>
          </div>
          {open === row.id ? <Controls row={row} paid={tab === "paid"} onConfirm={setConfirm} /> : null}
        </li>;
      })}
    </ul> : <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">{query ? "এই নামে কাউকে পাওয়া যায়নি।" : tab === "paid" ? "এখন কারো plan চলছে না।" : tab === "ended" ? "কারো plan শেষ হয়ে যায়নি।" : "সবাই অন্তত একবার plan নিয়েছে।"}</p>}

    {total > 0 ? <Pagination page={page} limit={limit} total={total} label="customers" /> : null}

    <AlertDialog open={Boolean(confirm)} onOpenChange={(value) => !value && setConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
        <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখো</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => { if (confirm) run(confirm.run, confirm.done); setConfirm(null); }} className="bg-red-600 hover:bg-red-700">{confirm?.action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
