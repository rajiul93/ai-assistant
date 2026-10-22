"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, FilePlus2, Grid3x3, PencilLine, Redo2, Rows3, Square, Trash2, Undo2, X } from "lucide-react";
import { onOpenTool } from "@/components/tool-dock";
import { cn } from "@/lib/utils";

/**
 * রাফ খাতা: a full-screen page to write on by hand (finger, stylus or mouse) for rough work.
 * Nothing is saved anywhere — the pages live in this tab's memory, so closing the sheet keeps them
 * until the app is reloaded. Strokes are kept as points, so the page redraws sharply after a
 * resize and undo is just dropping the last stroke.
 */

type Point = [x: number, y: number];
type Stroke = { color: string; width: number; erase: boolean; points: Point[] };
type Page = { strokes: Stroke[]; undone: Stroke[] };
type Paper = "ruled" | "grid" | "blank";

const COLORS = ["#1f2937", "#2563eb", "#dc2626", "#16a34a"];
const WIDTHS = [2, 3.5, 6];
const ERASER_WIDTH = 28;
const PAPER_KEY = "prep:scratch-paper";

// Kept outside React so closing and reopening the sheet doesn't lose the work (a reload does).
const memory: { pages: Page[]; index: number } = { pages: [{ strokes: [], undone: [] }], index: 0 };

/** The page on screen, read fresh in event handlers (the work lives outside React). */
const currentPage = () => memory.pages[memory.index];

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function styleFor(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** A whole stroke, smoothed through the midpoints of its points. */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const points = stroke.points;
  if (!points.length) return;
  styleFor(ctx, stroke);
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0], points[0][1], stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = mid(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i][0], points[i][1], x, y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

/** Only the newest piece while the pen moves, so long strokes stay fast. */
function drawTail(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const points = stroke.points;
  const n = points.length - 1;
  if (n < 1) return;
  styleFor(ctx, stroke);
  ctx.beginPath();
  if (n === 1) {
    ctx.moveTo(points[0][0], points[0][1]);
    const [x, y] = mid(points[0], points[1]);
    ctx.lineTo(x, y);
  } else {
    const [x1, y1] = mid(points[n - 2], points[n - 1]);
    const [x2, y2] = mid(points[n - 1], points[n]);
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(points[n - 1][0], points[n - 1][1], x2, y2);
  }
  ctx.stroke();
}

const paperBackground: Record<Paper, React.CSSProperties> = {
  // A copy book: faint blue rules and a red margin line.
  ruled: {
    backgroundImage: "linear-gradient(to right, transparent 47px, rgba(220,38,38,0.35) 47px, rgba(220,38,38,0.35) 48px, transparent 48px), repeating-linear-gradient(to bottom, transparent 0, transparent 35px, rgba(59,130,246,0.22) 35px, rgba(59,130,246,0.22) 36px)",
  },
  grid: {
    backgroundImage: "repeating-linear-gradient(to right, rgba(100,116,139,0.16) 0, rgba(100,116,139,0.16) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(to bottom, rgba(100,116,139,0.16) 0, rgba(100,116,139,0.16) 1px, transparent 1px, transparent 24px)",
  },
  blank: {},
};

export function ScratchPadSheet() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [erasing, setErasing] = useState(false);
  const [paper, setPaper] = useState<Paper>("ruled");
  const [confirmClear, setConfirmClear] = useState(false);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<{ id: number; stroke: Stroke } | null>(null);
  // Once a stylus is used, touches are the palm resting on the screen: ignore them.
  const penSeen = useRef(false);

  useEffect(() => onOpenTool("scratch", () => setOpen(true)), []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PAPER_KEY);
      if (saved === "ruled" || saved === "grid" || saved === "blank") window.setTimeout(() => setPaper(saved), 0);
    } catch { /* default paper */ }
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const page = memory.pages[memory.index];

  /** Sizes the canvas to its box (sharp on high-density screens) and draws the page again. */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const ratio = window.devicePixelRatio || 1;
    const { width: w, height: h } = box.getBoundingClientRect();
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const stroke of memory.pages[memory.index].strokes) drawStroke(ctx, stroke);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    redraw();
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(box);
    return () => observer.disconnect();
  }, [open, redraw]);

  const pointOf = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "pen") penSeen.current = true;
    if (event.pointerType === "touch" && penSeen.current) return;
    if (drawing.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke: Stroke = { color, width: erasing ? ERASER_WIDTH : width, erase: erasing, points: [pointOf(event)] };
    drawing.current = { id: event.pointerId, stroke };
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawStroke(ctx, stroke);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const current = drawing.current;
    if (!current || current.id !== event.pointerId) return;
    const ctx = canvasRef.current?.getContext("2d");
    // Coalesced events carry every point the pen passed between frames: smoother fast writing.
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const each of events.length ? events : [event.nativeEvent]) {
      current.stroke.points.push(pointOf(each));
      if (ctx) drawTail(ctx, current.stroke);
    }
  }

  function up(event: React.PointerEvent<HTMLCanvasElement>) {
    const current = drawing.current;
    if (!current || current.id !== event.pointerId) return;
    drawing.current = null;
    const target = currentPage();
    target.strokes.push(current.stroke);
    target.undone.length = 0;
    redraw();
    rerender();
  }

  function undo() {
    const stroke = currentPage().strokes.pop();
    if (stroke) currentPage().undone.push(stroke);
    redraw();
    rerender();
  }
  function redo() {
    const stroke = currentPage().undone.pop();
    if (stroke) currentPage().strokes.push(stroke);
    redraw();
    rerender();
  }
  function clearPage() {
    memory.pages[memory.index] = { strokes: [], undone: [] };
    setConfirmClear(false);
    redraw();
    rerender();
  }
  function goTo(index: number) {
    memory.index = index;
    setConfirmClear(false);
    redraw();
    rerender();
  }
  function addPage() {
    memory.pages.splice(memory.index + 1, 0, { strokes: [], undone: [] });
    goTo(memory.index + 1);
  }
  function changePaper(next: Paper) {
    setPaper(next);
    try { localStorage.setItem(PAPER_KEY, next); } catch { /* just for this visit */ }
  }

  if (!open) return null;
  const tool = (on: boolean) => cn("flex size-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-35", on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100");
  const nextPaper: Record<Paper, Paper> = { ruled: "grid", grid: "blank", blank: "ruled" };
  const PaperIcon = { ruled: Rows3, grid: Grid3x3, blank: Square }[paper];

  return <div role="dialog" aria-modal="true" aria-label="রাফ খাতা" className="assistant-panel-in fixed inset-0 z-[60] flex flex-col bg-[#f3f3ef] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
    {/* Tools scroll sideways on narrow phones instead of wrapping over the page. */}
    <header className="flex items-center gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none]">
      <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className={tool(false)}><X className="size-5" /></button>
      <span className="mx-1 shrink-0 text-[15px] font-bold text-slate-900">রাফ খাতা</span>
      <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
      <button type="button" onClick={() => setErasing(false)} aria-pressed={!erasing} aria-label="কলম" className={tool(!erasing)}><PencilLine className="size-5" /></button>
      <button type="button" onClick={() => setErasing(true)} aria-pressed={erasing} aria-label="রাবার" className={tool(erasing)}><Eraser className="size-5" /></button>
      {COLORS.map((value) => <button key={value} type="button" onClick={() => { setColor(value); setErasing(false); }} aria-label="রং" aria-pressed={!erasing && color === value} className="flex size-9 shrink-0 items-center justify-center rounded-full">
        <span className={cn("size-6 rounded-full ring-offset-2 transition", !erasing && color === value && "ring-2 ring-slate-400")} style={{ background: value }} />
      </button>)}
      {WIDTHS.map((value) => <button key={value} type="button" onClick={() => { setWidth(value); setErasing(false); }} aria-label="কলমের মোটা" aria-pressed={!erasing && width === value} className={tool(!erasing && width === value)}>
        <span className="rounded-full bg-current" style={{ width: value + 3, height: value + 3 }} />
      </button>)}
      <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
      <button type="button" onClick={undo} disabled={!page.strokes.length} aria-label="Undo" className={tool(false)}><Undo2 className="size-5" /></button>
      <button type="button" onClick={redo} disabled={!page.undone.length} aria-label="Redo" className={tool(false)}><Redo2 className="size-5" /></button>
      <button type="button" onClick={() => changePaper(nextPaper[paper])} aria-label="পাতার ধরন বদলাও" title="রুল / ছক / সাদা" className={tool(false)}><PaperIcon className="size-5" /></button>
      {confirmClear
        ? <span className="flex shrink-0 items-center gap-1 pl-1 text-[13px]">
          <span className="text-slate-600">পাতা মুছবে?</span>
          <button type="button" onClick={clearPage} className="h-8 rounded-full bg-red-600 px-3 font-semibold text-white">হ্যাঁ</button>
          <button type="button" onClick={() => setConfirmClear(false)} className="h-8 rounded-full px-3 font-semibold text-slate-600 ring-1 ring-slate-200">না</button>
        </span>
        : <button type="button" onClick={() => setConfirmClear(true)} disabled={!page.strokes.length} aria-label="পুরো পাতা মোছো" className={tool(false)}><Trash2 className="size-5" /></button>}
    </header>

    <div ref={boxRef} className="relative mx-2 min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.18)] ring-1 ring-slate-200" style={paperBackground[paper]}>
      {/* The page lines are the box's background, so the eraser never rubs them out. */}
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn("absolute inset-0 touch-none select-none", erasing ? "cursor-cell" : "cursor-crosshair")}
      />
    </div>

    <footer className="flex items-center justify-center gap-2 px-2 py-2">
      <button type="button" onClick={() => goTo(memory.index - 1)} disabled={memory.index === 0} aria-label="আগের পাতা" className={tool(false)}><ChevronLeft className="size-5" /></button>
      <span className="min-w-20 text-center text-[13px] font-semibold tabular-nums text-slate-600">পাতা {memory.index + 1} / {memory.pages.length}</span>
      <button type="button" onClick={() => goTo(memory.index + 1)} disabled={memory.index === memory.pages.length - 1} aria-label="পরের পাতা" className={tool(false)}><ChevronRight className="size-5" /></button>
      <button type="button" onClick={addPage} className="ml-2 flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white active:scale-95"><FilePlus2 className="size-4" /> নতুন পাতা</button>
    </footer>
  </div>;
}
