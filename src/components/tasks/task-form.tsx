"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
      description: task?.description ?? "",
      subjectId: task?.subjectId ?? "",
      topicId: task?.topicId ?? "",
      estimatedMinutes: task?.estimatedMinutes ?? 30,
      dueDate: task?.dueDate ? dayjs(task.dueDate).format("YYYY-MM-DDTHH:mm") : "",
      priority: (task?.priority ?? "MEDIUM") as TaskPriority,
      status: (task?.status ?? "NOT_STARTED") as TaskStatus,
    },
  });

  const subjectId = form.watch("subjectId");
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
      if (!task) form.reset();
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
        form.setValue("description", answers.description === "skip" ? "" : answers.description);
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
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...form.register("description")} />
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
