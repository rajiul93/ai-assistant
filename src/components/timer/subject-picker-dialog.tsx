"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, ListTodo, Play, Plus, Target, Timer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/select";
import { assistantStrings } from "@/lib/assistant-i18n";
import { formatDurationFromSeconds } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { listSubjectsForTimer } from "@/server/actions/list-subjects";
import { createSubject } from "@/server/actions/subjects";
import { useAssistantStore } from "@/store/assistant";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore, type TimerStartRequest } from "@/store/timer-start";
import { MathText } from "@/components/math-text";

/** The home page's pastel tones, one per subject in turn. */
const tones = ["bg-blue-50 text-blue-600", "bg-rose-50 text-rose-500", "bg-emerald-50 text-emerald-600", "bg-orange-50 text-orange-500", "bg-violet-50 text-violet-600", "bg-sky-50 text-sky-600", "bg-pink-50 text-pink-500", "bg-teal-50 text-teal-600", "bg-amber-50 text-amber-600", "bg-indigo-50 text-indigo-600"];

/** Mounted once in the app shell; every study timer start asks "Which subject?" here first. */
export function SubjectPickerDialog() {
  const request = useTimerStartStore((state) => state.request);
  const close = useTimerStartStore((state) => state.close);
  return <Dialog open={request !== null} onOpenChange={(open) => { if (!open) close(); }}>
    {/* Keyed per request so each opening starts from that request's suggestion. */}
    {request ? <PickerBody key={request.id} request={request} onDone={close} /> : null}
  </Dialog>;
}

function PickerBody({ request, onDone }: { request: TimerStartRequest; onDone: () => void }) {
  const t = assistantStrings[useAssistantStore((state) => state.lang)];
  const queryClient = useQueryClient();
  const subjectsQuery = useQuery({ queryKey: ["timer-subjects"], queryFn: () => listSubjectsForTimer() });
  const subjects = subjectsQuery.data ?? [];
  const [subjectId, setSubjectId] = useState(request.suggestedSubjectId ?? "");
  const [topicId, setTopicId] = useState(request.topicId ?? "");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [goal, setGoal] = useState<number | null>(request.minutes ?? null);
  const [addOpen, setAddOpen] = useState(false);

  const selected = subjects.find((subject) => subject.id === subjectId);
  const topics = selected?.topics ?? [];
  const validTopicId = topics.some((topic) => topic.id === topicId) ? topicId : "";

  async function addSubject() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await createSubject({ name });
      const fresh = await queryClient.fetchQuery({ queryKey: ["timer-subjects"], queryFn: () => listSubjectsForTimer(), staleTime: 0 });
      const created = fresh.find((subject) => subject.name.toLowerCase() === name.toLowerCase());
      if (created) setSubjectId(created.id);
      setNewName("");
      setAddOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add the subject");
    } finally {
      setAdding(false);
    }
  }

  async function start() {
    if (!selected) return;
    setStarting(true);
    const timer = useTimerStore.getState();
    if (!timer.running) {
      timer.setContext(selected.id, validTopicId);
      timer.setLabel(request.label || topics.find((topic) => topic.id === validTopicId)?.name || selected.name, request.taskId);
      timer.setTarget(goal);
      timer.start();
    }
    try {
      await request.onStarted?.(selected.id);
    } finally {
      setStarting(false);
      void queryClient.invalidateQueries({ queryKey: ["timer-subjects"] });
      onDone();
    }
  }

  const showAdd = addOpen || (!subjectsQuery.isPending && subjects.length === 0);

  return <DialogContent className="p-0 pb-0 pt-0 sm:max-w-md sm:rounded-3xl sm:p-0 sm:pb-0 sm:pt-0">
    <div className="px-5 pb-3 pt-7 sm:pt-6">
      <DialogHeader className="mb-0 flex flex-row items-center gap-3 space-y-0 pr-8">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#3f6ef3] to-[#7f9cfa] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]"><Timer className="size-5" /></span>
        <span className="min-w-0">
          <DialogTitle className="text-[17px] font-bold leading-tight">{t.pickerTitle}</DialogTitle>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{t.pickerSubtitle}</span>
        </span>
      </DialogHeader>
      {/* Started from a task: which one, so the choice of subject makes sense. */}
      {request.label ? <p className="mt-3 flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-[13px] font-medium text-blue-800"><ListTodo className="size-4 shrink-0" /><span className="truncate"><MathText text={request.label} /></span></p> : null}
    </div>

    {/* Two to a row, so most lists fit without scrolling; the last tile adds a subject. */}
    <div role="radiogroup" aria-label={t.pickerTitle} className="grid max-h-[38dvh] grid-cols-2 gap-2 overflow-y-auto px-5 pb-1 pt-0.5">
      {subjectsQuery.isPending ? [0, 1, 2, 3].map((key) => <div key={key} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100" />) : null}
      {subjects.map((subject, index) => {
        const active = subject.id === subjectId;
        return <button
          key={subject.id}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => setSubjectId(subject.id)}
          className={cn("relative flex min-w-0 items-center gap-2.5 rounded-2xl p-2.5 text-left transition active:scale-[0.98]", active ? "bg-blue-50 ring-2 ring-blue-600" : "bg-white ring-1 ring-slate-200 hover:ring-slate-300")}
        >
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold", tones[index % tones.length])}>{(subject.name.trim()[0] ?? "?").toUpperCase()}</span>
          <span className="min-w-0">
            <span className={cn("block truncate text-[14px] font-semibold", active ? "text-blue-800" : "text-slate-900")}><MathText text={subject.name} /></span>
            <span className="flex items-center gap-1 text-[11.5px] text-slate-500"><Clock className="size-3 shrink-0" /><span className="truncate">{t.pickerThisMonth(formatDurationFromSeconds(subject.monthSeconds))}</span></span>
          </span>
          {active ? <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white"><Check className="size-3" strokeWidth={3} /></span> : null}
        </button>;
      })}
      {!subjectsQuery.isPending ? showAdd
        ? <form className="col-span-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); void addSubject(); }}>
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t.pickerNewPlaceholder}
            maxLength={80}
            autoFocus={subjects.length > 0}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-[15px] outline-none focus:border-blue-300 focus:bg-white"
          />
          <button type="submit" disabled={adding || !newName.trim()} className="flex h-11 shrink-0 items-center gap-1 rounded-2xl bg-blue-50 px-3.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"><Plus className="size-4" /> {t.pickerAdd}</button>
        </form>
        : <button type="button" onClick={() => setAddOpen(true)} className="flex min-h-[3.75rem] items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 text-[13.5px] font-semibold text-slate-500 transition hover:border-blue-300 hover:text-blue-700"><Plus className="size-4" /> {t.pickerNewTile}</button>
        : null}
    </div>

    <div className="space-y-3 px-5 pt-3">
      {topics.length > 0 ? <NativeSelect aria-label={t.pickerTopic} value={validTopicId} onChange={(event) => setTopicId(event.target.value)} className="h-11 rounded-2xl border-slate-200 bg-slate-50">
        <option value="">{t.pickerNoTopic}</option>
        {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
      </NativeSelect> : null}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"><Target className="size-3.5" /> {t.pickerGoal}</p>
        <div role="radiogroup" aria-label={t.pickerGoal} className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
          {[null, 25, 50, 90].map((minutes) => <button
            key={minutes ?? "open"}
            type="button"
            role="radio"
            aria-checked={goal === minutes}
            onClick={() => setGoal(minutes)}
            className={cn("h-10 rounded-xl text-sm font-semibold transition", goal === minutes ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >{minutes ? `${minutes}m` : t.pickerNoGoal}</button>)}
        </div>
      </div>
    </div>

    {/* Stays in reach at the bottom of the sheet; says what will start. */}
    <div className="sticky bottom-0 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:pb-5">
      <button type="button" onClick={() => void start()} disabled={!selected || starting} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] px-4 text-[15px] font-semibold text-white shadow-[0_12px_26px_-12px_rgba(37,99,235,0.9)] transition active:scale-[0.99] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none">
        <Play className="size-4 shrink-0 fill-current" />
        <span className="truncate">{starting ? t.pickerStarting : selected ? <>{t.pickerStart} · <MathText text={selected.name} /></> : t.pickerChoose}</span>
      </button>
    </div>
  </DialogContent>;
}
