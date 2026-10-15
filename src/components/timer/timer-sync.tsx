"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useTimerHydrated } from "@/lib/use-timer";
import { claimSharedTimer, finishSharedTimer, getSharedTimer, updateSharedTimer, type SharedTimer } from "@/server/actions/timer";
import { useTimerStore } from "@/store/timer";

type Local = ReturnType<typeof useTimerStore.getState>;

const POLL_MS = 15_000;

const snapshot = (state: Local): SharedTimer => ({
  startedAt: state.startedAt,
  accumulatedMs: state.accumulatedMs,
  paused: state.paused,
  label: state.label,
  taskId: state.taskId,
  subjectId: state.subjectId,
  topicId: state.topicId,
  targetMinutes: state.targetMinutes,
});

const same = (state: Local, remote: SharedTimer) =>
  state.running && state.startedAt === remote.startedAt && state.accumulatedMs === remote.accumulatedMs && state.paused === remote.paused && state.label === remote.label;

/**
 * Keeps this device's timer in step with the one shared by all the user's devices (one at a time,
 * owner 2026-10-15). Starting here claims it — or, if another device already has one running,
 * shows that one instead; pause, resume and stop are passed on; and every 15 s (and when the app
 * comes back to the front) the shared one is read, so a timer started, paused or saved on the
 * other device shows up here too. The local store stays the source for the ticking clock.
 */
export function TimerSync() {
  const hydrated = useTimerHydrated();

  useEffect(() => {
    if (!hydrated) return;
    let applying = false;
    // This device knows the server holds its running timer (so "none" on the server means it
    // was ended elsewhere, not that it was never sent).
    let claimed = false;
    let stopped = false;

    const apply = (remote: SharedTimer | null) => {
      applying = true;
      const local = useTimerStore.getState();
      if (remote) {
        const elapsedMs = remote.accumulatedMs + (remote.startedAt && !remote.paused ? Date.now() - remote.startedAt : 0);
        // Same session: keep whether its goal was already announced; another one: don't announce a goal already passed.
        const targetReached = local.running && local.startedAt === remote.startedAt ? local.targetReached : Boolean(remote.targetMinutes && elapsedMs >= remote.targetMinutes * 60_000);
        useTimerStore.setState({ running: true, ...remote, targetReached });
      } else {
        useTimerStore.setState({ running: false, paused: false, startedAt: null, accumulatedMs: 0, targetReached: false });
      }
      applying = false;
    };

    async function claim(state: Local) {
      const result = await claimSharedTimer(snapshot(state)).catch(() => null);
      if (!result) return;
      claimed = true;
      if (!result.ok) {
        apply(result.active);
        toast("অন্য device-এ আগে থেকেই টাইমার চলছে — সেটাই দেখানো হচ্ছে", { description: result.active.label || undefined });
      }
    }

    async function pull() {
      if (stopped || document.visibilityState !== "visible") return;
      const remote = await getSharedTimer().catch(() => undefined);
      if (remote === undefined || stopped) return;
      const local = useTimerStore.getState();
      if (remote) {
        claimed = true;
        if (!same(local, remote)) apply(remote);
      } else if (local.running) {
        if (claimed) {
          claimed = false;
          apply(null);
          toast("অন্য device-এ টাইমার শেষ করা হয়েছে");
        } else {
          await claim(local);
        }
      }
    }

    const unsubscribe = useTimerStore.subscribe((next, prev) => {
      if (applying) return;
      if (!prev.running && next.running) void claim(next);
      else if (prev.running && !next.running) { claimed = false; void finishSharedTimer().catch(() => {}); }
      else if (next.running && (prev.paused !== next.paused || prev.startedAt !== next.startedAt || prev.accumulatedMs !== next.accumulatedMs)) void updateSharedTimer(snapshot(next)).catch(() => {});
    });

    void pull();
    const interval = window.setInterval(() => void pull(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void pull(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [hydrated]);

  return null;
}
