import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type TimerStore = {
  running: boolean;
  paused: boolean;
  startedAt: number | null;
  accumulatedMs: number;
  subjectId: string;
  topicId: string;
  /** What the session bar shows: the task title, or the topic/subject name. */
  label: string;
  /** The task being studied, when the session was started from a task. */
  taskId: string;
  /** Optional study goal for this session, e.g. a 25-minute pomodoro. */
  targetMinutes: number | null;
  /** Set once the goal has been announced, so it is only announced once. */
  targetReached: boolean;
  setContext: (subjectId: string, topicId: string) => void;
  setLabel: (label: string, taskId?: string) => void;
  setTarget: (minutes: number | null) => void;
  markTargetReached: () => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  elapsedSeconds: () => number;
};

// Kept in localStorage so a running session survives a page refresh. Restoring only continues a
// timer the user already started — it never starts one. Rehydrated on the client by <TimerAlarm />.
export const useTimerStore = create<TimerStore>()(persist((set, get) => ({
  running: false,
  paused: false,
  startedAt: null,
  accumulatedMs: 0,
  subjectId: "",
  topicId: "",
  label: "",
  taskId: "",
  targetMinutes: null,
  targetReached: false,
  setContext: (subjectId, topicId) => set({ subjectId, topicId }),
  setLabel: (label, taskId = "") => set({ label, taskId }),
  setTarget: (targetMinutes) => set({ targetMinutes, targetReached: false }),
  markTargetReached: () => set({ targetReached: true }),
  start: () =>
    set({
      running: true,
      paused: false,
      startedAt: Date.now(),
      accumulatedMs: 0,
      targetReached: false,
    }),
  pause: () => {
    const { startedAt, accumulatedMs, running, paused } = get();
    if (!running || paused || !startedAt) return;
    set({
      paused: true,
      accumulatedMs: accumulatedMs + (Date.now() - startedAt),
      startedAt: null,
    });
  },
  resume: () => {
    const { running, paused } = get();
    if (!running || !paused) return;
    set({ paused: false, startedAt: Date.now() });
  },
  reset: () =>
    set({
      running: false,
      paused: false,
      startedAt: null,
      accumulatedMs: 0,
      targetReached: false,
    }),
  elapsedSeconds: () => {
    const { startedAt, accumulatedMs, running, paused } = get();
    const live = running && !paused && startedAt ? Date.now() - startedAt : 0;
    return Math.floor((accumulatedMs + live) / 1000);
  },
}), {
  name: "study-timer",
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: ({ running, paused, startedAt, accumulatedMs, subjectId, topicId, label, taskId, targetMinutes, targetReached }) =>
    ({ running, paused, startedAt, accumulatedMs, subjectId, topicId, label, taskId, targetMinutes, targetReached }),
}));
