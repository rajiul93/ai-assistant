import type { ApplicationStatus, JobSector } from "@prisma/client";

export const sectorLabels: Record<JobSector, string> = {
  GOVERNMENT: "সরকারি",
  NON_GOVERNMENT: "বেসরকারি",
};

/**
 * In pipeline order; the last three are closed outcomes. `className` colours the status pill,
 * `edge` the card's left edge.
 */
export const statusOptions: Array<{ value: ApplicationStatus; label: string; className: string; edge: string }> = [
  { value: "WISHLIST", label: "আবেদন করব", className: "bg-slate-100 text-slate-700", edge: "border-l-slate-300" },
  { value: "APPLIED", label: "আবেদন করেছি", className: "bg-sky-50 text-sky-700", edge: "border-l-sky-400" },
  { value: "EXAM", label: "পরীক্ষা", className: "bg-violet-50 text-violet-700", edge: "border-l-violet-400" },
  { value: "INTERVIEW", label: "ভাইভা", className: "bg-amber-50 text-amber-800", edge: "border-l-amber-400" },
  { value: "OFFER", label: "চাকরি হয়েছে", className: "bg-emerald-50 text-emerald-700", edge: "border-l-emerald-500" },
  { value: "REJECTED", label: "হয়নি", className: "bg-red-50 text-red-700", edge: "border-l-red-400" },
  { value: "WITHDRAWN", label: "বাদ দিয়েছি", className: "bg-slate-100 text-slate-500", edge: "border-l-slate-300" },
];

export const statusLabels = Object.fromEntries(statusOptions.map((option) => [option.value, option.label])) as Record<ApplicationStatus, string>;

export const closedStatuses: ApplicationStatus[] = ["OFFER", "REJECTED", "WITHDRAWN"];
