import type { ApplicationStatus, JobSector } from "@prisma/client";

export const sectorLabels: Record<JobSector, string> = {
  GOVERNMENT: "Government",
  NON_GOVERNMENT: "Non-government",
};

/** In pipeline order; the last two are closed outcomes. */
export const statusOptions: Array<{ value: ApplicationStatus; label: string; className: string }> = [
  { value: "WISHLIST", label: "Want to apply", className: "bg-zinc-100 text-zinc-700" },
  { value: "APPLIED", label: "Applied", className: "bg-sky-50 text-sky-700" },
  { value: "EXAM", label: "Exam", className: "bg-violet-50 text-violet-700" },
  { value: "INTERVIEW", label: "Interview", className: "bg-amber-50 text-amber-800" },
  { value: "OFFER", label: "Offer", className: "bg-emerald-50 text-emerald-700" },
  { value: "REJECTED", label: "Rejected", className: "bg-red-50 text-red-700" },
  { value: "WITHDRAWN", label: "Withdrawn", className: "bg-zinc-100 text-zinc-500" },
];

export const statusLabels = Object.fromEntries(statusOptions.map((option) => [option.value, option.label])) as Record<ApplicationStatus, string>;

export const closedStatuses: ApplicationStatus[] = ["OFFER", "REJECTED", "WITHDRAWN"];
