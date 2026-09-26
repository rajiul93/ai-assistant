"use client";

import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JobApplication } from "@prisma/client";
import { Eye, EyeOff, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { QuillEditor } from "@/components/notes/quill-editor";
import { sectorLabels, statusOptions } from "@/lib/applications";
import { ATTACHMENT_ACCEPT, isAllowedType, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { dayjs } from "@/lib/dayjs";
import { jobApplicationSchema, type JobApplicationInput } from "@/lib/validations";
import { createApplication, updateApplication } from "@/server/actions/applications";

const toDay = (date: Date | null | undefined) => (date ? dayjs(date).format("YYYY-MM-DD") : "");

/** Older notes are plain text; Quill needs HTML. */
function notesForEditor(notes: string | null | undefined) {
  if (!notes) return "";
  if (/<(p|h[1-6]|ul|ol|li)\b/i.test(notes)) return notes;
  return notes.split("\n").map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;") || "<br>"}</p>`).join("");
}

type Extracted = Partial<JobApplicationInput> & { sector?: JobApplicationInput["sector"] | null; status?: JobApplicationInput["status"] | null };

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
      <button type="button" aria-label={`Remove ${post}`} onClick={() => onChange(value.filter((item) => item !== post))} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 sm:p-0.5"><X className="size-3" /></button>
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
      roll: application?.roll ?? "",
      password: application?.password ?? "",
      link: application?.link ?? "",
      notes: notesForEditor(application?.notes),
    },
  });
  // Quill reads its HTML once on mount; bumping the key loads text filled in from a file.
  const [editorKey, setEditorKey] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Sends an applicant's copy to the AI and fills every field it could read. Empty results keep what's typed. */
  async function fillFromFile(file: File | undefined) {
    if (!file) return;
    const type = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (!isAllowedType(type)) { toast.error("Only a PDF or an image (JPG, PNG, WebP) can be read."); return; }
    if (file.size > MAX_ATTACHMENT_BYTES) { toast.error("The file must be 10MB or smaller."); return; }
    setReading(true);
    try {
      const response = await fetch("/api/applications/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: type, data: await readBase64(file) }),
      });
      const result = (await response.json().catch(() => ({}))) as Extracted & { error?: string };
      if (!response.ok) throw new Error(result.error || "Couldn't read that file.");
      const current = form.getValues();
      const pick = <T,>(value: T | null | undefined, fallback: T) => (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length) ? fallback : value);
      form.reset({
        ...current,
        title: pick(result.title, current.title),
        organization: pick(result.organization, current.organization),
        location: pick(result.location, current.location),
        posts: pick(result.posts, current.posts),
        sector: pick(result.sector, current.sector),
        status: pick(result.status, current.status),
        appliedAt: pick(result.appliedAt, current.appliedAt),
        deadline: pick(result.deadline, current.deadline),
        examDate: pick(result.examDate, current.examDate),
        reference: pick(result.reference, current.reference),
        roll: pick(result.roll, current.roll),
        password: pick(result.password, current.password),
        link: pick(result.link, current.link),
        notes: pick(result.notes, current.notes),
      }, { keepDefaultValues: true });
      setEditorKey((key) => key + 1);
      toast.success("Filled in from the file — check it, then save.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }
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
    <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-3">
      <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(event) => { void fillFromFile(event.target.files?.[0]); event.target.value = ""; }} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-100 transition hover:bg-indigo-50 disabled:opacity-60">
        {reading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
        {reading ? "Reading the file…" : "Fill from applicant copy (PDF / image)"}
      </button>
      <p className="mt-1.5 text-center text-[11px] text-indigo-900/70">AI reads it and fills the fields below; everything else goes into Details.</p>
    </div>
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
    </div>
    <fieldset className="grid gap-4 rounded-xl border border-zinc-200 p-3 sm:grid-cols-3">
      <legend className="px-1 text-xs font-medium text-zinc-500">Login & roll</legend>
      <div className="space-y-2">
        <Label htmlFor="reference">User ID</Label>
        <Input id="reference" autoComplete="off" placeholder="Portal user ID" className="font-mono" {...form.register("reference")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="roll">Roll</Label>
        <Input id="roll" autoComplete="off" placeholder="Roll number" className="font-mono" {...form.register("roll")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="off" placeholder="Portal password" className="pr-10 font-mono" {...form.register("password")} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500 hover:text-zinc-900">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
    </fieldset>
    <div className="space-y-2">
      <Label htmlFor="link">Circular or portal link</Label>
      <Input id="link" type="url" placeholder="https://…" {...form.register("link")} />
      {errors.link ? <p className="text-sm text-red-600">{errors.link.message}</p> : null}
    </div>
    <div className="space-y-2">
      <Label>Details</Label>
      <QuillEditor
        key={editorKey}
        initialHtml={form.getValues("notes") ?? ""}
        placeholder="Everything else: personal info, education, fee payment steps, documents…"
        onChange={(html, text) => form.setValue("notes", text.trim() ? html : "", { shouldDirty: true })}
      />
    </div>
    <div className="flex justify-end">
      <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : application ? "Save changes" : "Add application"}</Button>
    </div>
  </form>;
}
