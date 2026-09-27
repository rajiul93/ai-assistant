"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Image = { src: string; name: string };

const noopSubscribe = () => () => {};

/**
 * Full-screen view of one image, centred and as large as the screen allows, with the others a swipe
 * (or arrow key) away. Esc, the × or a tap on the dark background closes it. Rendered into <body>
 * through a portal: inside the chat panel (which has a backdrop blur) "fixed" would only cover the panel.
 */
export function ImageViewer({ images, index, onIndex, onClose }: { images: Image[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const startX = useRef<number | null>(null);
  const count = images.length;
  const go = (step: number) => onIndex((index + step + count) % count);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && count > 1) onIndex((index + 1) % count);
      if (event.key === "ArrowLeft" && count > 1) onIndex((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onIndex, onClose]);

  // Lock the page behind so a swipe moves images, not the page.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const image = images[index];
  if (!image || !mounted) return null;
  const nav = "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25";
  return createPortal(<div
    role="dialog"
    aria-modal="true"
    aria-label={image.name}
    className="fixed inset-0 z-[100] flex h-dvh w-screen flex-col bg-black/95"
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onPointerDown={(event) => { startX.current = event.clientX; }}
    onPointerUp={(event) => {
      // A sideways swipe on phones moves to the next/previous image.
      if (startX.current === null || count < 2) return;
      const moved = event.clientX - startX.current;
      startX.current = null;
      if (Math.abs(moved) > 50) go(moved < 0 ? 1 : -1);
    }}
  >
    <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] text-sm text-white">
      <p className="min-w-0 truncate">{image.name}</p>
      <div className="flex shrink-0 items-center gap-3">
        {count > 1 ? <span className="tabular-nums text-white/70">{index + 1} / {count}</span> : null}
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><X className="size-5" /></button>
      </div>
    </div>
    <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {/* Fills the screen (small images are scaled up too), keeping its shape, centred. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own upload */}
      <img src={image.src} alt={image.name} className="h-full w-full select-none object-contain" draggable={false} />
      {count > 1 ? <>
        <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${nav} left-3`}><ChevronLeft className="size-6" /></button>
        <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${nav} right-3`}><ChevronRight className="size-6" /></button>
      </> : null}
    </div>
  </div>, document.body);
}
