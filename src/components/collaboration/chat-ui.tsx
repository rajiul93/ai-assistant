"use client";

import type { ReactNode, RefObject, UIEventHandler } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Clock3, Loader2, MoreVertical, RotateCcw, Send, UsersRound } from "lucide-react";
import { bubbleTime, chatDayKey, chatDayLabel } from "@/lib/chat-time";
import { cn } from "@/lib/utils";

/*
 * WhatsApp-style pieces shared by the 1:1 and group chats, in the home page's colours: the blue
 * banner gradient for the header and my bubbles, the pale blue page tone behind the messages.
 */

/** Google photo or initial; a people icon for groups. */
export function ChatAvatar({ name, image, group, className }: { name: string; image?: string | null; group?: boolean; className?: string }) {
  return <span className={cn("flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full", group ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-700", className)}>
    {group ? <UsersRound className="size-[45%]" />
      : image
        // eslint-disable-next-line @next/next/no-img-element -- Google avatar, any host
        ? <img src={image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        : <span className="text-[1.05em] font-bold">{(name.trim()[0] ?? "?").toUpperCase()}</span>}
  </span>;
}

/** Space kept under the chat card on a desktop, so the composer never sits at the very edge. */
const FRAME_GAP = 20;

/**
 * The open chat. On a phone or tablet it covers the whole screen (above the tab bar), like
 * WhatsApp; on a desktop it is a card next to the chat list that ends at the bottom of the window,
 * so the composer is always in view. Its height is measured from where the card starts — the
 * header and chips above it change height — instead of a fixed guess, which pushed the composer
 * below the fold.
 */
export function ChatFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const fit = () => {
      if (!desktop.matches) { element.style.height = ""; return; }
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.height = `${Math.max(384, window.innerHeight - top - FRAME_GAP)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    desktop.addEventListener("change", fit);
    return () => { window.removeEventListener("resize", fit); desktop.removeEventListener("change", fit); };
  }, []);
  return <section ref={frame} className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#eef1fb] lg:static lg:z-auto lg:h-[calc(100dvh-14rem)] lg:min-h-96 lg:rounded-3xl lg:shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
    {children}
  </section>;
}

/** Blue header with a back arrow (phones) and whatever identifies the chat. */
export function ChatHeader({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return <header className="flex shrink-0 items-center gap-1.5 bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] px-2 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] text-white shadow-[0_6px_20px_-12px_rgba(37,99,235,0.7)] lg:pt-2.5">
    <button type="button" onClick={onBack} aria-label="Chat list-এ ফিরে যাও" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/15 lg:hidden"><ArrowLeft className="size-5" /></button>
    {children}
  </header>;
}

/** "⋮" in the header with a small menu of chat actions. */
export function HeaderMenu({ label, items }: { label: string; items: Array<{ label: string; icon: ReactNode; onSelect: () => void; danger?: boolean }> }) {
  const [open, setOpen] = useState(false);
  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={label} aria-expanded={open} className="flex size-10 items-center justify-center rounded-full hover:bg-white/15"><MoreVertical className="size-5" /></button>
    {open ? <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
      <div role="menu" className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-2xl bg-white py-1 text-slate-700 shadow-lg ring-1 ring-slate-200">
        {items.map((item) => <button key={item.label} type="button" role="menuitem" onClick={() => { setOpen(false); item.onSelect(); }} className={cn("flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm", item.danger ? "text-red-600 hover:bg-red-50" : "hover:bg-slate-50")}>{item.icon}{item.label}</button>)}
      </div>
    </> : null}
  </div>;
}

/** Name and a status line under it, as in the header. */
export function ChatTitle({ avatar, title, subtitle }: { avatar: ReactNode; title: string; subtitle: ReactNode }) {
  return <>
    {avatar}
    <span className="min-w-0 flex-1 pl-1 text-left">
      <span className="block truncate text-[16px] font-semibold leading-tight">{title}</span>
      <span className="block truncate text-xs text-white/80">{subtitle}</span>
    </span>
  </>;
}

/** "Live" dot and words for the connection state. */
export function liveLabel(status: string) {
  return <span className="inline-flex items-center gap-1.5">
    <span className={cn("size-1.5 rounded-full", status === "live" ? "bg-emerald-300" : "bg-white/50")} />
    {status === "live" ? "সরাসরি সংযুক্ত" : status === "connecting" ? "সংযোগ হচ্ছে…" : "কয়েক সেকেন্ড পরপর দেখা হচ্ছে"}
  </span>;
}

/** The scrolling message area, on a faint dotted background. */
export function MessageScroller({ scrollRef, onScroll, children }: { scrollRef: RefObject<HTMLDivElement | null>; onScroll: UIEventHandler<HTMLDivElement>; children: ReactNode }) {
  return <div
    ref={scrollRef}
    onScroll={onScroll}
    style={{ backgroundImage: "radial-gradient(rgba(63,110,243,0.09) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
    className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5"
  >{children}</div>;
}

/** Loading, error and "older messages" states above the list. */
export function ScrollerNotice({ state, onRetry, errorText, hasOlder, loadingOlder, onLoadOlder, empty }: {
  state: string;
  onRetry: () => void;
  errorText: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  empty: boolean;
}) {
  if (state === "loading") return <div className="flex justify-center py-10 text-blue-400"><Loader2 className="size-6 animate-spin" /></div>;
  if (state === "error") return <p className="mx-auto mt-6 w-fit rounded-2xl bg-white px-4 py-3 text-center text-sm text-red-600 shadow-sm">{errorText} <button type="button" onClick={onRetry} className="font-semibold underline">আবার চেষ্টা করো</button></p>;
  if (state !== "ready") return null;
  return <>
    {hasOlder ? <div className="mb-2 flex justify-center"><button type="button" disabled={loadingOlder} onClick={onLoadOlder} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-50">{loadingOlder ? "আনা হচ্ছে…" : "আগের message দেখো"}</button></div> : null}
    {empty ? <p className="mx-auto mt-6 w-fit max-w-[85%] rounded-2xl bg-[#fff7d6] px-4 py-2.5 text-center text-[13px] text-amber-900 shadow-sm">এখনো কোনো message নেই — প্রথমটা লেখো 👋</p> : null}
  </>;
}

/** "আজ" / "গতকাল" / date, shown where a new day starts. */
export function DayDivider({ date }: { date: string }) {
  return <div className="sticky top-0 z-10 my-3 flex justify-center">
    <span className="rounded-full bg-white/95 px-3 py-1 text-[11.5px] font-medium text-slate-600 shadow-sm backdrop-blur">{chatDayLabel(date)}</span>
  </div>;
}

/** Whether a day divider goes before message `index`. */
export const startsNewDay = (messages: Array<{ createdAt: string }>, index: number) => index === 0 || chatDayKey(messages[index - 1].createdAt) !== chatDayKey(messages[index].createdAt);

/**
 * One message bubble. `first` marks the start of a run from the same sender: it gets the corner
 * "tail" and more space above. My bubbles show ticks — a clock while sending, ✓ when saved, and a
 * blue ✓✓ once the other person has read it (1:1 chats only).
 */
export function Bubble({ mine, first, body, createdAt, pending, failed, seen, sender, onRetry }: {
  mine: boolean;
  first: boolean;
  body: string;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
  seen?: boolean;
  sender?: string | null;
  onRetry: () => void;
}) {
  return <div className={cn("flex flex-col", mine ? "items-end" : "items-start", first ? "mt-2.5" : "mt-0.5")}>
    <div className={cn(
      "relative max-w-[82%] rounded-2xl px-3 pb-1.5 pt-1.5 text-[15px] leading-snug shadow-[0_1px_1.5px_rgba(15,23,42,0.12)] sm:max-w-[70%]",
      mine ? "bg-linear-to-br from-[#3f6ef3] to-[#5a7ff6] text-white" : "bg-white text-slate-900",
      first && (mine ? "rounded-tr-md" : "rounded-tl-md"),
      pending && "opacity-70",
      failed && "bg-none bg-red-50 text-red-900 ring-1 ring-red-200",
    )}>
      {sender ? <p className="mb-0.5 text-[12.5px] font-semibold text-emerald-600">{sender}</p> : null}
      <p className="whitespace-pre-wrap break-words">
        {body}
        {/* Room for the time so it never sits on top of the last word. */}
        <span aria-hidden className="inline-block w-16" />
      </p>
      <span className={cn("absolute bottom-1 right-2.5 flex items-center gap-0.5 text-[10.5px] leading-none", mine && !failed ? "text-white/75" : "text-slate-400")}>
        {bubbleTime(createdAt)}
        {mine && !failed ? pending ? <Clock3 className="size-3" /> : seen ? <CheckCheck className="size-3.5 text-cyan-200" aria-label="দেখেছে" /> : <Check className="size-3.5" aria-label="পাঠানো হয়েছে" /> : null}
      </span>
    </div>
    {failed ? <button type="button" onClick={onRetry} className="mt-1 inline-flex items-center gap-1 px-1 text-[11.5px] font-medium text-red-600 hover:underline"><RotateCcw className="size-3" /> যায়নি — আবার পাঠাও</button> : null}
  </div>;
}

/** Centred grey line for group events ("X joined"). */
export function SystemLine({ children }: { children: ReactNode }) {
  return <p className="mx-auto my-2 w-fit max-w-[90%] rounded-full bg-white/90 px-3 py-1 text-center text-xs text-slate-500 shadow-sm">{children}</p>;
}

/** Rounded message box and round send button. Enter sends, Shift+Enter adds a line. */
export function Composer({ value, onChange, onSend, canSend, placeholder, maxLength }: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  canSend: boolean;
  placeholder: string;
  maxLength: number;
}) {
  return <form onSubmit={(event) => { event.preventDefault(); onSend(); }} className="flex shrink-0 items-end gap-2 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1.5 sm:px-4 lg:pb-3">
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onSend(); } }}
      rows={1}
      placeholder={placeholder}
      aria-label="Message"
      className="field-sizing-content max-h-32 min-h-12 flex-1 resize-none rounded-3xl bg-white px-4 py-3 text-[15px] leading-snug shadow-[0_1px_3px_rgba(15,23,42,0.12)] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-200"
    />
    <button type="submit" disabled={!canSend} aria-label="পাঠাও" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#3f6ef3] text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.8)] transition hover:bg-[#3461e0] active:scale-95 disabled:opacity-45"><Send className="size-5 -translate-x-px translate-y-px" /></button>
  </form>;
}

/** A grey bar in place of the box when sending isn't possible. */
export function ComposerNote({ children }: { children: ReactNode }) {
  return <p className="shrink-0 bg-white/80 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-center text-sm text-slate-500 lg:pb-3">{children}</p>;
}
