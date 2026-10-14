"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Search, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cancelFriendRequest, findUserByEmail, listFriendsOverview, removeFriend, respondFriendRequest, sendFriendRequest } from "@/server/actions/friends";
import { useLive } from "./live-provider";

type Found = Awaited<ReturnType<typeof findUserByEmail>>;
const button = "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:opacity-50";

/** Add a friend by their exact email, and the friend list (message or remove). */
export function FriendsPanel({ onMessage }: { onMessage: (friendId: string) => void }) {
  const queryClient = useQueryClient();
  const { refresh } = useLive();
  const friends = useQuery({ queryKey: ["friends"], queryFn: () => listFriendsOverview() });
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
    try { setFound(await findUserByEmail(email)); } catch (error) { toast.error(error instanceof Error ? error.message : "খোঁজা গেল না।"); } finally { setSearching(false); }
  }
  async function run(id: string, work: () => Promise<unknown>, done: string) {
    setBusy(id);
    try { await work(); toast.success(done); reload(); if (email.trim()) setFound(await findUserByEmail(email)); } catch (error) { toast.error(error instanceof Error ? error.message : "করা গেল না।"); } finally { setBusy(null); }
  }

  return <div className="space-y-5">
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <h3 className="font-semibold">Friend যোগ করো</h3>
      <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFound(null); }} placeholder="বন্ধুর পুরো email লেখো" aria-label="Email" className="h-11 w-full rounded-xl border border-zinc-200 pl-9 pr-3 text-sm outline-none focus:border-zinc-400" autoCapitalize="off" />
        </label>
        <button type="submit" disabled={searching || !email.trim()} className={`${button} h-11 bg-zinc-950 text-white hover:bg-zinc-800`}>{searching ? <Loader2 className="size-4 animate-spin" /> : "খোঁজো"}</button>
      </form>
      <p className="text-xs text-zinc-500">নিরাপত্তার জন্য শুধু পুরো email হুবহু মিললেই কাউকে পাওয়া যায়।</p>

      {found ? <div className="rounded-xl bg-zinc-50 p-3">
        {!found.found ? <p className="text-sm text-zinc-600">এই email-এ কোনো account পাওয়া যায়নি।</p>
          : found.self ? <p className="text-sm text-zinc-600">এটা আপনার নিজের email।</p>
          : <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-800">{found.person.initial}</span>
            <p className="min-w-0 flex-1 font-semibold">{found.person.name}</p>
            {found.relation === "none" ? <button type="button" disabled={busy === "add"} onClick={() => void run("add", () => sendFriendRequest(found.person.id), "Friend request পাঠানো হলো")} className={`${button} bg-indigo-600 text-white hover:bg-indigo-700`}><UserPlus className="size-4" /> Friend request পাঠাও</button> : null}
            {found.relation === "sent" && found.requestId ? <button type="button" disabled={busy === "add"} onClick={() => void run("add", () => cancelFriendRequest(found.requestId!), "Request তুলে নেওয়া হলো")} className={`${button} text-zinc-700 ring-1 ring-zinc-200 hover:bg-white`}>Request পাঠানো আছে — তুলে নাও</button> : null}
            {found.relation === "received" && found.requestId ? <button type="button" disabled={busy === "add"} onClick={() => void run("add", () => respondFriendRequest(found.requestId!, true), "এখন আপনারা friend")} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>উনি request পাঠিয়েছেন — গ্রহণ করো</button> : null}
            {found.relation === "friend" ? <button type="button" onClick={() => onMessage(found.person.id)} className={`${button} text-indigo-700 ring-1 ring-indigo-200 hover:bg-white`}><MessageCircle className="size-4" /> আগেই friend — message দাও</button> : null}
          </div>}
      </div> : null}
    </section>

    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-600">আপনার friend {friends.data ? `(${friends.data.friends.length})` : ""}</h3>
      {friends.isLoading ? <div className="space-y-2">{[0, 1].map((index) => <div key={index} className="h-14 animate-pulse rounded-2xl bg-zinc-100" />)}</div> : null}
      {friends.isError ? <p className="text-sm text-red-600">আনা গেল না। <button type="button" onClick={() => void friends.refetch()} className="underline">আবার চেষ্টা করো</button></p> : null}
      {friends.data && !friends.data.friends.length ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">এখনো কোনো friend নেই — উপরে email দিয়ে খুঁজে request পাঠাও।</p> : null}
      {friends.data?.friends.map((friend) => <div key={friend.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-800">{friend.initial}</span>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{friend.name}</p>{friend.email ? <p className="truncate text-xs text-zinc-500">{friend.email}</p> : null}</div>
        <button type="button" onClick={() => onMessage(friend.id)} aria-label={`${friend.name}-কে message দাও`} className={`${button} text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50`}><MessageCircle className="size-4" /><span className="hidden sm:inline">Message</span></button>
        <button type="button" disabled={busy === friend.id} onClick={() => { if (window.confirm(`${friend.name}-কে friend list থেকে সরাবে? পুরনো chat পড়া যাবে, নতুন message পাঠানো যাবে না।`)) void run(friend.id, () => removeFriend(friend.id), "Friend list থেকে সরানো হলো"); }} aria-label={`${friend.name}-কে সরাও`} className={`${button} text-zinc-500 hover:bg-red-50 hover:text-red-700`}><UserMinus className="size-4" /></button>
      </div>)}
    </section>
  </div>;
}
