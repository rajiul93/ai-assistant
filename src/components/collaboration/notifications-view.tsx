"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/server/actions/notifications";
import { useLive } from "./live-provider";
import { NotificationList } from "./notification-list";

/** /notifications: the full list (latest 100). Visiting it marks everything read. */
export function NotificationsView() {
  const { refresh } = useLive();
  // A moment later, so the list has loaded and still shows which ones were new.
  useEffect(() => {
    const timer = window.setTimeout(() => void markNotificationsRead("all").then(refresh), 1500);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  return <div className="mx-auto max-w-2xl space-y-4">
    <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
    <div className="rounded-2xl border border-zinc-200 bg-white p-2"><NotificationList limit={100} /></div>
  </div>;
}
