"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTimerStore } from "@/store/timer";

/** True once the persisted timer has been restored, so we never flash a stale "not running" state. */
export function useTimerHydrated() {
  return useSyncExternalStore(
    (onChange) => useTimerStore.persist.onFinishHydration(onChange),
    () => useTimerStore.persist.hasHydrated(),
    () => false,
  );
}

/** Seconds on the running study timer, refreshed every second; 0 before the timer is restored. */
export function useLiveTimerSeconds() {
  const hydrated = useTimerHydrated();
  const running = useTimerStore((state) => state.running);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!hydrated || !running) return;
    const tick = () => setSeconds(useTimerStore.getState().elapsedSeconds());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hydrated, running]);
  return hydrated && running ? seconds : 0;
}
