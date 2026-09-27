"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/math-text";

export type PickItem = { id: string; title: string; hint?: string | null; muted?: boolean };

/** A searchable list to tick items on and off (notes for a task, tasks for a note). */
export function PickDialog({ open, onOpenChange, title, items, loading, selectedIds, onToggle, busyId, emptyText, placeholder, footer }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: PickItem[];
  loading?: boolean;
  selectedIds: string[];
  onToggle: (item: PickItem, selected: boolean) => void;
  /** The item whose change is being saved. */
  busyId?: string | null;
  emptyText: string;
  placeholder: string;
  footer?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? items.filter((item) => `${item.title} ${item.hint ?? ""}`.toLowerCase().includes(needle)) : items;
  }, [items, search]);
  const selected = new Set(selectedIds);

  return <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) setSearch(""); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 focus-within:border-zinc-400">
        <Search className="size-4 shrink-0 text-zinc-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      <ul className="mt-2 max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain">
        {loading ? <li className="px-3 py-6 text-center text-sm text-zinc-500">Loading…</li> : null}
        {!loading && visible.length === 0 ? <li className="px-3 py-6 text-center text-sm text-zinc-500">{items.length ? "কিছু মেলেনি।" : emptyText}</li> : null}
        {visible.map((item) => {
          const on = selected.has(item.id);
          return <li key={item.id}>
            <button
              type="button"
              disabled={busyId === item.id}
              onClick={() => onToggle(item, !on)}
              aria-pressed={on}
              className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-zinc-50 disabled:opacity-50", on && "bg-indigo-50 hover:bg-indigo-50")}
            >
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border", on ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300")}>{on ? <Check className="size-3.5" strokeWidth={3} /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-medium", item.muted && "text-zinc-400 line-through")}><MathText text={item.title} /></span>
                {item.hint ? <span className="block truncate text-xs text-zinc-500">{item.hint}</span> : null}
              </span>
            </button>
          </li>;
        })}
      </ul>
      {footer ? <div className="mt-3 border-t border-zinc-100 pt-3">{footer}</div> : null}
    </DialogContent>
  </Dialog>;
}
