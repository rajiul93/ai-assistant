"use client";

import { useState } from "react";
import { ChevronRight, Timer } from "lucide-react";
import { ClockTools } from "@/components/dashboard/clock-tools";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * The stopwatch and countdown as a small card that opens them, so they don't take a whole screen
 * of the home page. They keep their times in the browser, so closing the sheet doesn't stop them.
 */
export function ClockToolsCard() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex h-full flex-col rounded-3xl bg-white p-3.5 text-left shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] transition active:scale-[0.98] sm:p-5">
      <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 sm:size-11"><Timer className="size-5 text-emerald-600 sm:size-6" /></span>
      <span className="mt-2.5 block text-[13px] font-bold leading-tight text-slate-900 sm:text-base">Stopwatch / Timer</span>
      <span className="mt-auto flex items-center gap-0.5 pt-1 text-[11.5px] text-slate-500 sm:text-sm">খুলুন <ChevronRight className="size-3.5" /></span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle className="mb-3">Stopwatch / Timer</DialogTitle>
        <ClockTools />
      </DialogContent>
    </Dialog>
  </>;
}
