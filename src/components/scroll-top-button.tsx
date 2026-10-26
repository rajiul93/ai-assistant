"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = 44;
const EDGE = 16;
/** Shown once the page has been scrolled this far down. */
const SHOW_AFTER = 400;

/**
 * Bottom right: one tap back to the top of a long page (question sets, notes, the bank). It sits
 * above the phone tab bar and any page bar marked `data-dock-avoid`, and moves up out of the way
 * when the draggable tool dock rests in the same corner.
 */
export function ScrollTopButton() {
  const [bottom, setBottom] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const place = () => {
      frame = 0;
      if (window.scrollY < SHOW_AFTER) { setBottom(null); return; }
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      let floor = window.innerHeight - (desktop ? 24 : 88);
      const bar = document.querySelector("[data-dock-avoid]")?.getBoundingClientRect();
      if (bar?.height) floor = Math.min(floor, bar.top - 8);
      // The tool dock may sit in this corner; then go just above it.
      const dock = document.querySelector("[data-tool-dock]")?.getBoundingClientRect();
      const left = window.innerWidth - EDGE - SIZE;
      if (dock?.height && dock.right > left && dock.left < left + SIZE && dock.bottom > floor - SIZE - 8 && dock.top < floor) floor = dock.top - 10;
      setBottom(Math.max(EDGE, window.innerHeight - floor));
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(place); };
    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  return <button
    type="button"
    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    aria-label="একদম উপরে যাও"
    title="একদম উপরে যাও"
    tabIndex={bottom === null ? -1 : 0}
    style={{ bottom: bottom ?? EDGE, right: EDGE, width: SIZE, height: SIZE }}
    className={cn(
      "fixed z-30 flex items-center justify-center rounded-full bg-white text-blue-700 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.45)] ring-1 ring-slate-200 transition-[opacity,transform] duration-200 hover:bg-blue-50 active:scale-95 print:hidden",
      bottom === null ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100",
    )}
  >
    <ArrowUp className="size-5" strokeWidth={2.5} />
  </button>;
}
