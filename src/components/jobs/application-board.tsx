"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApplicationStatus, JobApplication, JobSector } from "@prisma/client";
import { BriefcaseBusiness, Building2, CalendarClock, Check, ChevronDown, Copy, ExternalLink, Eye, EyeOff, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { closedStatuses, sectorLabels, statusLabels, statusOptions } from "@/lib/applications";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import { RichHtml, MathText } from "@/components/math-text";
import { cn } from "@/lib/utils";
import { deleteApplication, listMyApplications, updateApplicationStatus } from "@/server/actions/applications";

type SectorFilter = "ALL" | JobSector;
type StatusFilter = "ALL" | ApplicationStatus;

const DAY = 86_400_000;
const card = "rounded-3xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]";

/** Days from today to `date`, in the app timezone (0 = today, negative = past). */
const daysFrom = (date: Date, todayMs: number) => dayjs(date).tz(APP_TIMEZONE).startOf("day").diff(dayjs(todayMs).tz(APP_TIMEZONE).startOf("day"), "day");

/** "আজ", "আগামীকাল", "5 দিন পর", "3 দিন আগে". */
function relativeDay(days: number) {
  if (days === 0) return "আজ";
  if (days === 1) return "আগামীকাল";
  if (days === -1) return "গতকাল";
  return days > 0 ? `${days} দিন পর` : `${-days} দিন আগে`;
}

/** One login detail as a tap-to-copy chip; the password stays hidden until the eye is tapped. */
function Credential({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Copy হয়নি — লেখাটা select করে নিন।"); }
  };
  return <div className="flex h-9 min-w-0 items-center rounded-xl bg-slate-50 pl-2.5 ring-1 ring-slate-100">
    <dt className="shrink-0 text-[11px] text-slate-500">{label}</dt>
    <dd className="ml-1.5 min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-slate-900 select-all">{shown ? value : "••••••"}</dd>
    {secret ? <button type="button" onClick={() => setShown((value) => !value)} aria-label={shown ? "Password লুকান" : "Password দেখুন"} className="flex size-9 shrink-0 items-center justify-center text-slate-400 hover:text-slate-800">
      {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </button> : null}
    <button type="button" onClick={() => void copy()} aria-label={`${label} copy`} title={`${label} copy`} className="flex size-9 shrink-0 items-center justify-center text-slate-400 hover:text-slate-800">
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </button>
  </div>;
}

/** One application as a compact card: status edge, the dates that matter, login details, actions. */
function ApplicationCard({ item, todayMs, onStatus, onEdit, onDelete }: {
  item: JobApplication;
  todayMs: number;
  onStatus: (next: ApplicationStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const option = statusOptions.find((entry) => entry.value === item.status)!;
  const open = !closedStatuses.includes(item.status);
  const dates = [
    item.deadline && { label: "শেষ তারিখ", date: item.deadline, warnWithin: item.status === "WISHLIST" ? 3 : -1 },
    item.examDate && { label: "পরীক্ষা/ভাইভা", date: item.examDate, warnWithin: 7 },
    item.appliedAt && { label: "আবেদন", date: item.appliedAt, warnWithin: -1 },
  ].filter(Boolean) as Array<{ label: string; date: Date; warnWithin: number }>;
  const posts = item.posts.slice(0, 3);
  const html = item.notes ? /<(p|h[1-6]|ul|ol|li)\b/i.test(item.notes) : false;

  return <li className={cn(card, "min-w-0 border-l-4 p-3.5 sm:p-4", option.edge)}>
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900"><MathText text={item.title} /></h2>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12.5px] text-slate-500">
          <Building2 className="size-3.5 shrink-0" /><span className="truncate">{item.organization}</span>
          {item.location ? <><span className="text-slate-300">·</span><MapPin className="size-3.5 shrink-0" /><span className="truncate">{item.location}</span></> : null}
        </p>
      </div>
      {/* The pill is a native select: one tap opens the phone's own picker. */}
      <label className={cn("relative flex h-8 shrink-0 items-center gap-1 rounded-full pl-2.5 pr-2 text-[12px] font-semibold", option.className)}>
        <span className="sr-only">Status</span>
        {option.label}<ChevronDown className="size-3.5 opacity-60" aria-hidden />
        <select value={item.status} onChange={(event) => onStatus(event.target.value as ApplicationStatus)} aria-label={`${item.title} — status`} className="absolute inset-0 cursor-pointer opacity-0">
          {statusOptions.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </select>
      </label>
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", item.sector === "GOVERNMENT" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700")}>{sectorLabels[item.sector]}</span>
      {posts.map((post) => <span key={post} className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-700">{post}</span>)}
      {item.posts.length > posts.length ? <span className="text-[11.5px] text-slate-400">+{item.posts.length - posts.length}</span> : null}
    </div>

    {dates.length ? <dl className="mt-2 flex flex-wrap gap-1.5">
      {dates.map((entry) => {
        const days = daysFrom(entry.date, todayMs);
        const warn = open && days >= 0 && days <= entry.warnWithin;
        return <div key={entry.label} className={cn("flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px]", warn ? (days <= 1 ? "bg-red-50 font-semibold text-red-700" : "bg-amber-50 font-semibold text-amber-800") : "bg-slate-50 text-slate-600")}>
          <CalendarClock className="size-3.5 shrink-0" />
          <dt>{entry.label}</dt>
          <dd className="tabular-nums">{dayjs(entry.date).tz(APP_TIMEZONE).format("D MMM")} · {relativeDay(days)}</dd>
        </div>;
      })}
    </dl> : null}

    {item.reference || item.roll || item.password ? <dl className="mt-2 grid gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-3">
      {item.reference ? <Credential label="ID" value={item.reference} /> : null}
      {item.roll ? <Credential label="Roll" value={item.roll} /> : null}
      {item.password ? <Credential label="Pass" value={item.password} secret /> : null}
    </dl> : null}

    {detailsOpen && item.notes ? <div className="mt-2 overflow-hidden rounded-2xl border border-slate-100">
      {html
        // Sanitized again on display: only text-formatting tags and safe links remain.
        ? <RichHtml html={item.notes} />
        : <p className="whitespace-pre-wrap px-3 py-2 text-sm text-slate-600">{item.notes}</p>}
    </div> : null}

    <div className="-mb-1 mt-2 flex items-center gap-1 border-t border-slate-100 pt-1.5">
      {item.link ? <a href={item.link} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-blue-700 hover:bg-blue-50"><ExternalLink className="size-3.5" /> Circular</a> : null}
      {item.notes ? <button type="button" onClick={() => setDetailsOpen((value) => !value)} aria-expanded={detailsOpen} className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-100">
        বিস্তারিত <ChevronDown className={cn("size-3.5 transition-transform", detailsOpen && "rotate-180")} />
      </button> : null}
      <button type="button" onClick={onEdit} aria-label="Edit" title="Edit" className="ml-auto flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Pencil className="size-4" /></button>
      <button type="button" onClick={onDelete} aria-label="Delete" title="Delete" className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
    </div>
  </li>;
}

/**
 * Job applications in the home page's look, made for phones: one slim blue header (sector tabs,
 * add, search, what's coming up), one row of status chips, and compact cards.
 */
export function ApplicationBoard({ initialApplications }: { initialApplications: JobApplication[] }) {
  const [todayMs] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["applications"], queryFn: () => listMyApplications(), initialData: initialApplications });
  const applications = query.data;
  const [sector, setSector] = useState<SectorFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<JobApplication | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["applications"] });
  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ApplicationStatus }) => updateApplicationStatus(id, next),
    onSuccess: async (_, { next }) => { toast.success(`Status: ${statusLabels[next]}`); await refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: async () => { toast.success("আবেদনটি মুছে ফেলা হয়েছে"); setDeleting(null); await refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  // Sector and search narrow the list first; the status chips then count within that.
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return applications.filter((item) =>
      (sector === "ALL" || item.sector === sector)
      && (!needle || [item.title, item.organization, item.location ?? "", item.reference ?? "", item.roll ?? "", ...item.posts].some((text) => text.toLowerCase().includes(needle))));
  }, [applications, sector, search]);
  const visible = status === "ALL" ? searched : searched.filter((item) => item.status === status);
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(statusOptions.map((option) => [option.value, 0])) as Record<ApplicationStatus, number>;
    for (const item of searched) counts[item.status] += 1;
    return counts;
  }, [searched]);

  const upcoming = applications.filter((item) => !closedStatuses.includes(item.status) && [item.deadline, item.examDate].some((date) => date && date.getTime() >= todayMs - DAY && date.getTime() <= todayMs + 14 * DAY)).length;
  const sectorTabs = [
    { value: "ALL" as const, label: "সব", count: applications.length },
    { value: "GOVERNMENT" as const, label: sectorLabels.GOVERNMENT, count: applications.filter((item) => item.sector === "GOVERNMENT").length },
    { value: "NON_GOVERNMENT" as const, label: sectorLabels.NON_GOVERNMENT, count: applications.filter((item) => item.sector === "NON_GOVERNMENT").length },
  ];
  // Only statuses that have something (plus the selected one), so the chip row stays short.
  const statusChips = statusOptions.filter((option) => statusCounts[option.value] || status === option.value);

  return <div className="space-y-3">
    <h1 className="sr-only">চাকরির আবেদন</h1>
    {/* One slim header in the home page's blue: sector, add, search, what's coming up. */}
    <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)]">
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Sector" className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-full bg-white/15 p-1 ring-1 ring-white/20 sm:max-w-md">
          {sectorTabs.map((tab) => {
            const active = sector === tab.value;
            return <button key={tab.value} type="button" role="tab" aria-selected={active} onClick={() => setSector(tab.value)} className={cn("flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-[13px] font-semibold transition", active ? "bg-white text-blue-700 shadow-sm" : "text-white/90")}>
              <span className="truncate">{tab.label}</span>
              <span className={cn("text-[11px] tabular-nums", active ? "text-blue-500" : "text-white/70")}>{tab.count}</span>
            </button>;
          })}
        </div>
        <button type="button" onClick={() => setCreating(true)} aria-label="নতুন আবেদন" className="flex size-10 shrink-0 items-center justify-center gap-1 rounded-full bg-white text-[13.5px] font-semibold text-blue-700 shadow-sm transition active:scale-95 min-[360px]:w-auto min-[360px]:px-3.5"><Plus className="size-4" /> <span className="hidden min-[360px]:inline">নতুন</span></button>
      </div>
      <label className="relative mt-2.5 block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="পদ, প্রতিষ্ঠান, ID বা Roll খুঁজুন" aria-label="খুঁজুন" className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/30" />
      </label>
      {upcoming ? <p className="mt-2.5 flex items-center gap-1.5 px-1 text-[12.5px] font-semibold"><CalendarClock className="size-4" /> ১৪ দিনের মধ্যে {upcoming}টি শেষ তারিখ বা পরীক্ষা</p> : null}
    </section>

    {/* One scrollable chip row; counts tell which are worth a tap. */}
    {applications.length ? <div role="tablist" aria-label="Status ছাঁকুন" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      {[{ value: "ALL" as const, label: "সব" }, ...statusChips].map((chip) => {
        const active = status === chip.value;
        return <button key={chip.value} type="button" role="tab" aria-selected={active} onClick={() => setStatus(chip.value)} className={cn("flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition", active ? "bg-blue-600 text-white" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]")}>
          {chip.label}
          <span className={cn("text-[11.5px] tabular-nums", active ? "text-white/80" : "text-slate-400")}>{chip.value === "ALL" ? searched.length : statusCounts[chip.value]}</span>
        </button>;
      })}
    </div> : null}

    {visible.length === 0 ? (
      <div className={cn(card, "px-6 py-10 text-center")}>
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-pink-50"><BriefcaseBusiness className="size-6 text-pink-500" /></span>
        <p className="font-semibold text-slate-800">{applications.length ? "এখানে কোনো আবেদন নেই" : "এখনো কোনো আবেদন নেই"}</p>
        <p className="mt-1 text-sm text-slate-500">{applications.length ? "অন্য filter বেছে দেখুন।" : "আবেদনের copy (PDF/ছবি) দিলে AI নিজেই সব ঘর পূরণ করে দেবে।"}</p>
        {applications.length ? null : <button type="button" onClick={() => setCreating(true)} className="mt-3 inline-flex h-10 items-center gap-1 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white"><Plus className="size-4" /> নতুন আবেদন</button>}
      </div>
    ) : (
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5 lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:gap-3">
        {/* minmax(0,1fr): a column must never grow to fit a long one-line organisation, post or ID. */}
        {visible.map((item) => <ApplicationCard
          key={item.id}
          item={item}
          todayMs={todayMs}
          onStatus={(next) => statusMutation.mutate({ id: item.id, next })}
          onEdit={() => setEditing(item)}
          onDelete={() => setDeleting(item)}
        />)}
      </ul>
    )}

    <Dialog open={creating || editing !== null} onOpenChange={(value) => { if (!value) { setCreating(false); setEditing(null); } }}>
      <DialogContent className="pb-0 sm:max-h-[90dvh] sm:max-w-2xl sm:pb-0">
        <DialogHeader><DialogTitle>{editing ? "আবেদন edit" : "নতুন আবেদন"}</DialogTitle></DialogHeader>
        <ApplicationForm key={editing?.id ?? "new"} application={editing} onSuccess={() => { setCreating(false); setEditing(null); }} />
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleting !== null} onOpenChange={(value) => { if (!value) setDeleting(null); }}>
      <AlertDialogContent>
        <div className="space-y-1">
          <AlertDialogTitle>আবেদনটি মুছবেন?</AlertDialogTitle>
          <AlertDialogDescription>{deleting?.organization}-এর “{deleting?.title}” স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>না</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>মুছুন</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
