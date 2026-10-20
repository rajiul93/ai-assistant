"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText, ListChecks, ListTodo, Loader2, MessageSquareText, Search, Send, Share2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shareTypeLabel, type ShareType } from "@/lib/collaboration";
import { cn } from "@/lib/utils";
import { shareItem, shareTargets } from "@/server/actions/shares";
import { useLive } from "./live-provider";
import { errorMessage } from "@/lib/user-error";

/**
 * "Share" for a note, task, Preliminary set or Short Question set: pick friends and/or groups, send.
 * Each person gets a request and the item lands in their own section when they accept (a copy, not
 * a link).
 */
export function ShareButton({ type, itemId, title, className, label = true }: { type: ShareType; itemId: string; title: string; className?: string; label?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`“${title}” share করো`} title="Friend বা group-এ share করো" className={cn("flex items-center gap-1.5 rounded-lg text-sm font-medium transition", className)}>
      <Share2 className="size-4" />{label ? "Share" : null}
    </button>
    {open ? <ShareDialog type={type} itemId={itemId} title={title} onClose={() => setOpen(false)} /> : null}
  </>;
}

const typeIcon: Record<ShareType, typeof FileText> = { NOTE: FileText, TASK: ListTodo, PRELIMINARY_SET: ListChecks, SHORT_QUESTION_SET: MessageSquareText };

/** The dialog on its own, for opening from a menu that closes itself (task card). */
export function ShareDialog({ type, itemId, title, onClose }: { type: ShareType; itemId: string; title: string; onClose: () => void }) {
  const { refresh } = useLive();
  const targets = useQuery({ queryKey: ["share-targets", type, itemId], queryFn: () => shareTargets({ type, itemId }) });
  const [tab, setTab] = useState<"friends" | "groups">("friends");
  const [query, setQuery] = useState("");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  const Icon = typeIcon[type];

  const friends = targets.data?.friends ?? [];
  const groups = targets.data?.groups ?? [];
  const needle = query.trim().toLowerCase();
  const shownFriends = needle ? friends.filter((friend) => `${friend.name} ${friend.email ?? ""}`.toLowerCase().includes(needle)) : friends;
  const shownGroups = needle ? groups.filter((group) => group.name.toLowerCase().includes(needle)) : groups;
  const picked = friendIds.length + groupIds.length;
  const summary = [friendIds.length ? `${friendIds.length} জন friend` : "", groupIds.length ? `${groupIds.length}টি group` : ""].filter(Boolean).join(" ও ");

  async function send() {
    setSending(true);
    try {
      const result = await shareItem({ type, itemId, friendIds, groupIds });
      toast.success(result.sent ? `${result.sent} জনকে পাঠানো হলো — তারা নিলে তাদের ${shareTypeLabel[type]}-এ যোগ হবে` : "আগেই পাঠানো আছে, উত্তরের অপেক্ষায়");
      refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Share করা গেল না।"));
    } finally {
      setSending(false);
    }
  }

  const row = (on: boolean, disabled: boolean) => cn("flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition", on ? "bg-indigo-50 ring-1 ring-indigo-300" : "hover:bg-zinc-50", disabled && "opacity-55");
  const tick = (on: boolean) => <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full ring-1 transition", on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white ring-zinc-300")}>{on ? <Check className="size-3.5" strokeWidth={3} /> : null}</span>;

  return <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
      <DialogHeader className="space-y-0 px-5 pb-3 pt-5">
        <DialogTitle className="text-lg">Share করো</DialogTitle>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-50 p-2.5 ring-1 ring-zinc-100">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Icon className="size-5" /></span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-semibold text-zinc-900">{title}</span>
            <span className="block text-xs text-zinc-500">{shareTypeLabel[type]}</span>
          </span>
        </div>
      </DialogHeader>

      <div className="space-y-2.5 px-5">
        <div role="tablist" aria-label="কাকে পাঠাবে" className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1">
          {([["friends", "Friends", friends.length, friendIds.length, UserRound], ["groups", "Groups", groups.length, groupIds.length, Users]] as const).map(([key, label, total, chosen, TabIcon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn("flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition", tab === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>
            <TabIcon className="size-4" />{label}<span className="text-[11px] tabular-nums text-zinc-400">{total}</span>
            {chosen ? <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] leading-4 text-white tabular-nums">{chosen}</span> : null}
          </button>)}
        </div>
        {(tab === "friends" ? friends.length : groups.length) > 5 ? <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "friends" ? "Friend খোঁজো" : "Group খোঁজো"} aria-label="খোঁজো" className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
        </label> : null}
      </div>

      <div className="mt-2 min-h-32 flex-1 space-y-1 overflow-y-auto px-3.5 pb-2">
        {targets.isLoading ? [0, 1, 2].map((index) => <div key={index} className="mx-1 h-14 animate-pulse rounded-2xl bg-zinc-100" />) : null}
        {targets.isError ? <p className="px-1.5 text-sm text-red-600">List আনা গেল না। <button type="button" onClick={() => void targets.refetch()} className="underline">আবার চেষ্টা করো</button></p> : null}

        {targets.data && tab === "friends" ? <>
          {!friends.length ? <Empty text="এখনো কোনো friend নেই।" link="/messages?add=friend" label="Friend যোগ করো" onClose={onClose} /> : null}
          {shownFriends.map((friend) => {
            const on = friendIds.includes(friend.id);
            return <button key={friend.id} type="button" disabled={friend.pending} onClick={() => setFriendIds((list) => toggle(list, friend.id))} aria-pressed={on} className={row(on, friend.pending)}>
              {friend.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={friend.image} alt="" className="size-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-sky-400 text-sm font-bold text-white">{friend.initial}</span>}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{friend.name}</span><span className="block truncate text-xs text-zinc-500">{friend.pending ? "আগেই পাঠানো — উত্তরের অপেক্ষায়" : friend.email}</span></span>
              {friend.pending ? null : tick(on)}
            </button>;
          })}
        </> : null}

        {targets.data && tab === "groups" ? <>
          {!groups.length ? <Empty text="আপনি এখনো কোনো group-এ নেই।" link="/messages" label="Group বানাও" onClose={onClose} /> : null}
          {shownGroups.map((group) => {
            const on = groupIds.includes(group.id);
            const done = group.others > 0 && group.pending >= group.others;
            return <button key={group.id} type="button" disabled={done || !group.others} onClick={() => setGroupIds((list) => toggle(list, group.id))} aria-pressed={on} className={row(on, done || !group.others)}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-400 text-white"><Users className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{group.name}</span>
                <span className="block truncate text-xs text-zinc-500">{group.others} জন member{group.pending ? ` · ${group.pending} জনকে আগেই পাঠানো` : ""}</span></span>
              {done || !group.others ? null : tick(on)}
            </button>;
          })}
        </> : null}
        {targets.data && needle && !(tab === "friends" ? shownFriends : shownGroups).length ? <p className="py-6 text-center text-sm text-zinc-500">কিছু মেলেনি</p> : null}
      </div>

      <div className="space-y-2 border-t border-zinc-100 px-5 pb-5 pt-3">
        <p className="text-[11.5px] leading-relaxed text-zinc-500">যে নেবে তার কাছে একটা কপি যোগ হবে — পরে আপনি বদলালেও সেটা বদলাবে না। Group-এ পাঠালে প্রত্যেক member আলাদা request পাবে, আর chat-এ একটা লাইন যাবে।</p>
        <button type="button" onClick={() => void send()} disabled={sending || !picked} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(79,70,229,0.9)] transition hover:bg-indigo-700 disabled:bg-zinc-300 disabled:shadow-none">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {picked ? `পাঠাও · ${summary}` : "কাকে পাঠাবে বেছে নাও"}
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}

function Empty({ text, link, label, onClose }: { text: string; link: string; label: string; onClose: () => void }) {
  return <p className="mx-1 rounded-2xl border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">{text} <Link href={link} onClick={onClose} className="font-medium text-indigo-700 underline">{label}</Link></p>;
}
