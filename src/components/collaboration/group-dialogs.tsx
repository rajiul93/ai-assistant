"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, LogOut, Pencil, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GROUP_MAX, GROUP_MIN, GROUP_NAME_MAX } from "@/lib/collaboration";
import { cn } from "@/lib/utils";
import { listFriendsOverview } from "@/server/actions/friends";
import { addGroupMembers, createGroup, groupDetails, leaveGroup, removeGroupMember, renameGroup } from "@/server/actions/groups";

const refreshKeys = ["groups", "group", "live", "notifications"];

/** Tick friends to add; people already in the group are left out. */
function FriendPicker({ exclude, picked, onToggle, limit }: { exclude: Set<string>; picked: Set<string>; onToggle: (id: string) => void; limit: number }) {
  const friends = useQuery({ queryKey: ["friends"], queryFn: () => listFriendsOverview() });
  const list = (friends.data?.friends ?? []).filter((friend) => !exclude.has(friend.id));
  if (friends.isLoading) return <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />;
  if (!list.length) return <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">যোগ করার মতো কোনো friend নেই। আগে Messages-এর উপরে “Friend” চেপে friend যোগ করুন।</p>;
  return <ul className="max-h-72 space-y-1 overflow-y-auto">
    {list.map((friend) => {
      const on = picked.has(friend.id);
      const full = !on && picked.size >= limit;
      return <li key={friend.id}>
        <button type="button" disabled={full} onClick={() => onToggle(friend.id)} aria-pressed={on} className={cn("flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition disabled:opacity-40", on ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300")}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">{friend.initial}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{friend.name}</span>
          <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", on ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300")}>{on ? <Check className="size-3.5" /> : null}</span>
        </button>
      </li>;
    })}
  </ul>;
}

function useToggleSet() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return { picked, toggle, reset: () => setPicked(new Set()) };
}

/** Name the group and tick at least two friends. */
export function CreateGroupDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (groupId: string) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { picked, toggle, reset } = useToggleSet();
  const [busy, setBusy] = useState(false);
  const enough = picked.size >= GROUP_MIN - 1;

  async function create() {
    setBusy(true);
    try {
      const id = await createGroup({ name, memberIds: [...picked] });
      for (const key of refreshKeys) void queryClient.invalidateQueries({ queryKey: [key] });
      toast.success("গ্রুপ তৈরি হলো");
      setName(""); reset();
      onOpenChange(false);
      onCreated(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "গ্রুপ বানানো গেল না।");
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogTitle className="mb-4">নতুন গ্রুপ</DialogTitle>
      <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="space-y-4">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={GROUP_NAME_MAX} placeholder="গ্রুপের নাম (যেমন: ৪৭তম BCS পড়ার দল)" aria-label="গ্রুপের নাম" required />
        <div>
          <p className="mb-2 text-sm text-zinc-600">Friend বেছে নিন — অন্তত {GROUP_MIN - 1} জন, সর্বোচ্চ {GROUP_MAX - 1} জন ({picked.size} জন বাছা হয়েছে)</p>
          <FriendPicker exclude={new Set()} picked={picked} onToggle={toggle} limit={GROUP_MAX - 1} />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !name.trim() || !enough}>{busy ? "বানানো হচ্ছে…" : "গ্রুপ বানাও"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

type Confirm = { kind: "leave" } | { kind: "remove"; userId: string; name: string };

/** Members, and for the admin: rename, add, remove. Anyone can leave. */
export function GroupInfoDialog({ groupId, open, onOpenChange, onLeft }: { groupId: string; open: boolean; onOpenChange: (open: boolean) => void; onLeft: () => void }) {
  const queryClient = useQueryClient();
  const details = useQuery({ queryKey: ["group", groupId], queryFn: () => groupDetails(groupId), enabled: open });
  const [mode, setMode] = useState<"view" | "rename" | "add">("view");
  const [name, setName] = useState("");
  const { picked, toggle, reset } = useToggleSet();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const group = details.data;

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      for (const key of refreshKeys) void queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(done);
      setMode("view"); reset();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "করা গেল না।");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmed() {
    if (!confirm) return;
    if (confirm.kind === "leave") {
      if (await run(() => leaveGroup(groupId), "গ্রুপ ছেড়ে দিয়েছেন")) { onOpenChange(false); onLeft(); }
    } else {
      await run(() => removeGroupMember({ groupId, userId: confirm.userId }), "বাদ দেওয়া হলো");
    }
    setConfirm(null);
  }

  return <>
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setMode("view"); reset(); } }}>
      <DialogContent>
        {details.isLoading ? <div className="h-40 animate-pulse rounded-xl bg-zinc-100" /> : null}
        {details.data === null ? <p className="py-6 text-center text-sm text-zinc-500">আপনি আর এই গ্রুপে নেই।</p> : null}
        {group ? <div className="space-y-4">
          {mode === "rename" ? <form onSubmit={(event) => { event.preventDefault(); void run(() => renameGroup({ groupId, name }), "নাম বদলানো হলো"); }} className="flex gap-2 pr-8">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={GROUP_NAME_MAX} aria-label="গ্রুপের নতুন নাম" autoFocus required />
            <Button type="submit" disabled={busy || !name.trim()}>সেভ</Button>
          </form> : <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="min-w-0 truncate">{group.name}</DialogTitle>
            {group.isAdmin ? <button type="button" onClick={() => { setName(group.name); setMode("rename"); }} aria-label="গ্রুপের নাম বদলাও" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><Pencil className="size-4" /></button> : null}
          </div>}

          {mode === "add" ? <div className="space-y-3">
            <p className="text-sm text-zinc-600">কাকে যোগ করবেন? ({picked.size} জন বাছা হয়েছে)</p>
            <FriendPicker exclude={new Set(group.members.map((member) => member.id))} picked={picked} onToggle={toggle} limit={GROUP_MAX - group.members.length} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setMode("view"); reset(); }}>বাতিল</Button>
              <Button className="flex-1" disabled={busy || !picked.size} onClick={() => void run(() => addGroupMembers({ groupId, memberIds: [...picked] }), "যোগ করা হলো")}>যোগ করো</Button>
            </div>
          </div> : <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">সদস্য {group.members.length} জন</p>
              {group.isAdmin && group.members.length < GROUP_MAX ? <Button size="sm" variant="outline" onClick={() => setMode("add")}><UserPlus /> সদস্য যোগ</Button> : null}
            </div>
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {group.members.map((member) => <li key={member.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-50">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">{member.initial}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{member.name}{member.me ? " (আপনি)" : ""}</span>
                  {member.role === "ADMIN" ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700"><Crown className="size-3" /> Admin</span> : null}
                </span>
                {group.isAdmin && !member.me ? <button type="button" disabled={busy} onClick={() => setConfirm({ kind: "remove", userId: member.id, name: member.name })} aria-label={`${member.name}-কে বাদ দাও`} className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"><UserMinus className="size-4" /></button> : null}
              </li>)}
            </ul>
            <Button variant="outline" className="w-full text-red-600 hover:text-red-700" disabled={busy} onClick={() => setConfirm({ kind: "leave" })}><LogOut /> গ্রুপ ছেড়ে দিন</Button>
          </>}
        </div> : null}
      </DialogContent>
    </Dialog>

    <AlertDialog open={Boolean(confirm)} onOpenChange={(next) => { if (!next) setConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogTitle>{confirm?.kind === "leave" ? "গ্রুপ ছেড়ে দেবেন?" : `${confirm?.kind === "remove" ? confirm.name : ""}-কে বাদ দেবেন?`}</AlertDialogTitle>
        <AlertDialogDescription>
          {confirm?.kind === "leave"
            ? "ছেড়ে দিলে এই গ্রুপের message আর দেখতে পাবেন না। আবার ঢুকতে হলে admin-কে যোগ করতে হবে।"
            : "বাদ দিলে তিনি এই গ্রুপের message আর দেখতে পাবেন না।"}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>না</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirmed()}>{confirm?.kind === "leave" ? "ছেড়ে দিন" : "বাদ দিন"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
