"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { QuillEditor } from "@/components/notes/quill-editor";
import { PickDialog } from "@/components/pick-dialog";
import { MathText } from "@/components/math-text";
import { listNotes } from "@/server/actions/notes";
import { FileText, Plus, X } from "lucide-react";
import { toEditorHtml } from "@/lib/note-html";
import { createTask, updateTask } from "@/server/actions/tasks";
import { taskSchema, type TaskInput } from "@/lib/validations";
import { dayjs } from "@/lib/dayjs";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";
import type { TaskWithRelations } from "@/server/queries";

type TopicOption = { id: string; name: string; subjectId: string; parentName?: string | null };
type SubjectOption = { id: string; name: string };

export function TaskForm({
  task,
  subjects,
  topics,
  onSuccess,
}: {
  task?: TaskWithRelations;
  subjects: SubjectOption[];
  topics: TopicOption[];
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: toEditorHtml(task?.description),
      noteIds: task?.notes.map((link) => link.note.id) ?? [],
      subjectId: task?.subjectId ?? "",
      topicId: task?.topicId ?? "",
      estimatedMinutes: task?.estimatedMinutes ?? 30,
      dueDate: task?.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DDTHH:mm") : "",
      priority: (task?.priority ?? "MEDIUM") as TaskPriority,
      status: (task?.status ?? "NOT_STARTED") as TaskStatus,
    },
  });

  // Quill is uncontrolled: bumping the key reloads it after the voice form or a reset changes the value.
  const [editorKey, setEditorKey] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  // Titles of attached notes, so chips show without loading every note.
  const [noteTitles, setNoteTitles] = useState<Record<string, string>>(() => Object.fromEntries(task?.notes.map((link) => [link.note.id, link.note.title]) ?? []));
  const noteIds = useWatch({ control: form.control, name: "noteIds" }) ?? [];
  const notesQuery = useQuery({ queryKey: ["notes"], queryFn: () => listNotes(), enabled: notesOpen });
  const setNoteIds = (ids: string[]) => form.setValue("noteIds", ids, { shouldDirty: true });

  const subjectId = useWatch({ control: form.control, name: "subjectId" });
  const filteredTopics = useMemo(
    () => topics.filter((topic) => !subjectId || topic.subjectId === subjectId),
    [topics, subjectId],
  );

  useEffect(() => {
    const current = form.getValues("topicId");
    if (current && !filteredTopics.some((topic) => topic.id === current)) {
      form.setValue("topicId", "");
    }
  }, [filteredTopics, form]);

  const mutation = useMutation({
    mutationFn: async (values: TaskInput) => {
      if (task) {
        await updateTask(task.id, values);
      } else {
        await createTask(values);
      }
    },
    onSuccess: async () => {
      toast.success(task ? "Task updated" : "Task created");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onSuccess?.();
      if (!task) { form.reset(); setEditorKey((key) => key + 1); }
      await queryClient.invalidateQueries({ queryKey: ["task-choices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <VoiceFormAssistant title="Task voice form" steps={[
        { key: "title", label: "Title", question: "কোন task তৈরি করতে চান?" },
        { key: "description", label: "Description", question: "Task-এর বিস্তারিত বলুন, না থাকলে বলুন skip" },
        { key: "estimatedMinutes", label: "Minutes", question: "কত মিনিট লাগবে?" },
        { key: "priority", label: "Priority", question: "Priority বলুন: low, medium অথবা high" },
      ]} onComplete={(answers) => {
        form.setValue("title", answers.title);
        form.setValue("description", answers.description === "skip" ? "" : toEditorHtml(answers.description));
        setEditorKey((key) => key + 1);
        const minutes = Number.parseInt(answers.estimatedMinutes.replace(/\D/g, ""), 10);
        if (minutes > 0) form.setValue("estimatedMinutes", minutes);
        const priority = answers.priority.toLowerCase();
        form.setValue("priority", priority.includes("high") || priority.includes("উচ্চ") ? "HIGH" : priority.includes("low") || priority.includes("কম") ? "LOW" : "MEDIUM");
      }} />
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register("title")} />
        {form.formState.errors.title && (
          <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <div className="task-editor">
          <QuillEditor
            key={editorKey}
            initialHtml={form.getValues("description") ?? ""}
            placeholder="কী পড়বে বা করবে — list, heading, code সব লেখা যাবে"
            onChange={(html, text) => form.setValue("description", text.trim() || html.includes("ql-formula") ? html : "", { shouldDirty: true })}
          />
        </div>
        {form.formState.errors.description ? <p className="text-sm text-red-600">{form.formState.errors.description.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {noteIds.map((id) => <span key={id} className="flex max-w-full items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700">
            <FileText className="size-3.5 shrink-0 text-zinc-500" />
            <span className="truncate"><MathText text={noteTitles[id] ?? "Note"} /></span>
            <button type="button" onClick={() => setNoteIds(noteIds.filter((item) => item !== id))} aria-label={`Remove “${noteTitles[id] ?? "note"}”`} className="flex size-6 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white hover:text-zinc-900"><X className="size-3.5" /></button>
          </span>)}
          <button type="button" onClick={() => setNotesOpen(true)} className="flex h-8 items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50">
            <Plus className="size-3.5" /> Note যোগ করো
          </button>
        </div>
        <PickDialog
          open={notesOpen}
          onOpenChange={setNotesOpen}
          title="এই task-এ কোন note লাগবে?"
          placeholder="Search notes"
          emptyText="এখনো কোনো note নেই — Notes পাতায় লিখে নাও।"
          loading={notesQuery.isPending}
          items={(notesQuery.data ?? []).map((note) => ({ id: note.id, title: note.title || "Untitled note", hint: note.subject ? `${note.subject.name}${note.topic ? ` › ${note.topic.name}` : ""}` : null }))}
          selectedIds={noteIds}
          onToggle={(item, selected) => {
            setNoteTitles((titles) => ({ ...titles, [item.id]: item.title }));
            setNoteIds(selected ? [...noteIds, item.id] : noteIds.filter((id) => id !== item.id));
          }}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="subjectId">Subject</Label>
          <NativeSelect id="subjectId" {...form.register("subjectId")}>
            <option value="">None</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="topicId">Topic</Label>
          <NativeSelect id="topicId" {...form.register("topicId")}>
            <option value="">None</option>
            {filteredTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.parentName ? `${topic.parentName} / ${topic.name}` : topic.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="estimatedMinutes">Estimated minutes</Label>
          <Input id="estimatedMinutes" type="number" min={1} {...form.register("estimatedMinutes")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" type="datetime-local" {...form.register("dueDate")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <NativeSelect id="priority" {...form.register("priority")}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" {...form.register("status")}>
            <option value="NOT_STARTED">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="FINISHED">Finished</option>
            <option value="REVISION">Revision</option>
          </NativeSelect>
        </div>
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : task ? "Save changes" : "Create task"}
      </Button>
    </form>
    </>
  );
}
