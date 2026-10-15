"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useLive, type LiveEvent } from "@/components/collaboration/live-provider";
import type { SharedTimer } from "@/lib/shared-timer";
import { useTimerHydrated } from "@/lib/use-timer";
import { claimSharedTimer, finishSharedTimer, getSharedTimer, updateSharedTimer } from "@/server/actions/timer";
import { useTimerStore } from "@/store/timer";

type Local = ReturnType<typeof useTimerStore.getState>;

/** Without a socket this device asks every 10 s; with one, events arrive at once and this is a safety net. */
const POLL_MS = { polling: 10_000, live: 45_000 };

const SYNCED_KEY = "prep:timer-synced";

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
 * shows that one instead; pause, resume and stop are passed on; changes from the other device
 * arrive over socket.io at once (when the realtime server runs) and by polling otherwise.
 *
 * The rule that keeps a stopped timer from coming back: while this device's own change is still
 * being saved, and for any reading that started before it, what the server says is ignored —
 * otherwise a poll landing mid-save would put back the old "running" state.
 */
export function TimerSync() {
  const hydrated = useTimerHydrated();
  const { status, subscribe } = useLive();

  useEffect(() => {
    if (!hydrated) return;
    let applying = false;
    // A start on this page that never reached the server (offline): sent again on the next reading.
    // Otherwise the server decides — a timer this device still remembers as running but the server
    // doesn't have was stopped elsewhere (even while this device was closed), so it stops here too.
    let unsent = false;
    // A browser that never synced before (a timer started before sharing existed) sends its own,
    // once — on the first reading only.
    let legacy = (() => { try { return localStorage.getItem(SYNCED_KEY) !== "1"; } catch { return false; } })();
    let stopped = false;
    // Bumped by every local change; writes in flight are counted.
    let version = 0;
    let writing = 0;

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

    /** What the server says now, unless this device has changed something since (or is saving). */
    const accept = (remote: SharedTimer | null, askedAt: number) => {
      if (stopped || writing > 0 || askedAt !== version) return false;
      const local = useTimerStore.getState();
      if (remote) {
        if (!same(local, remote)) apply(remote);
      } else if (local.running) {
        if (unsent || legacy) {
          void write(() => claim(useTimerStore.getState()));
        } else {
          apply(null);
          toast("অন্য device-এ টাইমার বন্ধ করা হয়েছে");
        }
      }
      return true;
    };

    /** Runs a save to the server, counted so readings during it are ignored. */
    async function write(task: () => Promise<unknown>) {
      writing += 1;
      try { await task(); } catch { /* the next reading puts things right */ } finally { writing -= 1; }
    }

    async function claim(state: Local) {
      unsent = true;
      const result = await claimSharedTimer(snapshot(state));
      unsent = false;
      if (!result.ok) {
        apply(result.active);
        toast("অন্য device-এ আগে থেকেই টাইমার চলছে — সেটাই দেখানো হচ্ছে", { description: result.active.label || undefined });
      }
    }

    async function pull() {
      if (stopped || document.visibilityState !== "visible" || writing > 0) return;
      const askedAt = version;
      const remote = await getSharedTimer().catch(() => undefined);
      if (remote === undefined) return;
      if (accept(remote, askedAt) && legacy) {
        legacy = false;
        try { localStorage.setItem(SYNCED_KEY, "1"); } catch { /* fine */ }
      }
    }

    const unsubscribeStore = useTimerStore.subscribe((next, prev) => {
      if (applying) return;
      const started = !prev.running && next.running;
      const ended = prev.running && !next.running;
      const changed = next.running && (prev.paused !== next.paused || prev.startedAt !== next.startedAt || prev.accumulatedMs !== next.accumulatedMs);
      if (!started && !ended && !changed) return;
      version += 1;
      if (started) void write(() => claim(next));
      else if (ended) { unsent = false; void write(() => finishSharedTimer()); }
      else void write(() => updateSharedTimer(snapshot(next)));
    });

    // The other device changed the timer: the event carries the new state (null: stopped).
    const unsubscribeLive = subscribe((event: LiveEvent) => {
      if (event.type === "timer") accept(event.timer, version);
    });

    void pull();
    const interval = window.setInterval(() => void pull(), status === "live" ? POLL_MS.live : POLL_MS.polling);
    const onVisible = () => { if (document.visibilityState === "visible") void pull(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      unsubscribeStore();
      unsubscribeLive();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [hydrated, status, subscribe]);

  return null;
}
