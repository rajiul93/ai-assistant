"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import {
  BANGLA_MONTHS, ENGLISH_MONTHS, HIJRI_MONTHS, HIJRI_MONTHS_ARABIC, WEEKDAYS, WEEKDAYS_LONG,
  banglaDate, dayOf, formatBangla, formatEnglish, formatHijri, hijriDate, toBanglaDigits, type CalendarDate,
} from "@/lib/calendars";
import { onOpenTool } from "@/components/tool-dock";
import { cn } from "@/lib/utils";

const ADJUST_KEY = "prep:hijri-adjust";

const move = (step: number) => ({ year, month }: { year: number; month: number }) => ({ year: year + Math.floor((month + step) / 12), month: (((month + step) % 12) + 12) % 12 });

/** Months a run of days touches, as "আশ্বিন – কার্তিক ১৪৩৩" (or with both years when it crosses one). */
function span(first: CalendarDate | null, last: CalendarDate | null, names: string[]) {
  if (!first || !last) return "";
  if (first.month === last.month && first.year === last.year) return `${names[first.month]} ${toBanglaDigits(first.year)}`;
  if (first.year === last.year) return `${names[first.month]} – ${names[last.month]} ${toBanglaDigits(last.year)}`;
  return `${names[first.month]} ${toBanglaDigits(first.year)} – ${names[last.month]} ${toBanglaDigits(last.year)}`;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Opened from the tools button (ToolDock): a full-screen calendar: one English month
 * where every day also shows its Bangla (বঙ্গাব্দ) and Hijri date, and the picked day in all three.
 */
export function CalendarSheet() {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const [view, setView] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const [selected, setSelected] = useState(today);
  const [adjust, setAdjust] = useState(0);

  const changeAdjust = (value: number) => {
    setAdjust(value);
    try { localStorage.setItem(ADJUST_KEY, String(value)); } catch { /* not saved; fine for this visit */ }
  };

  const show = useCallback(() => {
    // Opening always lands on today (the app may have stayed open past midnight).
    const now = new Date();
    setToday(now);
    setSelected(now);
    setView({ year: now.getFullYear(), month: now.getMonth() });
    try { setAdjust(Math.max(-2, Math.min(2, Number(localStorage.getItem(ADJUST_KEY)) || 0))); } catch { /* storage blocked: keep 0 */ }
    setOpen(true);
  }, []);
  // Opened from the tools button (ToolDock).
  useEffect(() => onOpenTool("calendar", show), [show]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft") setView(move(-1));
      if (event.key === "ArrowRight") setView(move(1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const lead = dayOf(view.year, view.month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = dayOf(view.year, view.month, index + 1);
    return { date, bangla: banglaDate(date), hijri: hijriDate(date, adjust) };
  });
  const picked = { bangla: banglaDate(selected), hijri: hijriDate(selected, adjust) };
  const isThisMonth = view.year === today.getFullYear() && view.month === today.getMonth();

  return <>

    {open ? <div role="dialog" aria-modal="true" aria-label="ক্যালেন্ডার" className="assistant-panel-in fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[#f3f3ef] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:bottom-6 sm:right-6 sm:max-h-[calc(100dvh-3rem)] sm:w-[26rem] sm:rounded-3xl sm:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] sm:ring-1 sm:ring-slate-200">
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-linear-to-br from-[#3f6ef3] to-[#7f9cfa] text-white"><CalendarDays className="size-5" /></span>
        <h2 className="flex-1 text-[17px] font-bold text-slate-900">ক্যালেন্ডার</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="flex size-10 items-center justify-center rounded-full text-slate-500 hover:bg-white"><X className="size-5" /></button>
      </header>

      {/* The picked day in all three calendars. */}
      <section className="mx-4 rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-4 text-white shadow-[0_14px_30px_-18px_rgba(37,99,235,0.9)]">
        <p className="text-[13px] font-semibold text-white/80">{sameDay(selected, today) ? "আজ, " : ""}{WEEKDAYS_LONG[selected.getDay()]}</p>
        <dl className="mt-2 space-y-1.5">
          <div className="flex items-baseline gap-2"><dt className="w-14 shrink-0 text-[12px] text-white/75">ইংরেজি</dt><dd className="text-[17px] font-bold">{formatEnglish(selected)}</dd></div>
          <div className="flex items-baseline gap-2"><dt className="w-14 shrink-0 text-[12px] text-white/75">বাংলা</dt><dd className="text-[17px] font-bold">{formatBangla(picked.bangla)} <span className="text-[12px] font-medium text-white/80">বঙ্গাব্দ</span></dd></div>
          {picked.hijri ? <div className="flex items-baseline gap-2"><dt className="w-14 shrink-0 text-[12px] text-white/75">আরবি</dt><dd className="min-w-0 text-[17px] font-bold">{formatHijri(picked.hijri)} <span className="text-[12px] font-medium text-white/80">হিজরি</span> <span dir="rtl" lang="ar" className="ml-1 text-[17px] font-semibold text-white/90">{HIJRI_MONTHS_ARABIC[picked.hijri.month]}</span></dd></div> : null}
        </dl>
      </section>

      <section className="mx-4 mt-3 rounded-3xl bg-white p-3 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setView(move(-1))} aria-label="আগের মাস" className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95"><ChevronLeft className="size-5" /></button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[16px] font-bold text-slate-900">{ENGLISH_MONTHS[view.month]} {toBanglaDigits(view.year)}</p>
            <p className="truncate text-[13.5px] font-semibold text-emerald-700">{span(days[0].bangla, days.at(-1)!.bangla, BANGLA_MONTHS)}</p>
            <p className="truncate text-[13.5px] font-semibold text-amber-700">{span(days[0].hijri, days.at(-1)!.hijri, HIJRI_MONTHS)}</p>
          </div>
          <button type="button" onClick={() => setView(move(1))} aria-label="পরের মাস" className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95"><ChevronRight className="size-5" /></button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((name, index) => <span key={name} className={cn("pb-1 text-[11px] font-semibold", index === 5 ? "text-red-500" : "text-slate-400")}>{name}</span>)}
          {Array.from({ length: lead }, (_, index) => <span key={`lead-${index}`} />)}
          {days.map(({ date, bangla, hijri }) => {
            const isToday = sameDay(date, today);
            const isPicked = sameDay(date, selected);
            return <button
              key={date.getDate()}
              type="button"
              onClick={() => setSelected(date)}
              aria-pressed={isPicked}
              aria-label={`${formatEnglish(date)}, ${formatBangla(bangla)}${hijri ? `, ${formatHijri(hijri)}` : ""}`}
              className={cn(
                "flex h-[clamp(50px,7dvh,62px)] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-0.5 transition active:scale-95",
                isPicked ? "bg-blue-600 text-white" : isToday ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-slate-50",
              )}
            >
              <span className={cn("text-[15px] font-bold leading-none tabular-nums", !isPicked && (date.getDay() === 5 ? "text-red-500" : "text-slate-900"))}>{date.getDate()}</span>
              <span className="flex w-full justify-center gap-0.5 text-[12.5px] font-bold leading-none">
                {/* The 1st of a Bangla or Hijri month is filled so a new month stands out. */}
                <span className={cn("rounded px-0.5", isPicked ? "text-white/90" : "text-emerald-700", bangla.day === 1 && !isPicked && "bg-emerald-100")}>{toBanglaDigits(bangla.day)}</span>
                {hijri ? <span className={cn("rounded px-0.5", isPicked ? "text-white/90" : "text-amber-700", hijri.day === 1 && !isPicked && "bg-amber-100")}>{toBanglaDigits(hijri.day)}</span> : null}
              </span>
            </button>;
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
          <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-slate-800" />ইংরেজি</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-emerald-600" />বাংলা</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-amber-600" />হিজরি</span>
          {isThisMonth ? null : <button type="button" onClick={() => { setView({ year: today.getFullYear(), month: today.getMonth() }); setSelected(today); }} className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">আজ</button>}
        </div>
      </section>

      {/* Bangladesh starts Hijri months on its own moon sighting; this lines the dates up with it. */}
      <div className="mx-4 my-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[12.5px] text-slate-600 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
        <span className="min-w-0 flex-1">হিজরি তারিখ চাঁদ দেখার সাথে মেলাও</span>
        <button type="button" onClick={() => changeAdjust(Math.max(-2, adjust - 1))} disabled={adjust <= -2} aria-label="হিজরি এক দিন কমাও" className="flex size-8 items-center justify-center rounded-full bg-slate-100 disabled:opacity-40"><Minus className="size-4" /></button>
        <span className="w-10 text-center font-bold tabular-nums text-slate-900">{adjust > 0 ? "+" : adjust < 0 ? "−" : ""}{toBanglaDigits(Math.abs(adjust))}</span>
        <button type="button" onClick={() => changeAdjust(Math.min(2, adjust + 1))} disabled={adjust >= 2} aria-label="হিজরি এক দিন বাড়াও" className="flex size-8 items-center justify-center rounded-full bg-slate-100 disabled:opacity-40"><Plus className="size-4" /></button>
      </div>
    </div> : null}
  </>;
}
