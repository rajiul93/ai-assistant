"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { shareTypeLabel } from "@/lib/collaboration";
import { formatDateTime } from "@/lib/dayjs";
import { cancelFriendRequest, listFriendsOverview, respondFriendRequest } from "@/server/actions/friends";
import { listIncomingShares, respondShare } from "@/server/actions/shares";
import { useLive } from "./live-provider";
import { SharePreviewDialog } from "./share-preview-dialog";

const answerButton = "flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium disabled:opacity-50";

/**
 * Everything waiting for an answer: friend requests (both ways) and items friends have shared.
 * Used on /messages → Requests and, when something is waiting, on the dashboard.
 */
export function RequestsPanel({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { refresh } = useLive();
  const [busy, setBusy] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const friends = useQuery({ queryKey: ["friends"], queryFn: () => listFriendsOverview() });
  const shares = useQuery({ queryKey: ["shares"], queryFn: () => listIncomingShares() });

  const reload = () => {
    for (const key of ["friends", "shares", "notifications", "conversations"]) void queryClient.invalidateQueries({ queryKey: [key] });
    refresh();
  };
  async function run(id: string, work: () => Promise<void>) {
    setBusy(id);
    try { await work(); reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "করা গেল না।"); } finally { setBusy(null); }
  }

  if (friends.isLoading || shares.isLoading) return compact ? null : <div className="space-y-2">{[0, 1].map((index) => <div key={index} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />)}</div>;
  if (friends.isError || shares.isError) return compact ? null : <p className="text-sm text-red-600">আনা গেল না। <button type="button" onClick={reload} className="underline">আবার চেষ্টা করো</button></p>;

  const incoming = friends.data?.incoming ?? [];
  const outgoing = friends.data?.outgoing ?? [];
  const waitingShares = shares.data ?? [];
  if (compact && !incoming.length && !waitingShares.length) return null;

  const card = "rounded-2xl border border-zinc-200 bg-white p-3";
  return <div className="space-y-4">
    {compact ? <h2 className="flex items-center gap-2 font-semibold"><Inbox className="size-4 text-indigo-600" /> আপনার উত্তরের অপেক্ষায়</h2> : null}

    {waitingShares.length ? <section className="space-y-2">
      {!compact ? <h3 className="text-sm font-semibold text-zinc-600">Share করা জিনিস ({waitingShares.length})</h3> : null}
      {waitingShares.map((share) => <div key={share.id} className={card}>
        <p className="text-sm"><span className="font-semibold">{share.sender.name}</span> আপনার সাথে একটা <span className="font-medium">{shareTypeLabel[share.type]}</span> share করেছে</p>
        <p className="mt-1 font-semibold">“{share.title}”</p>
        <p className="text-xs text-zinc-500">{[share.preview, formatDateTime(share.createdAt)].filter(Boolean).join(" · ")}</p>
        <div className="mt-2.5 flex gap-2">
          {/* Accepting happens in the preview, after seeing everything inside. */}
          <button type="button" disabled={busy === share.id} onClick={() => setPreviewing(share.id)} className={`${answerButton} bg-indigo-600 text-white hover:bg-indigo-700`}><Eye className="size-4" /> দেখো ও নাও</button>
          <button type="button" disabled={busy === share.id} onClick={() => void run(share.id, async () => { await respondShare(share.id, false); toast.success("বাদ দেওয়া হলো"); })} className={`${answerButton} text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50`}><X className="size-4" /> বাদ</button>
        </div>
      </div>)}
    </section> : null}

    {incoming.length ? <section className="space-y-2">
      {!compact ? <h3 className="text-sm font-semibold text-zinc-600">Friend request ({incoming.length})</h3> : null}
      {incoming.map((request) => <div key={request.id} className={`${card} flex flex-wrap items-center gap-3`}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">{request.person.initial}</span>
        <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">{request.person.name}</span> friend হতে চায়<span className="block text-xs text-zinc-500">{formatDateTime(request.createdAt)}</span></p>
        <div className="flex gap-2">
          <button type="button" disabled={busy === request.id} onClick={() => void run(request.id, async () => { await respondFriendRequest(request.id, true); toast.success("এখন আপনারা friend"); })} className={`${answerButton} bg-emerald-600 text-white hover:bg-emerald-700`}><Check className="size-4" /> গ্রহণ</button>
          <button type="button" disabled={busy === request.id} onClick={() => void run(request.id, async () => { await respondFriendRequest(request.id, false); })} className={`${answerButton} text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50`}><X className="size-4" /> বাদ</button>
        </div>
      </div>)}
    </section> : null}

    {!compact && outgoing.length ? <section className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-600">আপনার পাঠানো request ({outgoing.length})</h3>
      {outgoing.map((request) => <div key={request.id} className={`${card} flex items-center gap-3`}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">{request.person.initial}</span>
        <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">{request.person.name}</span><span className="block text-xs text-zinc-500">উত্তরের অপেক্ষায় · {formatDateTime(request.createdAt)}</span></p>
        <button type="button" disabled={busy === request.id} onClick={() => void run(request.id, async () => { await cancelFriendRequest(request.id); toast.success("Request তুলে নেওয়া হলো"); })} className={`${answerButton} text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50`}>তুলে নাও</button>
      </div>)}
    </section> : null}

    {previewing ? <SharePreviewDialog shareId={previewing} onClose={() => { setPreviewing(null); reload(); }} /> : null}

    {!compact && !incoming.length && !outgoing.length && !waitingShares.length ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">কোনো request নেই।</p> : null}
  </div>;
}
