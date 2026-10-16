import { create } from "zustand";
import { useTimerStore } from "@/store/timer";

/** Where a timer start came from, plus what to pre-select in the "Which subject?" picker. */
export type TimerStartRequest = {
  suggestedSubjectId?: string;
  topicId?: string;
  minutes?: number | null;
  /** The goal choices to offer (minutes); default "no goal, 25, 50, 90". */
  goals?: Array<number | null>;
  /** Shown on the session bar instead of the subject name, e.g. the task title. */
  label?: string;
  taskId?: string;
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
/** Study goals offered when reading a Preliminary / Short Question set (owner, 2026-10-16). */
export const SET_STUDY_GOALS = [5, 10, 15, 30, 60];

/**
 * Reading a question set starts the timer: the picker opens with the set's subject and topic and
 * the short goals above (15 minutes picked). Nothing opens while a session is already running.
 */
export function startSetStudy(set: { subjectId: string | null; topicId: string | null; topicName: string }) {
  if (useTimerStore.getState().running) return;
  useTimerStartStore.getState().open({ suggestedSubjectId: set.subjectId ?? undefined, topicId: set.topicId ?? undefined, label: set.topicName, minutes: 15, goals: SET_STUDY_GOALS });
}

export const useTimerStartStore = create<TimerStartStore>((set) => ({
  request: null,
  open: (request) => set({ request: { ...request, id: nextId++ } }),
  close: () => set({ request: null }),
}));
