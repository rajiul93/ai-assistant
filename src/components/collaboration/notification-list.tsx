"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { shareTypeLabel } from "@/lib/collaboration";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { respondFriendRequest } from "@/server/actions/friends";
import { listNotifications } from "@/server/actions/notifications";
import { respondShare } from "@/server/actions/shares";
import { useLive } from "./live-provider";
import { SharePreviewDialog } from "./share-preview-dialog";

type Item = Awaited<ReturnType<typeof listNotifications>>[number];

/** The sentence for one notification, and where tapping it leads. */
function describe(item: Item): { text: string; href: string } {
  const who = item.actor?.name ?? "কেউ";
  const thing = item.share ? `${shareTypeLabel[item.share.type]} “${item.share.title}”` : "";
  switch (item.type) {
    case "FRIEND_REQUEST": return { text: `${who} আপনাকে friend request পাঠিয়েছে`, href: "/messages?tab=requests" };
    case "FRIEND_ACCEPTED": return { text: `${who} আপনার friend request গ্রহণ করেছে`, href: "/messages" };
    case "FRIEND_REJECTED": return { text: `${who} আপনার friend request গ্রহণ করেনি`, href: "/messages" };
    case "SHARE_REQUEST": return { text: `${who} আপনার সাথে ${thing} share করেছে`, href: "/messages?tab=requests" };
    case "SHARE_ACCEPTED": return { text: `${who} আপনার ${thing} নিয়েছে`, href: "/messages?tab=requests" };
    case "SHARE_REJECTED": return { text: `${who} আপনার ${thing} নেয়নি`, href: "/messages?tab=requests" };
    case "GROUP_ADDED": return { text: `${who} আপনাকে “${item.group?.name ?? "একটা"}” গ্রুপে যোগ করেছে`, href: item.group ? `/messages?tab=chats&group=${item.group.id}` : "/messages" };
  }
}

/**
 * Answer right inside the notification while the request is still waiting. A friend request can be
 * accepted here; a share is opened first, so it's accepted only after seeing what's inside.
 */
function QuickAnswer({ item, onDone }: { item: Item; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const waitingFriend = item.type === "FRIEND_REQUEST" && item.friendRequest?.status === "PENDING";
  const waitingShare = item.type === "SHARE_REQUEST" && item.share?.status === "PENDING";
  if (!waitingFriend && !waitingShare) return null;

  async function answer(accept: boolean) {
    setBusy(true);
    try {
      if (waitingFriend && item.friendRequest) {
        await respondFriendRequest(item.friendRequest.id, accept);
        toast.success(accept ? "এখন আপনারা friend" : "Request বাদ দেওয়া হলো");
      } else if (item.share) {
        const result = await respondShare(item.share.id, accept);
        if (result.path) toast.success("আপনার কাছে যোগ হলো", { action: { label: "খুলুন", onClick: () => router.push(result.path!) } });
        else toast.success("Share বাদ দেওয়া হলো");
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "করা গেল না।");
    } finally {
      setBusy(false);
    }
  }
  return <div className="mt-2 flex gap-2">
    {waitingShare && item.share ? <>
      <button type="button" onClick={() => setPreviewing(true)} className="flex h-8 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"><Eye className="size-3.5" /> দেখো ও নাও</button>
      {previewing ? <SharePreviewDialog shareId={item.share.id} onClose={() => { setPreviewing(false); onDone(); }} /> : null}
    </> : <button type="button" disabled={busy} onClick={() => void answer(true)} className="flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="size-3.5" /> গ্রহণ</button>}
    <button type="button" disabled={busy} onClick={() => void answer(false)} className="flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"><X className="size-3.5" /> বাদ</button>
  </div>;
}

/** Notifications (newest first) plus a line for unread chats; used by the bell and /notifications. */
export function NotificationList({ limit, onNavigate }: { limit: number; onNavigate?: () => void }) {
  const queryClient = useQueryClient();
  const { counts, refresh } = useLive();
  const query = useQuery({ queryKey: ["notifications", limit], queryFn: () => listNotifications(limit) });
  const reload = () => { void queryClient.invalidateQueries({ queryKey: ["notifications"] }); refresh(); };

  if (query.isLoading) return <div className="space-y-2 p-1">{[0, 1, 2].map((index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-zinc-100" />)}</div>;
  if (query.isError) return <p className="p-3 text-sm text-red-600">Notification আনা গেল না। <button type="button" onClick={() => void query.refetch()} className="underline">আবার চেষ্টা করো</button></p>;

  const items = query.data ?? [];
  return <ul className="divide-y divide-zinc-100">
    {counts.messagesUnread > 0 ? <li>
      <Link href="/messages" onClick={onNavigate} className="flex items-center gap-3 rounded-xl bg-indigo-50/60 px-3 py-3 text-sm hover:bg-indigo-50">
        <MessageCircle className="size-5 shrink-0 text-indigo-600" />
        <span className="font-medium text-indigo-950">{counts.messagesUnread}টি নতুন message</span>
      </Link>
    </li> : null}
    {items.map((item) => {
      const { text, href } = describe(item);
      return <li key={item.id} className={cn("px-3 py-3", !item.read && "bg-amber-50/50")}>
        <Link href={href} onClick={onNavigate} className="block text-sm leading-snug hover:underline">
          {!item.read ? <span className="mr-1.5 inline-block size-2 rounded-full bg-rose-500 align-middle" /> : null}
          {text}
        </Link>
        {item.share?.preview ? <p className="mt-0.5 text-xs text-zinc-500">{item.share.preview}</p> : null}
        <p className="mt-0.5 text-[11px] text-zinc-400">{formatDateTime(item.createdAt)}</p>
        <QuickAnswer item={item} onDone={reload} />
      </li>;
    })}
    {!items.length && !counts.messagesUnread ? <li className="px-3 py-8 text-center text-sm text-zinc-500">কোনো notification নেই।</li> : null}
  </ul>;
}
