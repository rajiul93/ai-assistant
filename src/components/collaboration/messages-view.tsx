"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Search, UserPlus, UsersRound } from "lucide-react";
import { chatListTime } from "@/lib/chat-time";
import { cn } from "@/lib/utils";
import { listGroups } from "@/server/actions/groups";
import { listConversations } from "@/server/actions/messages";
import { AddFriendDialog } from "./add-friend-dialog";
import { ChatPanel } from "./chat-panel";
import { ChatAvatar } from "./chat-ui";
import { GroupChatPanel } from "./group-chat-panel";
import { CreateGroupDialog } from "./group-dialogs";
import { useLive } from "./live-provider";
import { RequestsPanel } from "./requests-panel";

const tabs = [
  { id: "chats", label: "Chats" },
  { id: "requests", label: "Requests" },
] as const;
type Tab = (typeof tabs)[number]["id"];

const headerButton = "flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 text-[13px] font-semibold ring-1 ring-white/30 transition hover:bg-white/30 active:scale-95";

type Filter = "all" | "unread" | "groups";

/** The chip row: three chat filters, then friend requests and shares waiting for an answer. */
const chips: Array<{ id: string; label: string; tab: Tab; filter?: Filter }> = [
  { id: "all", label: "সব", tab: "chats", filter: "all" },
  { id: "unread", label: "Unread", tab: "chats", filter: "unread" },
  { id: "groups", label: "গ্রুপ", tab: "chats", filter: "groups" },
  { id: "requests", label: "Requests", tab: "requests" },
];

/**
 * /messages: chats with friends and groups, and requests waiting for an answer. Every friend is in
 * the chat list (a chat can start with any of them), so there is no separate friend list; adding a
 * friend is a dialog, removing one is in that chat's menu.
 */
export function MessagesView({ me }: { me: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { counts, status } = useLive();
  const wanted = searchParams.get("tab");
  const tab: Tab = tabs.some((item) => item.id === wanted) ? (wanted as Tab) : "chats";
  // Old links (?tab=friends) and "add a friend" links open the dialog.
  const [addingFriend, setAddingFriend] = useState(() => wanted === "friends" || searchParams.get("add") === "friend");
  const withId = searchParams.get("with");
  const groupId = searchParams.get("group");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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

  const term = search.trim().toLowerCase();
  const shown = list.filter((item) => {
    const name = item.kind === "group" ? item.group.name : item.entry.person.name;
    const unread = item.kind === "group" ? item.group.unread : item.entry.unread;
    if (term && !name.toLowerCase().includes(term)) return false;
    return filter === "unread" ? unread > 0 : filter === "groups" ? item.kind === "group" : true;
  });
  const loading = conversations.isLoading || groups.isLoading;

  return <div className="mx-auto max-w-5xl space-y-3">
    {/* One slim header in the home page's blue: title, the two "add" actions, and search. */}
    <section className={cn("rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)]", open && "hidden lg:block")}>
      <div className="flex items-center gap-2 pl-1">
        <h1 className="min-w-0 flex-1 text-xl font-bold tracking-tight">Messages</h1>
        <button type="button" onClick={() => setAddingFriend(true)} className={headerButton}><UserPlus className="size-4" /> Friend</button>
        <button type="button" onClick={() => setCreating(true)} className={headerButton}><UsersRound className="size-4" /> গ্রুপ</button>
      </div>
      {tab === "chats" ? <label className="relative mt-2.5 block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নাম দিয়ে খুঁজুন" aria-label="Chat খুঁজুন" className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/30" />
      </label> : null}
    </section>

    {/* Chat filters and Requests in one chip row, as WhatsApp does. */}
    <nav aria-label="Messages" className={cn("-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:px-0", open && "hidden lg:flex")}>
      {chips.map((chip, index) => {
        const active = tab === chip.tab && (chip.tab !== "chats" || filter === chip.filter);
        const badge = chip.id === "unread" ? counts.messagesUnread : chip.id === "requests" ? counts.pendingRequests : 0;
        return <Fragment key={chip.id}>
          {index === 3 ? <span aria-hidden className="h-5 w-px shrink-0 bg-slate-300" /> : null}
          <button type="button" aria-pressed={active} onClick={() => { if (chip.filter) setFilter(chip.filter); if (chip.tab !== tab) go({ tab: chip.tab }); }} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition", active ? "bg-blue-600 text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)] hover:text-slate-900")}>
            {chip.label}
            {badge ? <span className={cn("min-w-4.5 rounded-full px-1 text-center text-[10.5px] font-bold leading-4.5", active ? "bg-white text-blue-700" : "bg-blue-600 text-white")}>{badge}</span> : null}
          </button>
        </Fragment>;
      })}
    </nav>

    {tab === "requests" ? <RequestsPanel /> : null}

    {tab === "chats" ? <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <aside className={cn(open && "hidden lg:block")}>
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
          {loading ? [0, 1, 2].map((index) => <div key={index} className="flex items-center gap-3 px-4 py-3"><span className="size-12 animate-pulse rounded-full bg-slate-100" /><span className="h-9 flex-1 animate-pulse rounded-xl bg-slate-100" /></div>) : null}
          {conversations.isError || groups.isError ? <p className="px-4 py-6 text-center text-sm text-red-600">আনা গেল না। <button type="button" onClick={() => { void conversations.refetch(); void groups.refetch(); }} className="font-semibold underline">আবার চেষ্টা করো</button></p> : null}
          {conversations.data && groups.data && !list.length ? <div className="px-4 py-10 text-center text-sm text-slate-500">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-blue-50"><MessageCircle className="size-7 text-blue-500" /></span>
            এখনো কোনো chat নেই।<br /><button type="button" onClick={() => setAddingFriend(true)} className="mt-1 font-semibold text-blue-700">Friend যোগ করুন →</button>
          </div> : null}
          {list.length && !shown.length ? <p className="px-4 py-8 text-center text-sm text-slate-500">{term ? `“${search.trim()}” নামে কোনো chat নেই।` : filter === "unread" ? "সব message পড়া হয়ে গেছে 🎉" : "এখনো কোনো গ্রুপ নেই।"}</p> : null}
          <ul className="divide-y divide-slate-100">
            {shown.map((item) => {
              const row = item.kind === "group"
                ? { key: `g-${item.group.id}`, name: item.group.name, image: null, group: true, active: groupId === item.group.id, unread: item.group.unread, extra: `${item.group.memberCount} জন`, last: item.group.lastMessage, prefix: item.group.lastMessage ? (item.group.lastMessage.mine ? "আপনি: " : item.group.lastMessage.senderName ? `${item.group.lastMessage.senderName}: ` : "") : "", onOpen: () => go({ group: item.group.id }) }
                : { key: item.entry.person.id, name: item.entry.person.name, image: item.entry.person.image, group: false, active: withId === item.entry.person.id, unread: item.entry.unread, extra: item.entry.isFriend ? null : "পুরনো", last: item.entry.lastMessage, prefix: item.entry.lastMessage?.mine ? "আপনি: " : "", onOpen: () => go({ with: item.entry.person.id }) };
              return <li key={row.key}>
                <button type="button" onClick={row.onOpen} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-100", row.active ? "bg-blue-50" : "hover:bg-slate-50")}>
                  <ChatAvatar name={row.name} image={row.image} group={row.group} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[15.5px] font-semibold text-slate-900">{row.name}</span>
                      {row.extra ? <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{row.extra}</span> : null}
                      <span className={cn("ml-auto shrink-0 text-[11.5px]", row.unread ? "font-semibold text-blue-600" : "text-slate-400")}>{row.last ? chatListTime(row.last.createdAt) : ""}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", row.unread ? "font-medium text-slate-800" : "text-slate-500")}>{row.last ? `${row.prefix}${row.last.body}` : row.group ? "এখনো কোনো message নেই" : "Message দিয়ে chat শুরু করুন"}</span>
                      {row.unread ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">{row.unread}</span> : null}
                    </span>
                  </span>
                </button>
              </li>;
            })}
          </ul>
        </div>
      </aside>

      {selectedGroup ? <GroupChatPanel key={selectedGroup.id} me={me} groupId={selectedGroup.id} initialName={selectedGroup.name} onBack={() => go({ group: null })} onRead={onRead} onLeft={() => go({ group: null })} />
        : selected ? <ChatPanel key={selected.person.id} me={me} friend={selected.person} isFriend={selected.isFriend} conversationId={selected.conversationId} onBack={() => go({ with: null })} onRead={onRead} />
        : <div className="hidden flex-col items-center justify-center gap-3 rounded-3xl bg-white text-center text-sm text-slate-500 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] lg:flex">
          <span className="flex size-16 items-center justify-center rounded-full bg-blue-50"><MessageCircle className="size-8 text-blue-500" /></span>
          <span><span className="block font-semibold text-slate-800">একটা chat বেছে নিন</span>বাঁ দিকের তালিকা থেকে বন্ধু বা গ্রুপ খুলুন।</span>
        </div>}
    </div> : null}
    <AddFriendDialog open={addingFriend} onOpenChange={setAddingFriend} onMessage={(friendId) => go({ tab: "chats", with: friendId })} />
    <CreateGroupDialog open={creating} onOpenChange={setCreating} onCreated={(id) => go({ tab: "chats", group: id })} />
  </div>;
}
