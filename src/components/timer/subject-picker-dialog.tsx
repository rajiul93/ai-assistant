"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Play, Plus } from "lucide-react";
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

  return <DialogContent className="p-0 sm:max-w-md sm:rounded-2xl sm:p-0">
    <div className="p-6 pb-4">
      <DialogHeader className="mb-0">
        <DialogTitle className="pr-6">{t.pickerTitle}</DialogTitle>
        <p className="text-sm text-zinc-500">{t.pickerSubtitle}</p>
      </DialogHeader>
    </div>

    <div role="radiogroup" aria-label={t.pickerTitle} className="max-h-72 space-y-2 overflow-y-auto px-6">
      {subjectsQuery.isPending ? [0, 1, 2].map((key) => <div key={key} className="h-14 animate-pulse rounded-xl bg-zinc-100" />) : null}
      {!subjectsQuery.isPending && subjects.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">{t.pickerEmpty}</p> : null}
      {subjects.map((subject) => {
        const active = subject.id === subjectId;
        return <button
          key={subject.id}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => setSubjectId(subject.id)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition",
            active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{subject.name}</span>
            <span className={cn("block text-xs", active ? "text-white/60" : "text-zinc-500")}>{t.pickerThisMonth(formatDurationFromSeconds(subject.monthSeconds))}</span>
          </span>
          {active ? <Check className="size-4 shrink-0" /> : null}
        </button>;
      })}
    </div>

    <div className="space-y-3 px-6 pt-3">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void addSubject(); }}>
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={t.pickerNewPlaceholder}
          maxLength={80}
          className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
        />
        <button type="submit" disabled={adding || !newName.trim()} className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40"><Plus className="size-4" /> {t.pickerAdd}</button>
      </form>
      <div role="radiogroup" aria-label={t.pickerGoal} className="flex items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-zinc-500">{t.pickerGoal}</span>
        {[null, 25, 50, 90].map((minutes) => <button
          key={minutes ?? "open"}
          type="button"
          role="radio"
          aria-checked={goal === minutes}
          onClick={() => setGoal(minutes)}
          className={cn("h-10 flex-1 rounded-lg border text-sm font-medium transition sm:h-8", goal === minutes ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50")}
        >{minutes ? `${minutes}m` : t.pickerNoGoal}</button>)}
      </div>
      {topics.length > 0 ? <NativeSelect aria-label={t.pickerTopic} value={validTopicId} onChange={(event) => setTopicId(event.target.value)}>
        <option value="">{t.pickerNoTopic}</option>
        {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
      </NativeSelect> : null}
    </div>

    <div className="flex justify-end gap-2 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 sm:pb-6">
      <button type="button" onClick={onDone} className="h-10 rounded-xl px-4 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100">{t.cancel}</button>
      <button type="button" onClick={() => void start()} disabled={!selected || starting} className="flex h-10 items-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400">
        <Play className="size-4" /> {starting ? t.pickerStarting : t.pickerStart}
      </button>
    </div>
  </DialogContent>;
}
