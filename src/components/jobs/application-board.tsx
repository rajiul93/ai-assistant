"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApplicationStatus, JobApplication, JobSector } from "@prisma/client";
import { Building2, CalendarClock, Check, ChevronDown, Copy, ExternalLink, ListFilter, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import "quill/dist/quill.snow.css";
import { toast } from "sonner";
import { ApplicationForm } from "@/components/jobs/application-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { closedStatuses, sectorLabels, statusLabels, statusOptions } from "@/lib/applications";
import { APP_TIMEZONE, dayjs, formatDate } from "@/lib/dayjs";
import { sanitizeNoteHtml } from "@/lib/note-html";
import { cn } from "@/lib/utils";
import { deleteApplication, listMyApplications, updateApplicationStatus } from "@/server/actions/applications";

type SectorFilter = "ALL" | JobSector;

/** "in 3 days", "today", "5 days ago" — relative to today in the app timezone. */
function relativeDay(date: Date, todayMs: number) {
  const days = dayjs(date).tz(APP_TIMEZONE).startOf("day").diff(dayjs(todayMs).tz(APP_TIMEZONE).startOf("day"), "day");
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** One login detail with a copy button, e.g. "User ID  V2MTKDYZ  ⧉". */
function Credential({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Couldn't copy — select the text instead."); }
  };
  return <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-zinc-50 py-1 pl-2.5 pr-1 ring-1 ring-zinc-100">
    <dt className="shrink-0 text-[11px] text-zinc-500">{label}</dt>
    <dd className="min-w-0 truncate font-mono text-sm font-medium text-zinc-900 select-all">{value}</dd>
    <button type="button" onClick={() => void copy()} aria-label={`Copy ${label}`} title={`Copy ${label}`} className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white hover:text-zinc-900">
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </button>
  </div>;
}

/** The application's details (Quill HTML, or plain text from before), folded away until opened. */
function Details({ notes }: { notes: string }) {
  const [open, setOpen] = useState(false);
  const html = /<(p|h[1-6]|ul|ol|li)\b/i.test(notes);
  return <div className="mt-3 rounded-xl border border-zinc-100">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-50">
      Details
      <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
    </button>
    {open ? html
      // Sanitized again on display: only text-formatting tags and safe links remain.
      ? <div className="ql-snow border-t border-zinc-100"><div className="ql-editor application-details" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(notes) }} /></div>
      : <p className="whitespace-pre-wrap border-t border-zinc-100 px-3 py-2 text-sm text-zinc-600">{notes}</p>
      : null}
  </div>;
}

export function ApplicationBoard({ initialApplications }: { initialApplications: JobApplication[] }) {
  const [todayMs] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["applications"], queryFn: () => listMyApplications(), initialData: initialApplications });
  const applications = query.data;
  const [sector, setSector] = useState<SectorFilter>("ALL");
  const [status, setStatus] = useState<"ALL" | ApplicationStatus>("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<JobApplication | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["applications"] });
  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ApplicationStatus }) => updateApplicationStatus(id, next),
    onSuccess: async (_, { next }) => { toast.success(`Marked as ${statusLabels[next]}`); await refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: async () => { toast.success("Application deleted"); setDeleting(null); await refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return applications.filter((item) =>
      (sector === "ALL" || item.sector === sector)
      && (status === "ALL" || item.status === status)
      && (!needle || [item.title, item.organization, item.location ?? "", item.reference ?? "", item.roll ?? "", ...item.posts].some((text) => text.toLowerCase().includes(needle))));
  }, [applications, sector, status, search]);

  const soonLimit = todayMs + 14 * 86_400_000;
  const upcoming = applications.filter((item) => !closedStatuses.includes(item.status) && [item.deadline, item.examDate].some((date) => date && date.getTime() >= todayMs - 86_400_000 && date.getTime() <= soonLimit)).length;
  const tiles = [
    { label: "Total applications", value: applications.length },
    { label: "Government", value: applications.filter((item) => item.sector === "GOVERNMENT").length },
    { label: "Non-government", value: applications.filter((item) => item.sector === "NON_GOVERNMENT").length },
    { label: "Deadlines & exams in 14 days", value: upcoming },
  ];

  const sectorTabs = [
    { value: "ALL" as const, label: "All", short: "All", count: tiles[0].value },
    { value: "GOVERNMENT" as const, label: sectorLabels.GOVERNMENT, short: "Govt", count: tiles[1].value },
    { value: "NON_GOVERNMENT" as const, label: sectorLabels.NON_GOVERNMENT, short: "Private", count: tiles[2].value },
  ];

  return <div className="space-y-3 sm:space-y-5">
    {/* Phones: the sector tabs carry the counts, so the title, blurb and number tiles only show from sm up. */}
    <div className="sr-only sm:not-sr-only">
      <h1 className="text-2xl font-semibold tracking-tight">Job applications</h1>
      <p className="mt-1 text-sm text-zinc-500">Every government and non-government job you apply for, in one place.</p>
    </div>

    <section className="hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-4">
      {tiles.map((tile) => <div key={tile.label} className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-xs text-zinc-500">{tile.label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</p>
      </div>)}
    </section>

    <div className="flex items-center gap-2">
      <div role="tablist" aria-label="Sector" className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 lg:flex lg:flex-none">
        {sectorTabs.map((tab) => <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={sector === tab.value}
          onClick={() => setSector(tab.value)}
          className={cn("flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-sm font-medium transition sm:gap-1.5 lg:px-3", sector === tab.value ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
        >
          <span className="truncate sm:hidden">{tab.short}</span>
          <span className="hidden truncate sm:inline">{tab.label}</span>
          <span className={cn("text-xs tabular-nums", sector === tab.value ? "text-zinc-500" : "text-zinc-400")}>{tab.count}</span>
        </button>)}
      </div>
      <Button onClick={() => setCreating(true)} className="h-11 shrink-0 gap-1.5 px-3.5 lg:ml-auto"><Plus className="size-4" /> Add<span className="hidden sm:inline"> application</span></Button>
    </div>

    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <Input aria-label="Search" placeholder="Search title, organization, post, ID…" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9" />
      </div>
      {/* Phones: a filter button (the invisible select on top opens the native picker); sm+: a labelled select. */}
      <label className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-md border bg-white sm:size-auto sm:border-0 sm:bg-transparent", status === "ALL" ? "border-zinc-200" : "border-zinc-950")} title="Filter by status">
        <span className="sr-only">Status</span>
        <ListFilter className={cn("pointer-events-none size-4 sm:absolute sm:left-3", status === "ALL" ? "text-zinc-600" : "text-zinc-950")} aria-hidden />
        {status !== "ALL" ? <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 sm:hidden" aria-hidden /> : null}
        <NativeSelect aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="absolute inset-0 h-11 w-11 cursor-pointer opacity-0 sm:static sm:w-48 sm:pl-9 sm:opacity-100">
          <option value="ALL">All statuses</option>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </NativeSelect>
      </label>
    </div>

    {upcoming || status !== "ALL" ? <div className="flex flex-wrap items-center gap-2 text-xs sm:hidden">
      {upcoming ? <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-amber-100"><CalendarClock className="size-3.5" /> {upcoming} deadline{upcoming === 1 ? "" : "s"} / exam{upcoming === 1 ? "" : "s"} in 14 days</span> : null}
      {status !== "ALL" ? <button type="button" onClick={() => setStatus("ALL")} className="flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 font-medium text-white">{statusLabels[status]} ✕</button> : null}
    </div> : null}

    {visible.length === 0 ? (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
        {applications.length === 0 ? <>No applications yet. Add one here, or tell the assistant — e.g. “আজ বাংলাদেশ ব্যাংকের Officer পদে apply করেছি”.</> : "No applications match these filters."}
      </div>
    ) : (
      <ul className="space-y-3">
        {visible.map((item) => {
          const option = statusOptions.find((entry) => entry.value === item.status);
          const open = !closedStatuses.includes(item.status);
          const dates = [
            item.appliedAt && { label: "Applied", date: item.appliedAt, urgent: false },
            item.deadline && { label: "Deadline", date: item.deadline, urgent: open && item.status === "WISHLIST" && item.deadline.getTime() - todayMs < 3 * 86_400_000 },
            item.examDate && { label: "Exam/interview", date: item.examDate, urgent: open && item.examDate.getTime() - todayMs < 7 * 86_400_000 && item.examDate.getTime() >= todayMs - 86_400_000 },
          ].filter(Boolean) as Array<{ label: string; date: Date; urgent: boolean }>;
          return <li key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold leading-snug">{item.title}</h2>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", item.sector === "GOVERNMENT" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700")}>{sectorLabels[item.sector]}</span>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
                  <span className="flex items-center gap-1"><Building2 className="size-3.5" /> {item.organization}</span>
                  {item.location ? <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {item.location}</span> : null}
                </p>
                {item.posts.length ? <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.posts.map((post) => <span key={post} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{post}</span>)}
                </div> : null}
              </div>
              <NativeSelect
                aria-label={`Status of ${item.title}`}
                value={item.status}
                onChange={(event) => statusMutation.mutate({ id: item.id, next: event.target.value as ApplicationStatus })}
                className={cn("h-9 w-auto shrink-0 self-start rounded-full border-0 pl-3 pr-8 text-xs font-semibold sm:h-8", option?.className)}
              >
                {statusOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </NativeSelect>
            </div>

            {dates.length ? <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {dates.map((entry) => <div key={entry.label} className={cn("flex items-center gap-1", entry.urgent ? "font-medium text-amber-700" : "text-zinc-500")}>
                <CalendarClock className="size-3.5" />
                <dt>{entry.label}:</dt>
                <dd>{formatDate(entry.date)} ({relativeDay(entry.date, todayMs)})</dd>
              </div>)}
            </dl> : null}

            {item.reference || item.roll || item.password ? <dl className="mt-3 grid gap-1.5 sm:grid-cols-3">
              {item.reference ? <Credential label="User ID" value={item.reference} /> : null}
              {item.roll ? <Credential label="Roll" value={item.roll} /> : null}
              {item.password ? <Credential label="Password" value={item.password} /> : null}
            </dl> : null}

            {item.notes ? <Details notes={item.notes} /> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.link ? <a href={item.link} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-medium sm:min-h-0 sm:px-2 sm:py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"><ExternalLink className="size-3.5" /> Circular</a> : null}
              <button type="button" onClick={() => setEditing(item)} className="flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-medium sm:min-h-0 sm:px-2 sm:py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"><Pencil className="size-3.5" /> Edit</button>
              <button type="button" onClick={() => setDeleting(item)} className="flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-medium sm:min-h-0 sm:px-2 sm:py-1 text-zinc-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-3.5" /> Delete</button>
            </div>
          </li>;
        })}
      </ul>
    )}

    <Dialog open={creating || editing !== null} onOpenChange={(value) => { if (!value) { setCreating(false); setEditing(null); } }}>
      <DialogContent className="sm:max-h-[90dvh] sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit application" : "Add application"}</DialogTitle></DialogHeader>
        <ApplicationForm key={editing?.id ?? "new"} application={editing} onSuccess={() => { setCreating(false); setEditing(null); }} />
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleting !== null} onOpenChange={(value) => { if (!value) setDeleting(null); }}>
      <AlertDialogContent>
        <div className="space-y-1">
          <AlertDialogTitle>Delete this application?</AlertDialogTitle>
          <AlertDialogDescription>“{deleting?.title}” at {deleting?.organization} will be removed permanently.</AlertDialogDescription>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
