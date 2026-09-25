"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { assistantStrings } from "@/lib/assistant-i18n";
import { useAssistantStore } from "@/store/assistant";

/** Animated bars that show the mic is live. */
export function VoiceWave({ className, barClassName }: { className?: string; barClassName?: string }) {
  return <span aria-hidden className={cn("inline-flex h-4 items-center gap-[3px]", className)}>
    {[0, 0.15, 0.3, 0.1, 0.25].map((delay, index) => <span key={index} className={cn("voice-bar h-full w-[3px] rounded-full bg-current", barClassName)} style={{ animationDelay: `${delay}s` }} />)}
  </span>;
}

function useSecondsSince(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [since]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

/** Floating status that tells the user whether the assistant is hearing them, working, or done. */
export function AssistantStatus({ systemListening }: { systemListening: boolean }) {
  const live = useAssistantStore((state) => state.live);
  const t = assistantStrings[useAssistantStore((state) => state.lang)];
  const seconds = useSecondsSince(live?.stage === "thinking" ? live.since : null);

  let indicator: React.ReactNode;
  let title: string;
  let detail: string | null = null;
  let tone = "text-zinc-900";

  if (live?.stage === "listening" || (!live && systemListening)) {
    indicator = <span className="flex size-7 items-center justify-center rounded-full bg-rose-500/10 text-rose-600"><VoiceWave className="h-3.5" /></span>;
    title = t.listening;
    detail = live?.text ? `“${live.text}”` : t.listeningIdle;
  } else if (live?.stage === "thinking") {
    indicator = <span className="relative flex size-7 items-center justify-center"><span className="assistant-orb absolute inset-0 rounded-full opacity-90 blur-[1px]" /><span className="relative size-4 rounded-full bg-white/90" /></span>;
    title = t.thinking(seconds);
    detail = seconds >= 8 ? t.slowHint : `“${live.text}”`;
  } else if (live?.stage === "result") {
    const ok = live.tone === "ok";
    indicator = <span className={cn("flex size-7 items-center justify-center rounded-full", ok ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>{ok ? <Check className="size-4" strokeWidth={2.5} /> : <AlertTriangle className="size-4" />}</span>;
    title = live.text;
    tone = ok ? "text-zinc-900" : "text-amber-900";
  } else {
    return null;
  }

  return <div role="status" aria-live="polite" key={live?.stage === "result" ? `result-${title}` : (live?.stage ?? "listening")} className={cn(
    "assistant-in fixed left-1/2 top-[calc(4.25rem+env(safe-area-inset-top))] z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-200/80 bg-white/85 py-1.5 pl-1.5 pr-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:top-16",
    tone,
  )}>
    {indicator}
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium leading-tight">{title}</p>
      {detail ? <p className="max-w-[min(28rem,calc(100vw-7rem))] truncate text-xs leading-tight text-zinc-500">{detail}</p> : null}
    </div>
  </div>;
}
