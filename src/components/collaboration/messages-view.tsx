"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, UsersRound } from "lucide-react";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { listGroups } from "@/server/actions/groups";
import { listConversations } from "@/server/actions/messages";
import { ChatPanel } from "./chat-panel";
import { FriendsPanel } from "./friends-panel";
import { GroupChatPanel } from "./group-chat-panel";
import { CreateGroupDialog } from "./group-dialogs";
import { useLive } from "./live-provider";
import { RequestsPanel } from "./requests-panel";

const tabs = [
  { id: "chats", label: "Chats" },
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
] as const;
type Tab = (typeof tabs)[number]["id"];

/** /messages: chats with friends and groups, the friend list, and requests waiting for an answer. */
export function MessagesView({ me }: { me: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { counts, status } = useLive();
  const wanted = searchParams.get("tab");
  const tab: Tab = tabs.some((item) => item.id === wanted) ? (wanted as Tab) : "chats";
  const withId = searchParams.get("with");
  const groupId = searchParams.get("group");
  const [creating, setCreating] = useState(false);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    // Socket events refresh this list; without a socket, poll it.
    refetchInterval: status === "live" ? false : 20_000,
  });
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => listGroups(), refetchInterval: status === "live" ? false : 20_000 });
  const go = (next: { tab?: Tab; with?: string | null; group?: string | null }) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    if (next.with) params.set("with", next.with);
    if (next.group) params.set("group", next.group);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };
  const onRead = useCallback(() => { for (const key of ["conversations", "groups"]) void queryClient.invalidateQueries({ queryKey: [key] }); }, [queryClient]);

  const entries = conversations.data ?? [];
  const groupEntries = groups.data ?? [];
  const selected = withId ? entries.find((entry) => entry.person.id === withId) : null;
  const selectedGroup = groupId ? groupEntries.find((group) => group.id === groupId) : null;
  const open = Boolean(selected || selectedGroup);
  // One list, newest activity first: 1:1 chats and groups together.
  const list = [
    ...entries.map((entry) => ({ kind: "person" as const, at: entry.lastMessage?.createdAt.getTime() ?? 0, entry })),
    ...groupEntries.map((group) => ({ kind: "group" as const, at: group.activityAt.getTime(), group })),
  ].sort((a, b) => b.at - a.at);

  return <div className="mx-auto max-w-5xl space-y-4">
    <div className={cn(open && "hidden lg:block")}>
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-zinc-500">Friend-দের সাথে chat, আর note, task, প্রশ্নের set share।</p>
    </div>

    <div role="tablist" aria-label="Messages" className={cn("grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100 p-1", open && "hidden lg:grid")}>
      {tabs.map((item) => {
        const badge = item.id === "chats" ? counts.messagesUnread : item.id === "requests" ? counts.pendingRequests : 0;
        return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => go({ tab: item.id })} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition", tab === item.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>
          {item.label}
          {badge ? <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{badge}</span> : null}
        </button>;
      })}
    </div>

    {tab === "friends" ? <FriendsPanel onMessage={(friendId) => go({ tab: "chats", with: friendId })} /> : null}
    {tab === "requests" ? <RequestsPanel /> : null}

    {tab === "chats" ? <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className={cn("space-y-1.5", open && "hidden lg:block")}>
        <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white p-2.5 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:text-zinc-950"><Plus className="size-4" /> নতুন গ্রুপ</button>
        {conversations.isLoading ? [0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />) : null}
        {conversations.isError ? <p className="text-sm text-red-600">আনা গেল না। <button type="button" onClick={() => void conversations.refetch()} className="underline">আবার চেষ্টা করো</button></p> : null}
        {conversations.data && groups.data && !list.length ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          <MessageCircle className="mx-auto mb-2 size-8 text-zinc-300" />
          এখনো কোনো friend নেই। <button type="button" onClick={() => go({ tab: "friends" })} className="font-medium text-indigo-700 underline">Friend যোগ করো</button>
        </div> : null}
        {list.map((item) => item.kind === "group" ? <button key={`g-${item.group.id}`} type="button" onClick={() => go({ group: item.group.id })} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition", groupId === item.group.id ? "border-zinc-950 bg-white ring-1 ring-zinc-950" : "border-zinc-200 bg-white hover:border-zinc-300")}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><UsersRound className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><span className="truncate font-semibold">{item.group.name}</span><span className="shrink-0 text-[10px] text-zinc-400">{item.group.memberCount} জন</span></span>
            <span className={cn("block truncate text-xs", item.group.unread ? "font-semibold text-zinc-900" : "text-zinc-500")}>{item.group.lastMessage ? `${item.group.lastMessage.mine ? "আপনি: " : item.group.lastMessage.senderName ? `${item.group.lastMessage.senderName}: ` : ""}${item.group.lastMessage.body}` : "এখনো কোনো message নেই"}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            {item.group.lastMessage ? <span className="text-[10px] text-zinc-400">{formatDateTime(item.group.lastMessage.createdAt)}</span> : null}
            {item.group.unread ? <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{item.group.unread}</span> : null}
          </span>
        </button> : (({ entry }) => <button key={entry.person.id} type="button" onClick={() => go({ with: entry.person.id })} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition", withId === entry.person.id ? "border-zinc-950 bg-white ring-1 ring-zinc-950" : "border-zinc-200 bg-white hover:border-zinc-300")}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-800">{entry.person.initial}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><span className="truncate font-semibold">{entry.person.name}</span>{!entry.isFriend ? <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] text-zinc-500">পুরনো</span> : null}</span>
            <span className={cn("block truncate text-xs", entry.unread ? "font-semibold text-zinc-900" : "text-zinc-500")}>{entry.lastMessage ? `${entry.lastMessage.mine ? "আপনি: " : ""}${entry.lastMessage.body}` : "এখনো কোনো message নেই"}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            {entry.lastMessage ? <span className="text-[10px] text-zinc-400">{formatDateTime(entry.lastMessage.createdAt)}</span> : null}
            {entry.unread ? <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{entry.unread}</span> : null}
          </span>
        </button>)(item))}
      </aside>

      {selectedGroup ? <GroupChatPanel key={selectedGroup.id} me={me} groupId={selectedGroup.id} initialName={selectedGroup.name} onBack={() => go({ group: null })} onRead={onRead} onLeft={() => go({ group: null })} />
        : selected ? <ChatPanel key={selected.person.id} me={me} friend={selected.person} isFriend={selected.isFriend} conversationId={selected.conversationId} onBack={() => go({ with: null })} onRead={onRead} />
        : <div className="hidden items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white text-sm text-zinc-500 lg:flex">বাঁ দিক থেকে একজনকে বেছে নাও।</div>}
    </div> : null}
    <CreateGroupDialog open={creating} onOpenChange={setCreating} onCreated={(id) => go({ tab: "chats", group: id })} />
  </div>;
}
