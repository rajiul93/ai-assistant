"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shareTypeLabel, type ShareType } from "@/lib/collaboration";
import { cn } from "@/lib/utils";
import { shareItem, shareTargets } from "@/server/actions/shares";
import { useLive } from "./live-provider";
import { errorMessage } from "@/lib/user-error";

/**
 * "Share" for a note, task, Preliminary set or Short Question set: pick friends, send. Each friend
 * gets a request and the item lands in their own section when they accept (a copy, not a link).
 */
export function ShareButton({ type, itemId, title, className, label = true }: { type: ShareType; itemId: string; title: string; className?: string; label?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`“${title}” share করো`} title="Friend-দের সাথে share করো" className={cn("flex items-center gap-1.5 rounded-lg text-sm font-medium transition", className)}>
      <Share2 className="size-4" />{label ? "Share" : null}
    </button>
    {open ? <ShareDialog type={type} itemId={itemId} title={title} onClose={() => setOpen(false)} /> : null}
  </>;
}

/** The dialog on its own, for opening from a menu that closes itself (task card). */
export function ShareDialog({ type, itemId, title, onClose }: { type: ShareType; itemId: string; title: string; onClose: () => void }) {
  const { refresh } = useLive();
  const targets = useQuery({ queryKey: ["share-targets", type, itemId], queryFn: () => shareTargets({ type, itemId }) });
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));

  async function send() {
    setSending(true);
    try {
      const result = await shareItem({ type, itemId, friendIds: picked });
      toast.success(result.sent ? `${result.sent} জনকে পাঠানো হলো — তারা নিলে তাদের ${shareTypeLabel[type]}-এ যোগ হবে` : "আগেই পাঠানো আছে, উত্তরের অপেক্ষায়");
      refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Share করা গেল না।"));
    } finally {
      setSending(false);
    }
  }

  return <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{shareTypeLabel[type]} share করো</DialogTitle></DialogHeader>
      <p className="truncate rounded-xl bg-zinc-50 px-3 py-2 text-sm font-medium">“{title}”</p>
      <p className="text-xs text-zinc-500">যাকে পাঠাবে সে গ্রহণ করলে তার নিজের কাছে একটা কপি যোগ হবে। পরে আপনি বদলালেও তার কপি বদলাবে না।</p>

      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {targets.isLoading ? [0, 1].map((index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-zinc-100" />) : null}
        {targets.isError ? <p className="text-sm text-red-600">Friend list আনা গেল না। <button type="button" onClick={() => void targets.refetch()} className="underline">আবার চেষ্টা করো</button></p> : null}
        {targets.data && !targets.data.length ? <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500">এখনো কোনো friend নেই। <Link href="/messages?add=friend" onClick={onClose} className="font-medium text-indigo-700 underline">Friend যোগ করো</Link></p> : null}
        {targets.data?.map((friend) => {
          const on = picked.includes(friend.id);
          return <button key={friend.id} type="button" disabled={friend.pending} onClick={() => toggle(friend.id)} aria-pressed={on} className={cn("flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition", on ? "border-indigo-400 bg-indigo-50" : "border-zinc-200 hover:border-zinc-300", friend.pending && "opacity-60")}>
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border-2", on ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300")}>{on ? <Check className="size-4" strokeWidth={3} /> : null}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{friend.name}</span>{friend.email ? <span className="block truncate text-xs text-zinc-500">{friend.email}</span> : null}</span>
            {friend.pending ? <span className="shrink-0 text-xs text-zinc-500">আগেই পাঠানো</span> : null}
          </button>;
        })}
      </div>

      <button type="button" onClick={() => void send()} disabled={sending || !picked.length} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} {picked.length ? `${picked.length} জনকে পাঠাও` : "Friend বেছে নাও"}
      </button>
    </DialogContent>
  </Dialog>;
}
