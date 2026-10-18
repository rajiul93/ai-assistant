"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, ExternalLink, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getJobReminder } from "@/server/actions/applications";

const SEEN_KEY = "prep:jobs-reminder";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
// A link saved without its scheme ("teletalk.com.bd/...") still opens.
const href = (link: string) => (/^https?:\/\//i.test(link) ? link : `https://${link}`);

type Reminder = Awaited<ReturnType<typeof getJobReminder>>;

/**
 * Once a day, on the first page opened (owner, 2026-10-18): applied anywhere for a job? Check the
 * links of the ones applied for — a saved link opens the circular's site (the admit card is on
 * the government site), so every application should have one. Remembered in this browser only.
 */
export function JobsReminder() {
  const pathname = usePathname();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);

  // Once per load; the date key stops it on later pages and later visits the same day.
  useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* treat as not seen */ }
    if (seen === today()) return;
    // A moment after the page opens, so it doesn't jump in front of the page itself.
    const timer = window.setTimeout(() => {
      getJobReminder().then((value) => {
        setReminder(value);
        setOpen(true);
        try { localStorage.setItem(SEEN_KEY, today()); } catch { /* shown again tomorrow at worst */ }
      }).catch(() => { /* no reminder today */ });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!reminder || pathname.startsWith("/jobs")) return null;
  const close = () => setOpen(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-teal-400 to-emerald-600 text-white"><BriefcaseBusiness className="size-5" /></span> আজকের চাকরির খোঁজ</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-[14.5px] text-slate-700">
        {reminder.total
          ? <p>যেসব জায়গায় apply করেছ, সেগুলোর link একবার দেখে নাও — নতুন notice, admit card বা পরীক্ষার তারিখ এসেছে কি না।</p>
          : <p>এখনো কোথাও apply করোনি? আজকের circular দেখে apply করো, আর apply করলে <span className="font-semibold">Jobs</span>-এ যোগ করে রাখো।</p>}

        {reminder.links.length ? <ul className="space-y-1.5">
          {reminder.links.map((item) => <li key={item.id}>
            <a href={href(item.link!)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 transition hover:bg-white">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-slate-900">{item.title}</span>
                <span className="block truncate text-xs text-slate-500">{item.organization}</span>
              </span>
              <ExternalLink className="size-4 shrink-0 text-blue-600" />
            </a>
          </li>)}
        </ul> : null}

        {/* Why the link matters. */}
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
          <Link2 className="mt-0.5 size-4 shrink-0" />
          <span>প্রতিটা আবেদনের সাথে link যোগ করে রাখো — তাহলে এখান থেকে এক চাপে admit card-এর পাতায় (সরকারি website) যেতে পারবে।{reminder.withoutLink ? <span className="font-semibold"> {reminder.withoutLink}টা আবেদনে এখনো link নেই।</span> : null}</span>
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={close} className="h-11 rounded-xl text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">পরে দেখব</button>
          <Link href="/jobs" onClick={close} className="flex h-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">{reminder.withoutLink ? "Link যোগ করো" : "Jobs-এ যাও"}</Link>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
