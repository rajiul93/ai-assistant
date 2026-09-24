"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { assistantStrings } from "@/lib/assistant-i18n";
import { speak } from "@/lib/voice";
import { useAssistantStore } from "@/store/assistant";
import { useTimerStore } from "@/store/timer";

/** A soft two-note chime, so the goal is noticed even with the speaker volume low. */
function chime() {
  try {
    const context = new AudioContext();
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.22;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.55);
    });
    window.setTimeout(() => void context.close(), 1500);
  } catch { /* audio unavailable: the toast and voice still tell the user */ }
}

/**
 * Watches the study timer on every page and announces once when the session goal is reached,
 * so a timer started by voice still finishes with a clear signal after navigating away.
 */
export function TimerAlarm() {
  useEffect(() => {
    const id = window.setInterval(() => {
      const timer = useTimerStore.getState();
      if (!timer.running || timer.paused || !timer.targetMinutes || timer.targetReached) return;
      if (timer.elapsedSeconds() < timer.targetMinutes * 60) return;
      timer.markTargetReached();
      const message = assistantStrings[useAssistantStore.getState().lang].timerDone(timer.targetMinutes);
      chime();
      toast.success(message, { duration: 10_000 });
      window.setTimeout(() => speak(message), 900);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
