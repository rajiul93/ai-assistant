"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A calm fallback instead of a raw error screen; the menu stays usable around it. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
      <p className="text-4xl" aria-hidden>😕</p>
      <h1 className="text-lg font-semibold">Something went wrong on this page</h1>
      <p className="text-sm text-zinc-500">কিছু একটা গোলমাল হয়েছে। আবার চেষ্টা করো — না হলে অন্য পাতায় গিয়ে ফিরে এসো।</p>
      <Button onClick={reset} className="gap-2"><RotateCcw className="size-4" /> Try again</Button>
      {error.digest ? <p className="text-xs text-zinc-400">Error code: {error.digest}</p> : null}
    </div>
  );
}
