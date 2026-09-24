"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { completeRevision, createRevision, deleteRevision } from "@/server/actions/revisions";
import { formatDate } from "@/lib/dayjs";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";
import type { Revision, Subject, Topic } from "@prisma/client";

type RevisionRow = Revision & { topic: Topic; subject: Subject | null };

export function RevisionManager({
  revisions,
  topics,
}: {
  revisions: RevisionRow[];
  topics: { id: string; name: string; subjectName: string }[];
}) {
  const [topicId, setTopicId] = useState("");
  const [revisionDate, setRevisionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () => createRevision({ topicId, revisionDate, notes }),
    onSuccess: () => {
      toast.success("Revision scheduled");
      setNotes("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const complete = useMutation({
    mutationFn: completeRevision,
    onSuccess: () => toast.success("Revision completed"),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteRevision,
    onSuccess: () => toast.success("Revision removed"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <form
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="font-semibold">Schedule revision</h2>
        <VoiceFormAssistant title="Revision voice form" steps={[
          { key: "topic", label: "Topic", question: "কোন topic revise করবেন?" },
          { key: "date", label: "Date", question: "কোন তারিখে revision করবেন? YYYY-MM-DD format-এ বলুন" },
          { key: "notes", label: "Notes", question: "কোন note যোগ করবেন? না থাকলে skip বলুন" },
        ]} onComplete={(answers) => {
          const topic = topics.find((item) => item.name.toLowerCase() === answers.topic.toLowerCase() || ` `.toLowerCase().includes(answers.topic.toLowerCase()));
          if (topic) setTopicId(topic.id);
          setRevisionDate(answers.date);
          setNotes(answers.notes === "skip" ? "" : answers.notes);
        }} />
        <NativeSelect value={topicId} onChange={(event) => setTopicId(event.target.value)} required>
          <option value="">Select topic</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.subjectName} · {topic.name}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" value={revisionDate} onChange={(event) => setRevisionDate(event.target.value)} />
        <Textarea
          placeholder="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <Button type="submit" disabled={create.isPending || !topicId}>
          Add revision
        </Button>
      </form>

      {revisions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="font-medium">No revisions yet</p>
          <p className="mt-1 text-sm text-zinc-500">Mark topics you need to revisit.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {revisions.map((revision) => (
            <article key={revision.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{revision.topic.name}</p>
                  <p className="text-sm text-zinc-500">
                    {revision.subject?.name ?? "Subject"} · {formatDate(revision.revisionDate)} ·{" "}
                    {revision.status === "COMPLETED" ? "Completed" : "Pending"}
                  </p>
                  {revision.notes ? <p className="mt-1 text-sm text-zinc-600">{revision.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  {revision.status !== "COMPLETED" ? (
                    <Button size="sm" onClick={() => complete.mutate(revision.id)}>
                      Mark done
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => remove.mutate(revision.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
