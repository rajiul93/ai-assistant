"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { formatHoursMinutes } from "@/lib/dayjs";
import { useLiveTimerSeconds } from "@/lib/use-timer";

const hours = (seconds: number) => Math.floor((seconds / 3600) * 10) / 10;

/**
 * "Daily Study Challenge", compact (half a row on a phone): today's study time against the daily
 * target (saved sessions plus the running timer, live), and the streak of days in a row with study.
 */
export function DailyChallengeCard({ dailyTargetMinutes, savedSeconds, streak }: { dailyTargetMinutes: number; savedSeconds: number; streak: number }) {
  const studied = savedSeconds + useLiveTimerSeconds();
  const target = dailyTargetMinutes * 60;
  const percent = target ? Math.min(100, (studied / target) * 100) : 0;
  const done = target > 0 && studied >= target;

  return <Link href="/progress" className="flex h-full flex-col rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] transition active:scale-[0.98] sm:p-5">
    <div className="flex items-center gap-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-50 sm:size-11"><Flame className="size-5 fill-orange-400 text-orange-500 sm:size-6" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold leading-tight text-slate-900 sm:text-base">দৈনিক লক্ষ্য</span>
        <span className="block truncate text-[11px] font-semibold text-orange-700 sm:text-sm">{streak ? `${streak} দিনের streak` : "Streak শুরু করুন"}</span>
      </span>
    </div>
    <p className="mt-2.5 text-[11.5px] leading-snug text-slate-500 sm:text-sm">{done ? "আজকের লক্ষ্য পূরণ!" : `আজ ${formatHoursMinutes(dailyTargetMinutes)} পড়ুন`}</p>
    <div className="mt-auto pt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 sm:h-2"><div className={done ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-blue-600"} style={{ width: `${percent}%` }} /></div>
      <p className="mt-1.5 text-[11px] font-medium tabular-nums text-slate-600 sm:text-sm">{hours(studied)} / {hours(target)} ঘণ্টা</p>
    </div>
  </Link>;
}
