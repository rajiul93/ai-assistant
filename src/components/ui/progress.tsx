import * as React from "react";
import { cn } from "@/lib/utils";

function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  /** The filled part's colour; dark by default. */
  barClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-100", className)}>
      <div
        className={cn("h-full rounded-full bg-zinc-950 transition-[width]", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
