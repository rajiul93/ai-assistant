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
import { QuillEditor } from "@/components/notes/quill-editor";
import { toEditorHtml } from "@/lib/note-html";
import { sectorLabels, statusOptions } from "@/lib/applications";
import { ATTACHMENT_ACCEPT, isAllowedType, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { jobApplicationSchema, type JobApplicationInput } from "@/lib/validations";
import { createApplication, updateApplication } from "@/server/actions/applications";
import { errorMessage } from "@/lib/user-error";

const toDay = (date: Date | null | undefined) => (date ? dayjs(date).format("YYYY-MM-DD") : "");

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
  return <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 focus-within:border-zinc-400">
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
      placeholder={value.length ? "আরেকটি পদ…" : "যেমন: Officer (General), তারপর Enter"}
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
      notes: toEditorHtml(application?.notes),
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
      toast.success("File থেকে পূরণ হয়েছে — একবার দেখে নিয়ে সেভ করুন।");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't read that file."));
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
      toast.success(application ? "আবেদন আপডেট হয়েছে" : "আবেদন যোগ হয়েছে");
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      onSuccess?.();
    },
    onError: (error: Error) => toast.error(errorMessage(error)),
  });

  const sector = useWatch({ control: form.control, name: "sector" });
  const status = useWatch({ control: form.control, name: "status" });
  const pick = (name: "sector" | "status", value: string) => form.setValue(name, value as never, { shouldDirty: true });

  return <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    {/* The quickest way in: the applicant copy fills everything. */}
    <div>
      <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(event) => { void fillFromFile(event.target.files?.[0]); event.target.value = ""; }} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="flex w-full items-center gap-3 rounded-2xl bg-linear-to-br from-indigo-50 to-blue-50 px-3.5 py-3 text-left ring-1 ring-indigo-100 transition hover:from-indigo-100 disabled:opacity-60">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">{reading ? <Loader2 className="size-5 animate-spin" /> : <FileUp className="size-5" />}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-indigo-800">{reading ? "File পড়া হচ্ছে…" : "Applicant copy থেকে পূরণ করুন"}</span>
          <span className="block text-[11.5px] text-indigo-900/70">PDF বা ছবি দিন — AI সব ঘর পূরণ করবে, বাকিটা বিস্তারিত-এ যাবে</span>
        </span>
      </button>
    </div>

    <section className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="title">পদের নাম / বিজ্ঞপ্তি</Label>
        <Input id="title" placeholder="যেমন: বাংলাদেশ ব্যাংক Officer নিয়োগ ২০২৬" className="h-11" {...form.register("title")} />
        {errors.title ? <p className="text-xs text-red-600">পদের নাম দিন।</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="organization">প্রতিষ্ঠান</Label>
          <Input id="organization" placeholder="যেমন: বাংলাদেশ ব্যাংক" className="h-11" {...form.register("organization")} />
          {errors.organization ? <p className="text-xs text-red-600">প্রতিষ্ঠানের নাম দিন।</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">কোথায়</Label>
          <Input id="location" placeholder="যেমন: ঢাকা / সারা দেশ" className="h-11" {...form.register("location")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="posts">যে পদে আবেদন</Label>
        <PostsInput value={posts} onChange={(next) => form.setValue("posts", next, { shouldDirty: true })} />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">ধরন</span>
        <div role="radiogroup" aria-label="ধরন" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          {Object.entries(sectorLabels).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={sector === value} onClick={() => pick("sector", value)} className={cn("h-9 rounded-xl text-sm font-semibold transition", sector === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>{label}</button>)}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">অবস্থা</span>
        <div role="radiogroup" aria-label="অবস্থা" className="flex flex-wrap gap-1.5">
          {statusOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={status === option.value} onClick={() => pick("status", option.value)} className={cn("h-8 rounded-full px-3 text-[13px] font-semibold transition", status === option.value ? "bg-blue-600 text-white" : option.className)}>{option.label}</button>)}
        </div>
      </div>
    </section>

    <section className="grid grid-cols-3 gap-2">
      {([["appliedAt", "আবেদন"], ["deadline", "শেষ তারিখ"], ["examDate", "পরীক্ষা/ভাইভা"]] as const).map(([name, label]) => <div key={name} className="min-w-0 space-y-1.5">
        <Label htmlFor={name} className="text-xs">{label}</Label>
        <Input id={name} type="date" className="compact-date h-11 px-2" {...form.register(name)} />
      </div>)}
    </section>

    <fieldset className="space-y-2 rounded-2xl bg-slate-50 p-3">
      <legend className="sr-only">লগইন তথ্য</legend>
      <p className="text-xs font-semibold text-slate-500">লগইন তথ্য <span className="font-normal">(card-এ এক চাপে copy হবে)</span></p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input id="reference" aria-label="User ID" autoComplete="off" placeholder="User ID" className="h-11 bg-white font-mono" {...form.register("reference")} />
        <Input id="roll" aria-label="Roll" autoComplete="off" placeholder="Roll" className="h-11 bg-white font-mono" {...form.register("roll")} />
        <div className="relative">
          <Input id="password" aria-label="Password" type={showPassword ? "text" : "password"} autoComplete="off" placeholder="Password" className="h-11 bg-white pr-10 font-mono" {...form.register("password")} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Password লুকান" : "Password দেখুন"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500 hover:text-zinc-900">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
    </fieldset>

    <div className="space-y-1.5">
      <Label htmlFor="link">Circular বা portal link</Label>
      <Input id="link" type="url" inputMode="url" placeholder="https://…" className="h-11" {...form.register("link")} />
      {errors.link ? <p className="text-xs text-red-600">পুরো link দিন, যেমন https://…</p> : null}
    </div>
    <div className="space-y-1.5">
      <Label>বিস্তারিত</Label>
      <QuillEditor
        key={editorKey}
        initialHtml={form.getValues("notes") ?? ""}
        placeholder="বাকি সব: ব্যক্তিগত তথ্য, শিক্ষা, fee দেওয়ার ধাপ, কাগজপত্র…"
        onChange={(html, text) => form.setValue("notes", text.trim() || html.includes("ql-formula") ? html : "", { shouldDirty: true })}
      />
    </div>

    {/* Stays at the bottom of the sheet while the form scrolls. */}
    <div className="sticky bottom-0 -mx-6 border-t border-slate-100 bg-white/95 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:pb-4">
      <Button type="submit" disabled={mutation.isPending} className="h-12 w-full rounded-2xl text-[15px] font-bold">{mutation.isPending ? "সেভ হচ্ছে…" : application ? "পরিবর্তন সেভ করুন" : "আবেদন যোগ করুন"}</Button>
    </div>
  </form>;
}
