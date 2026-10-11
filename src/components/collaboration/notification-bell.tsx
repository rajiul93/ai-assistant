"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "@/server/actions/notifications";
import { useLive } from "./live-provider";
import { NotificationList } from "./notification-list";

/**
 * The bell in the shell: unread notifications plus unread chats. Opening it marks the
 * notifications read (the list still shows which ones were new this time).
 */
export function NotificationBell({ className }: { className?: string }) {
  const { counts, refresh } = useLive();
  const [open, setOpen] = useState(false);
  const total = counts.notificationsUnread + counts.messagesUnread;

  function show() {
    setOpen(true);
    // A moment later, so the list has loaded and can still show which ones were new.
    if (counts.notificationsUnread) window.setTimeout(() => void markNotificationsRead("all").then(refresh), 1500);
  }

  return <>
    <button type="button" onClick={show} aria-label={total ? `${total}টি নতুন notification` : "Notifications"} className={cn("relative flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950", className)}>
      <Bell className="size-5" />
      {total ? <span className="absolute -right-0.5 -top-0.5 min-w-4.5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold leading-4.5 text-white">{total > 99 ? "99+" : total}</span> : null}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <div className="flex items-center justify-between">
          <DialogTitle>Notifications</DialogTitle>
          <Link href="/notifications" onClick={() => setOpen(false)} className="mr-6 text-xs font-medium text-indigo-700 hover:underline">সব দেখো</Link>
        </div>
        {open ? <NotificationList limit={15} onNavigate={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  </>;
}
