"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GripVertical, Loader2, Lock, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cleanQuickItems, DEFAULT_QUICK_ITEMS, QUICK_CATALOG, QUICK_MAX, type QuickItem } from "@/lib/quick-items";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { saveQuickItems } from "@/server/actions/settings";

const card = "rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";
const find = (id: string) => QUICK_CATALOG.find((item) => item.id === id)!;

function Badge({ item }: { item: Pick<QuickItem, "icon" | "tone"> }) {
  const Icon = item.icon;
  return <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]", item.tone)}><Icon className="size-5" /></span>;
}

/**
 * What the floating dock holds: AI chat first (fixed), then up to five of the user's own tools or
 * pages. Drag a row by its grip (or use the arrow keys on it) to change the order; tap to add or remove.
 */
export function QuickItemsSettings({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => cleanQuickItems(initial));
  const [chosen, setChosen] = useState(saved);
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const [pending, startTransition] = useTransition();
  const changed = chosen.join() !== saved.join();
  const full = chosen.length >= QUICK_MAX;
  const available = QUICK_CATALOG.filter((item) => !chosen.includes(item.id));

  // While a row is dragged, it goes in front of the first row whose middle is below the pointer.
  function dragTo(clientY: number) {
    if (!dragging) return;
    const order = chosen.filter((id) => id !== dragging);
    let at = order.findIndex((id) => {
      const box = rows.current.get(id)?.getBoundingClientRect();
      return box ? clientY < box.top + box.height / 2 : false;
    });
    if (at < 0) at = order.length;
    order.splice(at, 0, dragging);
    if (order.join() !== chosen.join()) setChosen(order);
  }

  function move(id: string, by: number) {
    const from = chosen.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= chosen.length) return;
    const order = [...chosen];
    order.splice(to, 0, order.splice(from, 1)[0]);
    setChosen(order);
  }

  function save() {
    startTransition(async () => {
      try {
        const items = await saveQuickItems(chosen);
        setSaved(items);
        setChosen(items);
        toast.success("সেভ হলো — ভাসমান বোতামে দেখো");
        router.refresh();
      } catch (error) {
        toast.error(errorMessage(error, "সেভ করা গেল না।"));
      }
    });
  }

  const group = (title: string, items: QuickItem[]) => items.length ? <div className="space-y-2">
    <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => <button key={item.id} type="button" disabled={full} onClick={() => setChosen([...chosen, item.id])}
        className="flex min-w-0 items-center gap-2 rounded-2xl bg-slate-50 p-1.5 pr-2 text-left text-[13.5px] font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-white active:scale-[0.98] disabled:opacity-45">
        <span className="scale-90"><Badge item={item} /></span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Plus className="size-4 shrink-0 text-slate-400" />
      </button>)}
    </div>
  </div> : null;

  return <div className="space-y-4">
    <section className={cn(card, "space-y-3")}>
      <div>
        <h2 className="text-base font-bold text-slate-900">দ্রুত শর্টকাট</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">ভাসমান বোতামে (<Sparkles className="inline size-3.5" />) কী কী থাকবে — যা সবচেয়ে বেশি ব্যবহার করো। মোট {QUICK_MAX + 1}টি পর্যন্ত; AI চ্যাট সবসময় প্রথমে থাকে। ধরে টেনে আগে-পরে সাজাও।</p>
      </div>

      <ol className="space-y-2">
        <li className="flex items-center gap-3 rounded-2xl bg-slate-50 p-1.5 pr-3 ring-1 ring-slate-200">
          <span className="flex w-6 justify-center text-slate-300"><Lock className="size-4" /></span>
          <Badge item={{ icon: Sparkles, tone: "from-[#3f6ef3] via-[#8b5cf6] to-[#ec4899]" }} />
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-900">AI চ্যাট</span>
          <span className="text-xs text-slate-400">সবসময় থাকে</span>
        </li>
        {chosen.map((id) => {
          const item = find(id);
          const lifted = dragging === id;
          return <li key={id} ref={(node) => { if (node) rows.current.set(id, node); else rows.current.delete(id); }}
            className={cn("flex items-center gap-3 rounded-2xl bg-white p-1.5 pr-1.5 ring-1 transition-shadow", lifted ? "relative z-10 shadow-[0_14px_30px_-12px_rgba(15,23,42,0.45)] ring-blue-300" : "ring-slate-200")}>
            <button type="button" aria-label={`${item.label} সরাও (টেনে বা ↑ ↓ চেপে)`} title="ধরে টেনে আগে-পরে নাও"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(id); }}
              onPointerMove={(event) => dragTo(event.clientY)}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); move(id, event.key === "ArrowUp" ? -1 : 1); } }}
              className={cn("flex h-10 w-6 touch-none items-center justify-center rounded-lg text-slate-400 hover:text-slate-700", lifted ? "cursor-grabbing" : "cursor-grab")}>
              <GripVertical className="size-5" />
            </button>
            <Badge item={item} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">{item.label}</span>
            <button type="button" onClick={() => setChosen(chosen.filter((other) => other !== id))} aria-label={`${item.label} বাদ দাও`} className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="size-4" /></button>
          </li>;
        })}
      </ol>
      <p className="text-xs text-slate-500">{chosen.length + 1}/{QUICK_MAX + 1}টি{full ? " — ভরে গেছে; নতুন কিছু নিতে একটা বাদ দাও।" : ""}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={pending || !changed}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-slate-950 px-6 text-[15px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:flex-none">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {pending ? "সেভ হচ্ছে…" : changed ? "সেভ করো" : "সব সেভ করা আছে"}
        </button>
        <button type="button" onClick={() => setChosen(DEFAULT_QUICK_ITEMS)} disabled={pending || chosen.join() === DEFAULT_QUICK_ITEMS.join()}
          className="flex h-11 items-center gap-1.5 rounded-2xl px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"><RotateCcw className="size-4" /> আগের মতো</button>
      </div>
    </section>

    <section className={cn(card, "space-y-4")}>
      <h2 className="text-base font-bold text-slate-900">যোগ করো</h2>
      {group("টুল", available.filter((item) => !item.href))}
      {group("পাতা", available.filter((item) => item.href))}
    </section>
  </div>;
}
