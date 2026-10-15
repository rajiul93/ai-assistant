"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Check, ClipboardList, Loader2, X } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { DialogTitle } from "@/components/ui/dialog";
import { toEditorHtml } from "@/lib/note-html";
import { createTask, updateTask } from "@/server/actions/tasks";
import { taskSchema, type TaskInput } from "@/lib/validations";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";
import type { TaskWithRelations } from "@/server/queries";

type TopicOption = { id: string; name: string; subjectId: string; parentName?: string | null };
type SubjectOption = { id: string; name: string };

const PRIORITIES: Array<{ value: TaskPriority; label: string; dot: string; on: string }> = [
  { value: "LOW", label: "কম", dot: "bg-emerald-500", on: "bg-emerald-50 text-emerald-800 ring-emerald-300" },
  { value: "MEDIUM", label: "মাঝারি", dot: "bg-amber-500", on: "bg-amber-50 text-amber-800 ring-amber-300" },
  { value: "HIGH", label: "জরুরি", dot: "bg-red-500", on: "bg-red-50 text-red-700 ring-red-300" },
];

/** Quick due dates: the end of the study day (10 pm) today, tomorrow or in a week. */
const QUICK_DUE = [
  { label: "আজ", days: 0 },
  { label: "কাল", days: 1 },
  { label: "৭ দিন পর", days: 7 },
];
const dueAt = (days: number) => dayjs().add(days, "day").hour(22).minute(0).format("YYYY-MM-DDTHH:mm");

const chip = (active: boolean) => cn(
  "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-95",
  active ? "bg-blue-600 text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
);
// Phones: one sideways-scrolling row of chips, edge to edge inside the sheet; wider screens wrap.
const chipRow = "-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden";

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
  // Description, notes, minutes and status are no longer on the form (owner, 2026-10-15). They stay
  // in the form values, so editing a task saves them unchanged; a new task gets the defaults.
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

  const [subjectId, topicId, dueDate, priority] = useWatch({ control: form.control, name: ["subjectId", "topicId", "dueDate", "priority"] });
  const set = (key: "title" | "subjectId" | "topicId" | "dueDate" | "priority", value: string) => form.setValue(key, value as never, { shouldDirty: true });
  const filteredTopics = useMemo(() => topics.filter((topic) => topic.subjectId === subjectId), [topics, subjectId]);

  useEffect(() => {
    const current = form.getValues("topicId");
    if (current && !filteredTopics.some((topic) => topic.id === current)) form.setValue("topicId", "");
  }, [filteredTopics, form]);

  const mutation = useMutation({
    mutationFn: async (values: TaskInput) => {
      if (task) await updateTask(task.id, values);
      else await createTask(values);
    },
    onSuccess: async () => {
      toast.success(task ? "Task সেভ হলো" : "Task যোগ হলো");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onSuccess?.();
      if (!task) form.reset();
      await queryClient.invalidateQueries({ queryKey: ["task-choices"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const quickActive = QUICK_DUE.find((item) => dueDate === dueAt(item.days));
  const dueLabel = dueDate ? dayjs(dueDate).format("D MMM, h:mm A") : null;

  return (
    <form className="flex max-h-[inherit] flex-col" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <header className="flex items-center gap-3 px-5 pb-3 pt-7 sm:pt-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-[#3f6ef3] to-[#8fa6fb] text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]"><ClipboardList className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[17px] font-bold text-slate-900">{task ? "Task বদলাও" : "নতুন task"}</DialogTitle>
          <p className="text-xs text-slate-500">{task ? "যা বদলাতে চাও, বদলে সেভ করো" : "কী করবে, কবের মধ্যে — ব্যস"}</p>
        </div>
        <div className="mr-8 sm:mr-6">
          <VoiceFormAssistant compact title="Task voice form" steps={[
            { key: "title", label: "Title", question: "কোন task তৈরি করতে চান?" },
            { key: "priority", label: "Priority", question: "Priority বলুন: low, medium অথবা high" },
          ]} onComplete={(answers) => {
            set("title", answers.title);
            const said = answers.priority.toLowerCase();
            set("priority", said.includes("high") || said.includes("উচ্চ") || said.includes("জরুরি") ? "HIGH" : said.includes("low") || said.includes("কম") ? "LOW" : "MEDIUM");
          }} />
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4">
        <div>
          <input
            {...form.register("title")}
            placeholder="কী করবে? যেমন: বাংলা ব্যাকরণ — সন্ধি পড়া"
            aria-label="Task-এর নাম"
            autoComplete="off"
            className="h-13 w-full rounded-2xl bg-slate-100 px-4 text-[16px] font-semibold text-slate-900 outline-none ring-blue-500 transition placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-2"
          />
          {form.formState.errors.title ? <p className="mt-1.5 text-sm text-red-600">{form.formState.errors.title.message}</p> : null}
        </div>

        {subjects.length ? <section className="space-y-2">
          <h3 className="text-[13px] font-semibold text-slate-700">Subject</h3>
          <div className={chipRow} role="radiogroup" aria-label="Subject">
            <button type="button" role="radio" aria-checked={!subjectId} onClick={() => set("subjectId", "")} className={chip(!subjectId)}>কোনোটা না</button>
            {subjects.map((subject) => <button key={subject.id} type="button" role="radio" aria-checked={subjectId === subject.id} onClick={() => set("subjectId", subject.id)} className={chip(subjectId === subject.id)}>{subject.name}</button>)}
          </div>
          {/* Topics of the chosen subject appear under it. */}
          {filteredTopics.length ? <div className={cn(chipRow, "pt-0.5")} role="radiogroup" aria-label="Topic">
            <button type="button" role="radio" aria-checked={!topicId} onClick={() => set("topicId", "")} className={cn(chip(!topicId), "h-8 text-[12.5px]", !topicId && "bg-blue-100 text-blue-800 shadow-none")}>সব topic</button>
            {filteredTopics.map((topic) => <button key={topic.id} type="button" role="radio" aria-checked={topicId === topic.id} onClick={() => set("topicId", topic.id)} className={cn(chip(topicId === topic.id), "h-8 text-[12.5px]", topicId === topic.id && "bg-blue-100 text-blue-800 shadow-none")}>{topic.parentName ? `${topic.parentName} › ${topic.name}` : topic.name}</button>)}
          </div> : null}
        </section> : null}

        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold text-slate-700">কবের মধ্যে</h3>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_DUE.map((item) => <button key={item.days} type="button" onClick={() => set("dueDate", dueAt(item.days))} className={chip(quickActive === item)}>{item.label}</button>)}
            {dueDate ? <button type="button" onClick={() => set("dueDate", "")} aria-label="তারিখ মুছে দাও" className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-slate-500 hover:bg-slate-100"><X className="size-3.5" /> ছাড়া</button> : null}
          </div>
          <label className="flex h-11 items-center gap-2 rounded-2xl bg-slate-100 px-3.5 text-sm text-slate-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
            <CalendarClock className="size-4 shrink-0 text-blue-600" />
            <span className="shrink-0 text-[13px]">{dueLabel && !quickActive ? "বেছে নেওয়া:" : "অন্য দিন/সময়:"}</span>
            <input type="datetime-local" {...form.register("dueDate")} aria-label="Due date" className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-900 outline-none" />
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold text-slate-700">গুরুত্ব</h3>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((item) => <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={priority === item.value}
              onClick={() => set("priority", item.value)}
              className={cn("flex h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold ring-1 transition active:scale-95", priority === item.value ? item.on : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50")}
            ><span className={cn("size-2 rounded-full", item.dot)} />{item.label}</button>)}
          </div>
        </section>
      </div>

      {/* Stays at the bottom of the sheet, in reach of the thumb. */}
      <div className="border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:pb-5">
        <button type="submit" disabled={mutation.isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(37,99,235,0.9)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60">
          {mutation.isPending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" strokeWidth={2.5} />}
          {mutation.isPending ? "সেভ হচ্ছে…" : task ? "সেভ করো" : "Task যোগ করো"}
        </button>
      </div>
    </form>
  );
}
