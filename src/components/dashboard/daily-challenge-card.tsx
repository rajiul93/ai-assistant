"use client";

import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { formatHoursMinutes } from "@/lib/dayjs";
import { useLiveTimerSeconds } from "@/lib/use-timer";

const hours = (seconds: number) => Math.floor((seconds / 3600) * 10) / 10;

/**
 * "Daily Study Challenge": today's study time against the daily target (saved sessions plus the
 * running timer, live), and the streak of days in a row with any study.
 */
export function DailyChallengeCard({ dailyTargetMinutes, savedSeconds, streak }: { dailyTargetMinutes: number; savedSeconds: number; streak: number }) {
  const studied = savedSeconds + useLiveTimerSeconds();
  const target = dailyTargetMinutes * 60;
  const percent = target ? Math.min(100, (studied / target) * 100) : 0;
  const done = target > 0 && studied >= target;

  return <section className="rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5">
    <div className="flex items-start gap-3 sm:gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-orange-50 sm:size-16"><Flame className="size-8 fill-orange-400 text-orange-500 sm:size-9" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/progress" className="flex items-center gap-1 whitespace-nowrap text-[clamp(15px,4.3vw,20px)] font-bold tracking-tight text-slate-900 hover:text-blue-700">Daily Study Challenge <ChevronRight className="size-4 text-slate-400" /></Link>
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-orange-50 px-2.5 py-1 text-[clamp(11px,3vw,14px)] font-semibold text-orange-800 ring-1 ring-orange-100">
            <Flame className="size-3.5 fill-orange-400 text-orange-500" />{streak ? `${streak} Days Streak` : "Streak শুরু করুন"}
          </span>
        </div>
        <p className="mt-1 text-[clamp(12.5px,3.5vw,16px)] leading-snug text-slate-500">{done ? "আজকের লক্ষ্য পূরণ হয়েছে — দারুণ!" : `আজ ${formatHoursMinutes(dailyTargetMinutes)} পড়ুন, streak ধরে রাখুন!`}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={done ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-blue-600"} style={{ width: `${percent}%` }} /></div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600 sm:text-sm">{hours(studied)} / {hours(target)} hours</span>
        </div>
      </div>
    </div>
  </section>;
}
