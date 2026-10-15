"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ProgressView = "daily" | "subjects" | "work";
const TABS: Array<{ id: ProgressView; label: string }> = [
  { id: "daily", label: "দৈনিক" },
  { id: "subjects", label: "বিষয়" },
  { id: "work", label: "Task ও Test" },
];

/**
 * Phones: one panel at a time behind three tabs, so the page fits one screen without scrolling.
 * From lg up every panel shows side by side and the tabs hide.
 */
export function ProgressTabs({ initial, panels }: { initial: ProgressView; panels: Record<ProgressView, ReactNode> }) {
  const [view, setView] = useState<ProgressView>(initial);
  return <div className="space-y-3">
    <div role="tablist" aria-label="অগ্রগতি" className="grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-[0_2px_10px_-6px_rgba(15,23,42,0.25)] lg:hidden">
      {TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} aria-controls={`progress-${tab.id}`} onClick={() => setView(tab.id)} className={cn("h-9 rounded-full text-[13px] font-semibold transition", view === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-500")}>{tab.label}</button>)}
    </div>
    <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
      <div className="space-y-4">
        <div id="progress-daily" role="tabpanel" className={cn(view !== "daily" && "hidden", "lg:block")}>{panels.daily}</div>
        <div id="progress-work" role="tabpanel" className={cn(view !== "work" && "hidden", "lg:block")}>{panels.work}</div>
      </div>
      <div id="progress-subjects" role="tabpanel" className={cn(view !== "subjects" && "hidden", "lg:block")}>{panels.subjects}</div>
    </div>
  </div>;
}
