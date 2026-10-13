"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendBankSetToPreliminary } from "@/server/actions/question-bank";

/**
 * "Preliminary-তে পাঠাও", or a link to the copy once it's there (one copy per set). Sending is a
 * paid feature: `locked` shows a lock and leads to Plans (the server refuses it anyway).
 */
export function SendToPreliminary({ setId, copyId, locked = false, className }: { setId: string; copyId: string | null; locked?: boolean; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sentId, setSentId] = useState(copyId);

  if (sentId) {
    return <Link href={`/preliminary/${sentId}`} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100", className)}>
      <Check className="size-4" /> Preliminary-তে আছে
    </Link>;
  }

  if (locked) {
    return <Link href="/billing" title="Preliminary-তে পাঠাতে একটা চালু plan লাগবে" className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-3.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100", className)}>
      <Lock className="size-4" /> Preliminary-তে পাঠাতে plan লাগবে
    </Link>;
  }

  async function send() {
    setBusy(true);
    try {
      const result = await sendBankSetToPreliminary(setId);
      setSentId(result.id);
      toast.success(result.alreadySent ? "এটা আগেই Preliminary-তে পাঠানো আছে" : "Preliminary-র Todo-তে যোগ হলো — সেখান থেকে পড়া আর exam", {
        action: { label: "দেখো", onClick: () => router.push("/preliminary?status=todo") },
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "পাঠানো গেল না।");
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" onClick={() => void send()} disabled={busy} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50", className)}>
    {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Preliminary-তে পাঠাও
  </button>;
}
