"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApplicationStatus, JobApplication, JobSector } from "@prisma/client";
import { Building2, CalendarClock, ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
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
      && (!needle || [item.title, item.organization, item.location ?? "", item.reference ?? "", ...item.posts].some((text) => text.toLowerCase().includes(needle))));
  }, [applications, sector, status, search]);

  const soonLimit = todayMs + 14 * 86_400_000;
  const upcoming = applications.filter((item) => !closedStatuses.includes(item.status) && [item.deadline, item.examDate].some((date) => date && date.getTime() >= todayMs - 86_400_000 && date.getTime() <= soonLimit)).length;
  const tiles = [
    { label: "Total applications", value: applications.length },
    { label: "Government", value: applications.filter((item) => item.sector === "GOVERNMENT").length },
    { label: "Non-government", value: applications.filter((item) => item.sector === "NON_GOVERNMENT").length },
    { label: "Deadlines & exams in 14 days", value: upcoming },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job applications</h1>
        <p className="mt-1 text-sm text-zinc-500">Every government and non-government job you apply for, in one place.</p>
      </div>
      <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="size-4" /> Add application</Button>
    </div>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {tiles.map((tile) => <div key={tile.label} className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-xs text-zinc-500">{tile.label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</p>
      </div>)}
    </section>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div role="tablist" aria-label="Sector" className="flex rounded-xl bg-zinc-100 p-1">
        {(["ALL", "GOVERNMENT", "NON_GOVERNMENT"] as const).map((value) => <button
          key={value}
          type="button"
          role="tab"
          aria-selected={sector === value}
          onClick={() => setSector(value)}
          className={cn("flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition lg:flex-none", sector === value ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
        >{value === "ALL" ? "All" : sectorLabels[value]}</button>)}
      </div>
      <NativeSelect aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="lg:w-48">
        <option value="ALL">All statuses</option>
        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </NativeSelect>
      <Input aria-label="Search" placeholder="Search title, organization, post, roll…" value={search} onChange={(event) => setSearch(event.target.value)} className="lg:max-w-xs" />
    </div>

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
                className={cn("h-8 w-auto shrink-0 rounded-full border-0 px-3 text-xs font-semibold", option?.className)}
              >
                {statusOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </NativeSelect>
            </div>

            {dates.length || item.reference ? <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {dates.map((entry) => <div key={entry.label} className={cn("flex items-center gap-1", entry.urgent ? "font-medium text-amber-700" : "text-zinc-500")}>
                <CalendarClock className="size-3.5" />
                <dt>{entry.label}:</dt>
                <dd>{formatDate(entry.date)} ({relativeDay(entry.date, todayMs)})</dd>
              </div>)}
              {item.reference ? <div className="flex items-center gap-1 text-zinc-500"><dt>Ref:</dt><dd className="font-mono text-zinc-700">{item.reference}</dd></div> : null}
            </dl> : null}

            {item.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{item.notes}</p> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.link ? <a href={item.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"><ExternalLink className="size-3.5" /> Circular</a> : null}
              <button type="button" onClick={() => setEditing(item)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"><Pencil className="size-3.5" /> Edit</button>
              <button type="button" onClick={() => setDeleting(item)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-3.5" /> Delete</button>
            </div>
          </li>;
        })}
      </ul>
    )}

    <Dialog open={creating || editing !== null} onOpenChange={(value) => { if (!value) { setCreating(false); setEditing(null); } }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
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
