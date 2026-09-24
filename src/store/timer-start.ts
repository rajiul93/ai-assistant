import { create } from "zustand";

/** Where a timer start came from, plus what to pre-select in the "Which subject?" picker. */
export type TimerStartRequest = {
  suggestedSubjectId?: string;
  topicId?: string;
  minutes?: number | null;
  /** Runs after the timer has started with the chosen subject (e.g. recording today's plan). */
  onStarted?: (subjectId: string) => void | Promise<void>;
};

type TimerStartStore = {
  /** `id` changes on every open, so the picker resets to the new request's suggestion. */
  request: (TimerStartRequest & { id: number }) | null;
  open: (request: TimerStartRequest) => void;
  close: () => void;
};

let nextId = 1;

/**
 * Every study timer start goes through the subject picker, so each session is saved under a
 * subject. Open it from anywhere with `useTimerStartStore.getState().open({...})`.
 */
export const useTimerStartStore = create<TimerStartStore>((set) => ({
  request: null,
  open: (request) => set({ request: { ...request, id: nextId++ } }),
  close: () => set({ request: null }),
}));
