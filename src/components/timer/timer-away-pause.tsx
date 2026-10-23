"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { toBanglaDigits } from "@/lib/calendars";
import { awayText, clearAway, ownsStretch, readAway, saveAway } from "@/lib/timer-away";
import { useTimerHydrated } from "@/lib/use-timer";
import { useTimerStore } from "@/store/timer";

/** Away for less than this comes back without a message (a quick tab flick, a Prep tab switch). */
const QUIET_MS = 5_000;

/**
 * Pauses the study timer the moment Prep is hidden (another tab or app, the phone locked, the tab
 * closed) and runs it again when Prep is seen again, without the time away. Rules in
 * `src/lib/timer-away.ts`. The pause is done right in the "hidden" event: a locked phone may freeze
 * the page straight after, so nothing can wait for later.
 */
export function TimerAwayPause() {
  const hydrated = useTimerHydrated();

  useEffect(() => {
    if (!hydrated) return;

    const leave = () => {
      if (document.visibilityState !== "hidden") return;
      const timer = useTimerStore.getState();
      if (!timer.running || timer.paused || !ownsStretch(timer.startedAt)) return;
      timer.pause();
      saveAway({ at: Date.now(), accumulatedMs: useTimerStore.getState().accumulatedMs });
    };

    const back = () => {
      if (document.visibilityState !== "visible") return;
      const away = readAway();
      if (!away) return;
      clearAway();
      const timer = useTimerStore.getState();
      // Only the pause made on leaving: not if it was stopped, resumed or paused again since.
      if (!timer.running || !timer.paused || timer.accumulatedMs !== away.accumulatedMs) return;
      timer.resume();
      const gone = Date.now() - away.at;
      if (gone >= QUIET_MS) toast(`Prep-এর বাইরে ছিলে ${toBanglaDigits(awayText(gone))} — সেই সময় বাদ দিয়ে টাইমার আবার চলছে`);
    };

    // A page reloaded (or thrown away by the phone) while away resumes on opening.
    back();
    document.addEventListener("visibilitychange", leave);
    document.addEventListener("visibilitychange", back);
    // Two Prep windows side by side: the one still on screen gets no "visible" event, so any use of it counts.
    window.addEventListener("focus", back);
    window.addEventListener("pointerdown", back);
    window.addEventListener("keydown", back);
    return () => {
      document.removeEventListener("visibilitychange", leave);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
      window.removeEventListener("pointerdown", back);
      window.removeEventListener("keydown", back);
    };
  }, [hydrated]);

  return null;
}
