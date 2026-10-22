"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleHelp, Loader2, Send, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { chatTargets, questionToChat, questionToConfusion } from "@/server/actions/question-share";

type Mode = "confusion" | "chat";

/** Under a Preliminary question: note it in Confusion, or ask friends / a group about it. */
export function QuestionShareActions({ questionId }: { questionId: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  return <>
    <button type="button" onClick={() => setMode("confusion")} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50"><CircleHelp className="size-3.5" /> Confusion-এ রাখো</button>
    <button type="button" onClick={() => setMode("chat")} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"><Send className="size-3.5" /> Message-এ পাঠাও</button>
    {mode ? <QuestionShareDialog mode={mode} questionId={questionId} onClose={() => setMode(null)} /> : null}
  </>;
}

function QuestionShareDialog({ mode, questionId, onClose }: { mode: Mode; questionId: string; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const targets = useQuery({ queryKey: ["chat-targets"], queryFn: () => chatTargets(), enabled: mode === "chat" });
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  const friends = targets.data?.friends ?? [];
  const groups = targets.data?.groups ?? [];
  const picked = friendIds.length + groupIds.length;

  async function save() {
    setBusy(true);
    try {
      if (mode === "confusion") {
        await questionToConfusion({ questionId, note: note || undefined });
        toast.success("Confusion-এ রাখা হলো", { action: { label: "দেখো", onClick: () => router.push("/confusions") } });
      } else {
        const { sent } = await questionToChat({ questionId, note: note || undefined, friendIds, groupIds });
        toast.success(`${sent} জায়গায় পাঠানো হলো`, { action: { label: "Messages", onClick: () => router.push("/messages") } });
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, mode === "confusion" ? "Confusion-এ রাখা গেল না।" : "পাঠানো গেল না।"));
    } finally {
      setBusy(false);
    }
  }

  const row = (on: boolean) => cn("flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition", on ? "bg-indigo-50 ring-1 ring-indigo-300" : "hover:bg-zinc-50");
  const tick = (on: boolean) => <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full ring-1", on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white ring-zinc-300")}>{on ? <Check className="size-3.5" strokeWidth={3} /> : null}</span>;

  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
      <DialogHeader className="space-y-0 px-5 pb-3 pt-5">
        <DialogTitle className="text-lg">{mode === "confusion" ? "Confusion-এ রাখো" : "Message-এ পাঠাও"}</DialogTitle>
        <p className="pt-1 text-sm text-zinc-500">{mode === "confusion"
          ? "প্রশ্ন, option আর সঠিক উত্তর এই set-এর subject ও topic-এ Confusion হিসেবে জমা হবে।"
          : "প্রশ্ন, option আর সঠিক উত্তর message হিসেবে যাবে। সমাধান/ব্যাখ্যা যাবে না।"}</p>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-3">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={2}
          placeholder={mode === "confusion" ? "কোথায় বুঝছ না? (না লিখলেও চলবে)" : "কী জানতে চাও? (না লিখলেও চলবে)"}
          className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />

        {mode === "chat" ? <>
          {targets.isLoading ? <p className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> লোড হচ্ছে…</p> : null}
          {targets.data && !friends.length && !groups.length ? <p className="py-6 text-center text-sm text-zinc-500">এখনো কোনো friend বা group নেই। <Link href="/messages?add=friend" className="font-medium text-indigo-600 underline" onClick={onClose}>Friend যোগ করো</Link></p> : null}
          {friends.length ? <section>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500"><UserRound className="size-3.5" /> Friends</p>
            {friends.map((friend) => { const on = friendIds.includes(friend.id); return <button key={friend.id} type="button" onClick={() => setFriendIds((list) => toggle(list, friend.id))} className={row(on)}>
              {tick(on)}<span className="min-w-0 truncate text-sm font-medium text-zinc-900">{friend.name}</span>
            </button>; })}
          </section> : null}
          {groups.length ? <section>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500"><Users className="size-3.5" /> Groups</p>
            {groups.map((group) => { const on = groupIds.includes(group.id); return <button key={group.id} type="button" onClick={() => setGroupIds((list) => toggle(list, group.id))} className={row(on)}>
              {tick(on)}<span className="min-w-0 truncate text-sm font-medium text-zinc-900">{group.name}</span>
            </button>; })}
          </section> : null}
        </> : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">
        <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-xl px-4 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50">বাতিল</button>
        <button type="button" onClick={() => void save()} disabled={busy || (mode === "chat" && !picked)} className="flex h-10 items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : mode === "confusion" ? <CircleHelp className="size-4" /> : <Send className="size-4" />}
          {mode === "confusion" ? "রাখো" : picked ? `পাঠাও (${picked})` : "পাঠাও"}
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}
