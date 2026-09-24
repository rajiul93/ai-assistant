"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createSubject, createTopic, deleteSubject, deleteTopic } from "@/server/actions/subjects";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";

type TopicTree = {
  id: string;
  name: string;
  parentId: string | null;
  children: TopicTree[];
};

function TopicList({
  topics,
  subjectId,
  parentId,
}: {
  topics: TopicTree[];
  subjectId: string;
  parentId?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TopicTree | null>(null);

  const create = useMutation({
    mutationFn: () => createTopic({ name, subjectId, parentId: parentId ?? "" }),
    onSuccess: () => {
      toast.success("Topic added");
      setName("");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteTopic,
    onSuccess: () => {
      toast.success("Topic deleted");
      setPendingDelete(null);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const roots = topics.filter((topic) => (topic.parentId ?? null) === (parentId ?? null));

  return (
    <div className="space-y-3">
      <VoiceFormAssistant title="Topic voice form" steps={[{ key: "name", label: "Topic", question: parentId ? "Nested topic-এর নাম বলুন" : "Topic-এর নাম বলুন" }]} onComplete={(answers) => setName(answers.name)} />
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={parentId ? "Add nested topic" : "Add topic"}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => name.trim() && create.mutate()}
          disabled={create.isPending}
        >
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {roots.map((topic) => (
          <li key={topic.id} className="rounded-md border border-zinc-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{topic.name}</p>
              <Button variant="ghost" size="sm" onClick={() => setPendingDelete(topic)}>
                Delete
              </Button>
            </div>
            <div className="mt-3 pl-3">
              <TopicList topics={topic.children} subjectId={subjectId} parentId={topic.id} />
            </div>
          </li>
        ))}
      </ul>
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete topic?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes nested topics as well.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SubjectManager({
  subjects,
}: {
  subjects: Array<{ id: string; name: string; topics: TopicTree[] }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const create = useMutation({
    mutationFn: () => createSubject({ name }),
    onSuccess: () => {
      toast.success("Subject created");
      setName("");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      toast.success("Subject deleted");
      setPendingDelete(null);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <VoiceFormAssistant title="Subject voice form" steps={[{ key: "name", label: "Subject", question: "কোন subject যোগ করতে চান?" }]} onComplete={(answers) => setName(answers.name)} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New subject, e.g. English"
        />
        <Button onClick={() => name.trim() && create.mutate()} disabled={create.isPending}>
          Add subject
        </Button>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="font-medium">No subjects yet</p>
          <p className="mt-1 text-sm text-zinc-500">Add English, Math, or any subject you are preparing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subjects.map((subject) => (
            <section key={subject.id} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{subject.name}</h2>
                <Button variant="outline" size="sm" onClick={() => setPendingDelete(subject)}>
                  Delete
                </Button>
              </div>
              <TopicList
                topics={subject.topics.filter((topic) => !topic.parentId)}
                subjectId={subject.id}
              />
            </section>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete subject?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes its topics as well.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
