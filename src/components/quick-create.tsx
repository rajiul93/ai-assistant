"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelp, ClipboardCheck, ListTodo, MessageSquareText, NotebookPen, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const actions = [
  { href: "/tasks?add=1", label: "নতুন Task", icon: ListTodo, tone: "bg-blue-50 text-blue-600" },
  { href: "/notes", label: "নতুন Note", icon: NotebookPen, tone: "bg-orange-50 text-orange-600" },
  { href: "/preliminary/new", label: "Preliminary set", icon: ClipboardCheck, tone: "bg-rose-50 text-rose-600" },
  { href: "/short-questions/new", label: "Short Question set", icon: MessageSquareText, tone: "bg-sky-50 text-sky-600" },
  { href: "/confusions", label: "Confusion", icon: CircleHelp, tone: "bg-emerald-50 text-emerald-600" },
];

/** The raised "+" in the middle of the phone tab bar: add something new from anywhere. */
export function QuickCreate() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="নতুন কিছু যোগ করুন" aria-haspopup="dialog" className="-mt-7 flex size-16 items-center justify-center justify-self-center rounded-full bg-blue-600 text-white shadow-[0_10px_24px_-6px_rgba(37,99,235,0.65)] ring-[6px] ring-[#f4f6fb] transition hover:bg-blue-700 active:scale-95">
      <Plus className="size-8" strokeWidth={2.25} />
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle className="mb-3">নতুন যোগ করুন</DialogTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return <Link key={action.label} href={action.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-medium text-slate-800 transition hover:border-blue-300 active:scale-95">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${action.tone}`}><Icon className="size-5" /></span>
              {action.label}
            </Link>;
          })}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
