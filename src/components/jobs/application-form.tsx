"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JobApplication } from "@prisma/client";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sectorLabels, statusOptions } from "@/lib/applications";
import { dayjs } from "@/lib/dayjs";
import { jobApplicationSchema, type JobApplicationInput } from "@/lib/validations";
import { createApplication, updateApplication } from "@/server/actions/applications";

const toDay = (date: Date | null | undefined) => (date ? dayjs(date).format("YYYY-MM-DD") : "");

/** Chip list for the posts applied for: Enter or comma adds one, pasting a list adds them all. */
function PostsInput({ value, onChange }: { value: string[]; onChange: (posts: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (text: string) => {
    const fresh = text.split(/[,\n;]/).map((post) => post.trim()).filter(Boolean);
    if (fresh.length) onChange([...new Set([...value, ...fresh])]);
    setDraft("");
  };
  return <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 focus-within:border-zinc-400">
    {value.map((post) => <span key={post} className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-sm">
      {post}
      <button type="button" aria-label={`Remove ${post}`} onClick={() => onChange(value.filter((item) => item !== post))} className="rounded-full p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"><X className="size-3" /></button>
    </span>)}
    <input
      id="posts"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(draft); }
        if (event.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
      }}
      onPaste={(event) => { const text = event.clipboardData.getData("text"); if (/[,\n;]/.test(text)) { event.preventDefault(); add(text); } }}
      onBlur={() => add(draft)}
      placeholder={value.length ? "Add another post…" : "e.g. Officer (General), then Enter"}
      className="h-7 min-w-40 flex-1 bg-transparent px-1 text-sm outline-none"
    />
  </div>;
}

export function ApplicationForm({ application, onSuccess }: { application?: JobApplication | null; onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<JobApplicationInput>({
    resolver: zodResolver(jobApplicationSchema),
    defaultValues: {
      title: application?.title ?? "",
      organization: application?.organization ?? "",
      location: application?.location ?? "",
      posts: application?.posts ?? [],
      sector: application?.sector ?? "GOVERNMENT",
      status: application?.status ?? "APPLIED",
      appliedAt: application ? toDay(application.appliedAt) : dayjs().format("YYYY-MM-DD"),
      deadline: toDay(application?.deadline),
      examDate: toDay(application?.examDate),
      reference: application?.reference ?? "",
      link: application?.link ?? "",
      notes: application?.notes ?? "",
    },
  });
  const errors = form.formState.errors;
  const posts = useWatch({ control: form.control, name: "posts" }) ?? [];

  const mutation = useMutation({
    mutationFn: async (values: JobApplicationInput) => {
      if (application) await updateApplication(application.id, values);
      else await createApplication(values);
    },
    onSuccess: async () => {
      toast.success(application ? "Application updated" : "Application added");
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      onSuccess?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Job title</Label>
        <Input id="title" placeholder="e.g. Bangladesh Bank Officer recruitment 2026" {...form.register("title")} />
        {errors.title ? <p className="text-sm text-red-600">{errors.title.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="organization">Organization</Label>
        <Input id="organization" placeholder="e.g. Bangladesh Bank" {...form.register("organization")} />
        {errors.organization ? <p className="text-sm text-red-600">{errors.organization.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" placeholder="e.g. Dhaka / anywhere in Bangladesh" {...form.register("location")} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="posts">Posts applied for</Label>
        <PostsInput value={posts} onChange={(next) => form.setValue("posts", next, { shouldDirty: true })} />
        <p className="text-xs text-zinc-500">One circular can cover several posts — add each one you applied for.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sector">Sector</Label>
        <NativeSelect id="sector" {...form.register("sector")}>
          {Object.entries(sectorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <NativeSelect id="status" {...form.register("status")}>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="appliedAt">Applied on</Label>
        <Input id="appliedAt" type="date" {...form.register("appliedAt")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="deadline">Application deadline</Label>
        <Input id="deadline" type="date" {...form.register("deadline")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="examDate">Exam / interview date</Label>
        <Input id="examDate" type="date" {...form.register("examDate")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reference">User ID / roll / reference</Label>
        <Input id="reference" placeholder="e.g. User ID from the portal" {...form.register("reference")} />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor="link">Circular or portal link</Label>
      <Input id="link" type="url" placeholder="https://…" {...form.register("link")} />
      {errors.link ? <p className="text-sm text-red-600">{errors.link.message}</p> : null}
    </div>
    <div className="space-y-2">
      <Label htmlFor="notes">Notes</Label>
      <Textarea id="notes" placeholder="Fee paid, documents, syllabus…" {...form.register("notes")} />
    </div>
    <div className="flex justify-end">
      <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : application ? "Save changes" : "Add application"}</Button>
    </div>
  </form>;
}
