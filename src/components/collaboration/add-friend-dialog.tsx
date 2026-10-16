"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cancelFriendRequest, findUserByEmail, respondFriendRequest, sendFriendRequest } from "@/server/actions/friends";
import { ChatAvatar } from "./chat-ui";
import { useLive } from "./live-provider";
import { errorMessage } from "@/lib/user-error";

type Found = Awaited<ReturnType<typeof findUserByEmail>>;
const button = "flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-50";

/**
 * Find someone by their exact email and send a friend request. There is no separate friend list:
 * every friend already shows in the chat list.
 */
export function AddFriendDialog({ open, onOpenChange, onMessage }: { open: boolean; onOpenChange: (open: boolean) => void; onMessage: (friendId: string) => void }) {
  const queryClient = useQueryClient();
  const { refresh } = useLive();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => {
    for (const key of ["friends", "conversations", "notifications"]) void queryClient.invalidateQueries({ queryKey: [key] });
    refresh();
  };

  async function search() {
    if (!email.trim()) return;
    setSearching(true);
    try { setFound(await findUserByEmail(email)); } catch (error) { toast.error(errorMessage(error, "খোঁজা গেল না।")); } finally { setSearching(false); }
  }
  async function run(id: string, work: () => Promise<unknown>, done: string) {
    setBusy(id);
    try { await work(); toast.success(done); reload(); if (email.trim()) setFound(await findUserByEmail(email)); } catch (error) { toast.error(errorMessage(error, "করা গেল না।")); } finally { setBusy(null); }
  }

  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setEmail(""); setFound(null); } }}>
    <DialogContent>
      <DialogTitle className="mb-1">Friend যোগ করুন</DialogTitle>
      <p className="mb-4 text-sm text-slate-500">নিরাপত্তার জন্য পুরো email হুবহু মিললেই কাউকে পাওয়া যায়।</p>
      <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFound(null); }} placeholder="বন্ধুর পুরো email" aria-label="Email" autoFocus autoCapitalize="off" className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-3 text-[15px] outline-none focus:border-blue-300 focus:bg-white" />
        </label>
        <button type="submit" disabled={searching || !email.trim()} className={`${button} h-11 bg-blue-600 text-white hover:bg-blue-700`}>{searching ? <Loader2 className="size-4 animate-spin" /> : "খোঁজো"}</button>
      </form>

      {found ? <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        {!found.found ? <p className="text-sm text-slate-600">এই email-এ কোনো account পাওয়া যায়নি।</p>
          : found.self ? <p className="text-sm text-slate-600">এটা আপনার নিজের email।</p>
          : <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ChatAvatar name={found.person.name} image={found.person.image} className="size-11" />
              <p className="min-w-0 flex-1 truncate font-semibold">{found.person.name}</p>
            </div>
            {found.relation === "none" ? <button type="button" disabled={busy === "add"} onClick={() => void run("add", () => sendFriendRequest(found.person.id), "Friend request পাঠানো হলো")} className={`${button} w-full bg-blue-600 text-white hover:bg-blue-700`}><UserPlus className="size-4" /> Friend request পাঠাও</button> : null}
            {found.relation === "sent" && found.requestId ? <button type="button" disabled={busy === "add"} onClick={() => void run("add", () => cancelFriendRequest(found.requestId!), "Request তুলে নেওয়া হলো")} className={`${button} w-full bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100`}>Request পাঠানো আছে — তুলে নাও</button> : null}
            {found.relation === "received" && found.requestId ? <button type="button" disabled={busy === "add"} onClick={() => void run("add", () => respondFriendRequest(found.requestId!, true), "এখন আপনারা friend")} className={`${button} w-full bg-emerald-600 text-white hover:bg-emerald-700`}>উনি request পাঠিয়েছেন — গ্রহণ করো</button> : null}
            {found.relation === "friend" ? <button type="button" onClick={() => { onOpenChange(false); onMessage(found.person.id); }} className={`${button} w-full bg-white text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50`}><MessageCircle className="size-4" /> আগেই friend — message দাও</button> : null}
          </div>}
      </div> : null}
    </DialogContent>
  </Dialog>;
}
