"use client";

import { cn } from "@/lib/utils";

/** Animated bars that show the mic is live. */
export function VoiceWave({ className, barClassName }: { className?: string; barClassName?: string }) {
  return <span aria-hidden className={cn("inline-flex h-4 items-center gap-[3px]", className)}>
    {[0, 0.15, 0.3, 0.1, 0.25].map((delay, index) => <span key={index} className={cn("voice-bar h-full w-[3px] rounded-full bg-current", barClassName)} style={{ animationDelay: `${delay}s` }} />)}
  </span>;
}
