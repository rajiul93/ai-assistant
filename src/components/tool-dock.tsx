"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, CalendarDays, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistantStore } from "@/store/assistant";

type Tool = "calculator" | "calendar";
const OPEN_TOOL = "prep:open-tool";

/** Lets a tool's sheet open when its button in the dock is tapped; returns the cleanup. */
export function onOpenTool(tool: Tool, open: () => void) {
  const listener = (event: Event) => { if ((event as CustomEvent<Tool>).detail === tool) open(); };
  window.addEventListener(OPEN_TOOL, listener);
  return () => window.removeEventListener(OPEN_TOOL, listener);
}

const ITEMS: Array<{ id: Tool | "assistant"; label: string; icon: typeof Calculator; tone: string }> = [
  { id: "assistant", label: "AI চ্যাট", icon: Sparkles, tone: "from-[#3f6ef3] via-[#8b5cf6] to-[#ec4899]" },
  { id: "calendar", label: "ক্যালেন্ডার", icon: CalendarDays, tone: "from-emerald-400 to-teal-600" },
  { id: "calculator", label: "ক্যালকুলেটর", icon: Calculator, tone: "from-[#3f6ef3] to-[#7f9cfa]" },
];

type Spot = { side: "left" | "right"; /** Top of the button as a share of the free height (0 top … 1 bottom). */ y: number };
const SPOT_KEY = "prep:dock-spot";
const SIZE = 56;
const EDGE = 16;
const DEFAULT_SPOT: Spot = { side: "right", y: 1 };

const readSpot = (): Spot => {
  try {
    const saved = JSON.parse(localStorage.getItem(SPOT_KEY) ?? "null") as Spot | null;
    if (saved && (saved.side === "left" || saved.side === "right") && typeof saved.y === "number") return { side: saved.side, y: Math.min(1, Math.max(0, saved.y)) };
  } catch { /* use the default */ }
  return DEFAULT_SPOT;
};

/** The band the button may sit in: below the phone header, above the tab bar (desktop: the whole height). */
function band() {
  const desktop = window.matchMedia("(min-width: 1024px)").matches;
  const top = desktop ? 24 : 76;
  const bottom = window.innerHeight - (desktop ? 24 : 80) - SIZE;
  return { top, bottom: Math.max(top, bottom), left: desktop ? 240 + EDGE : EDGE, right: window.innerWidth - EDGE - SIZE };
}

/**
 * One floating button for the AI chat, the calendar and the calculator: tap it to fan them out.
 * Drag it to move it — it may sit anywhere up or down, but always snaps to the left or right edge
 * (never the middle), and keeps its place across visits.
 */
export function ToolDock() {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [, setViewport] = useState(0);
  const start = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const busy = useAssistantStore((state) => state.busy);
  const assistantOpen = useAssistantStore((state) => state.open);

  // The saved spot lives in this browser only; read it once on the client.
  useEffect(() => {
    const saved = readSpot();
    // Next tick, not in the effect itself (and not a frame: hidden tabs pause those).
    const frame = window.setTimeout(() => setSpot(saved), 0);
    const onResize = () => setViewport(window.innerWidth * 10_000 + window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => { window.clearTimeout(frame); window.removeEventListener("resize", onResize); };
  }, []);

  // Escape or a tap anywhere else folds the menu away.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !(event.target as Element | null)?.closest?.("[data-tool-dock]")) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close); };
  }, [open]);

  if (!spot) return null;
  const limits = band();
  const left = drag ? drag.x : spot.side === "left" ? limits.left : limits.right;
  const top = drag ? drag.y : limits.top + spot.y * (limits.bottom - limits.top);
  // The menu opens towards the free side: up when the button is low, down when it is high.
  const menuBelow = top < window.innerHeight / 2;

  function choose(id: (typeof ITEMS)[number]["id"]) {
    setOpen(false);
    if (id === "assistant") useAssistantStore.getState().setOpen(true);
    else window.dispatchEvent(new CustomEvent(OPEN_TOOL, { detail: id }));
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    start.current = { x: event.clientX, y: event.clientY, left, top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const from = start.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    // A small wobble is still a tap.
    if (!from.moved && Math.hypot(dx, dy) < 8) return;
    from.moved = true;
    setOpen(false);
    setDrag({ x: Math.min(window.innerWidth - SIZE - 4, Math.max(4, from.left + dx)), y: Math.min(limits.bottom, Math.max(limits.top, from.top + dy)) });
  }
  function onPointerUp() {
    const from = start.current;
    start.current = null;
    if (!from) return;
    if (!from.moved || !drag) { setOpen((value) => !value); return; }
    // Snap to the nearer edge; keep the height where it was dropped.
    const next: Spot = { side: drag.x + SIZE / 2 < window.innerWidth / 2 ? "left" : "right", y: limits.bottom > limits.top ? (drag.y - limits.top) / (limits.bottom - limits.top) : 1 };
    setDrag(null);
    setSpot(next);
    try { localStorage.setItem(SPOT_KEY, JSON.stringify(next)); } catch { /* not remembered; fine */ }
  }

  return <div data-tool-dock className={cn("fixed z-40", assistantOpen && "max-sm:hidden")} style={{ left, top, transition: drag ? "none" : "left 0.25s cubic-bezier(0.2,0.8,0.2,1), top 0.25s cubic-bezier(0.2,0.8,0.2,1)" }}>
    {open ? <div className={cn("assistant-in absolute flex w-max flex-col gap-2", menuBelow ? "top-full mt-2" : "bottom-full mb-2", spot.side === "left" ? "left-0 items-start" : "right-0 items-end")}>
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} type="button" onClick={() => choose(item.id)} className="flex h-12 items-center gap-2.5 rounded-full bg-white/95 py-1 pl-1 pr-4 text-[14.5px] font-semibold text-slate-800 shadow-[0_12px_28px_-12px_rgba(15,23,42,0.5)] ring-1 ring-slate-200/80 backdrop-blur transition active:scale-95">
          <span className={cn("flex size-10 items-center justify-center rounded-full bg-linear-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]", item.tone)}><Icon className="size-5" /></span>
          {item.label}
        </button>;
      })}
    </div> : null}
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { start.current = null; setDrag(null); }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(!open); } }}
      aria-expanded={open}
      aria-label={open ? "বন্ধ করো" : "AI চ্যাট, ক্যালেন্ডার, ক্যালকুলেটর — টেনে সরানো যায়"}
      title="টেনে বাঁ বা ডান পাশে সরাও"
      className={cn("relative flex touch-none select-none items-center justify-center rounded-full text-white shadow-[0_14px_32px_-10px_rgba(139,92,246,0.8)] transition-transform active:scale-95", drag ? "scale-110 cursor-grabbing" : "cursor-pointer hover:scale-105")}
      style={{ width: SIZE, height: SIZE }}
    >
      {/* A soft coloured glow under the button; the orb spins while the AI is busy. */}
      <span aria-hidden className="absolute -inset-1 rounded-full bg-linear-to-br from-[#3f6ef3] via-[#a855f7] to-[#f43f5e] opacity-45 blur-md" />
      {busy ? <span className="assistant-orb absolute inset-0 rounded-full" /> : null}
      <span className={cn("absolute flex items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-[#3f6ef3] via-[#8b5cf6] to-[#ec4899] ring-2 ring-white/70", busy ? "inset-0.75" : "inset-0")}>
        {/* Glass shine on the top half. */}
        <span aria-hidden className="absolute inset-x-1.5 top-1 h-1/2 rounded-full bg-linear-to-b from-white/45 to-white/0" />
        {open ? <X className="relative size-6" strokeWidth={2.4} /> : <Sparkles className="relative size-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" strokeWidth={2.2} />}
      </span>
      {/* Two small coloured dots hint that more than the AI is inside. */}
      {!open ? <span aria-hidden className="absolute -right-0.5 -top-0.5 flex gap-0.5 rounded-full bg-white p-0.5 shadow-sm">
        <span className="size-1.5 rounded-full bg-emerald-500" /><span className="size-1.5 rounded-full bg-blue-500" />
      </span> : null}
    </button>
  </div>;
}
