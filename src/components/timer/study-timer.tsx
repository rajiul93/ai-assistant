"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatClock } from "@/lib/dayjs";
import { saveStudySession } from "@/server/actions/sessions";
import { useTimerStore } from "@/store/timer";

export function StudyTimer({
  subjects,
  topics,
}: {
  subjects: { id: string; name: string }[];
  topics: { id: string; name: string; subjectId: string }[];
}) {
  const timer = useTimerStore();
  const [elapsed, setElapsed] = useState(0);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(useTimerStore.getState().elapsedSeconds());
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const targetSeconds = timer.targetMinutes ? timer.targetMinutes * 60 : null;
  const remaining = targetSeconds === null ? null : Math.max(0, targetSeconds - elapsed);
  const goalOptions = [25, 50, 90, ...(timer.targetMinutes && ![25, 50, 90].includes(timer.targetMinutes) ? [timer.targetMinutes] : [])];

  const filteredTopics = topics.filter(
    (topic) => !timer.subjectId || topic.subjectId === timer.subjectId,
  );

  const stopMutation = useMutation({
    mutationFn: async () => {
      const seconds = Math.max(1, useTimerStore.getState().elapsedSeconds());
      const endedAt = new Date();
      const startedAt = sessionStart ?? new Date(endedAt.getTime() - seconds * 1000);
      await saveStudySession({
        subjectId: timer.subjectId,
        topicId: timer.topicId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds: seconds,
      });
    },
    onSuccess: () => {
      toast.success("Study session saved");
      timer.reset();
      setSessionStart(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Study timer</h1>
        <p className="mt-1 text-sm text-zinc-500">Start, pause, and save real study time.</p>
      </div>

      <Card className="space-y-6">
        <div>
          <p className="font-mono text-5xl tracking-tight tabular-nums sm:text-6xl">{formatClock(elapsed)}</p>
          {remaining !== null ? <div className="mt-4 max-w-md space-y-2">
            <p className={remaining === 0 ? "text-sm font-medium text-emerald-700" : "text-sm text-zinc-500"}>
              {remaining === 0 ? `✓ ${timer.targetMinutes}-minute goal reached` : `${formatClock(remaining)} left of your ${timer.targetMinutes}-minute goal`}
            </p>
            <Progress value={Math.min(100, (elapsed / (targetSeconds ?? 1)) * 100)} />
          </div> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NativeSelect
            value={timer.subjectId}
            onChange={(event) => timer.setContext(event.target.value, "")}
            disabled={timer.running}
          >
            <option value="">Subject (optional)</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={timer.topicId}
            onChange={(event) => timer.setContext(timer.subjectId, event.target.value)}
            disabled={timer.running}
          >
            <option value="">Topic (optional)</option>
            {filteredTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Session goal"
            value={timer.targetMinutes ?? ""}
            onChange={(event) => timer.setTarget(event.target.value ? Number(event.target.value) : null)}
            disabled={timer.running}
          >
            <option value="">No goal (open session)</option>
            {goalOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                Goal: {minutes} minutes
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap gap-2">
          {!timer.running ? (
            <Button
              onClick={() => {
                setSessionStart(new Date());
                timer.start();
              }}
            >
              Start study
            </Button>
          ) : (
            <>
              {timer.paused ? (
                <Button onClick={() => timer.resume()}>Resume</Button>
              ) : (
                <Button variant="secondary" onClick={() => timer.pause()}>
                  Pause
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                Stop and save
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
