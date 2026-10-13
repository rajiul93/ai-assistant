"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { adminLinksFor, links, searchWords } from "@/components/nav-links";
import { cn } from "@/lib/utils";

/**
 * The header's search: find any page by its name (Bangla or English) and open it. Also used by
 * "See All" on the home page, which opens it with every page listed.
 */
export function PageFinder({ admin = false, superAdmin = false, trigger = "icon", className }: { admin?: boolean; superAdmin?: boolean; trigger?: "icon" | "see-all"; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pages = [...links, ...adminLinksFor(admin, superAdmin)];
  const words = query.trim().toLowerCase();
  const shown = words ? pages.filter((page) => `${page.label} ${searchWords[page.href] ?? ""}`.toLowerCase().includes(words)) : pages;

  return <>
    {trigger === "icon"
      ? <button type="button" onClick={() => setOpen(true)} aria-label="পাতা খুঁজুন" className={cn("flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200", className)}><Search className="size-5" /></button>
      : <button type="button" onClick={() => setOpen(true)} className={cn("text-sm font-medium text-slate-600 hover:text-blue-700", className)}>See All →</button>}
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <DialogContent>
        <DialogTitle className="mb-3">কোথায় যাবেন?</DialogTitle>
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="যেমন: প্রশ্ন ব্যাংক, notes, চাকরি" aria-label="পাতা খুঁজুন" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400" />
        </label>
        <nav aria-label="সব পাতা" className="grid max-h-[55dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {shown.map((page) => {
            const Icon = page.icon;
            return <Link key={page.href} href={page.href} onClick={() => setOpen(false)} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 px-1 text-center text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 active:scale-95">
              <Icon className="size-5 text-blue-600" />{page.label}
            </Link>;
          })}
          {!shown.length ? <p className="col-span-full py-6 text-center text-sm text-slate-500">এই নামে কোনো পাতা নেই।</p> : null}
        </nav>
      </DialogContent>
    </Dialog>
  </>;
}
