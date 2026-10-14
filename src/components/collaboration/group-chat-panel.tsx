"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MESSAGE_MAX } from "@/lib/collaboration";
import { groupDetails, markGroupRead, sendGroupMessage } from "@/server/actions/groups";
import { Bubble, ChatAvatar, ChatFrame, ChatHeader, ChatTitle, Composer, ComposerNote, DayDivider, liveLabel, MessageScroller, ScrollerNotice, startsNewDay, SystemLine } from "./chat-ui";
import { GroupInfoDialog } from "./group-dialogs";
import { useLive, type LiveEvent } from "./live-provider";

type GroupMessage = { id: string; senderId: string | null; kind: "TEXT" | "SYSTEM"; body: string; createdAt: string; pending?: boolean; failed?: boolean };
type Page = { messages: GroupMessage[]; hasOlder?: boolean; names: Record<string, string> };

class GoneError extends Error {}

async function fetchPage(groupId: string, cursor: { before?: string; after?: string } = {}): Promise<Page> {
  const params = new URLSearchParams(Object.entries(cursor).filter(([, value]) => value) as Array<[string, string]>);
  const response = await fetch(`/api/groups/${groupId}?${params}`, { cache: "no-store" });
  if (response.status === 404) throw new GoneError();
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Message আনা গেল না।");
  return response.json();
}

/** Adds messages that aren't already on screen, keeping time order. */
const merge = (current: GroupMessage[], incoming: GroupMessage[]) => {
  const seen = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !seen.has(message.id));
  return fresh.length ? [...current, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) : current;
};

/**
 * One group chat. Works like the 1:1 ChatPanel (socket.io, or a 3-second poll without it), plus the
 * sender's name over other people's messages and centred system lines ("X joined").
 */
export function GroupChatPanel({ me, groupId, initialName, onBack, onRead, onLeft }: {
  me: string;
  groupId: string;
  initialName: string;
  onBack: () => void;
  onRead: () => void;
  onLeft: () => void;
}) {
  const { status, subscribe, refresh } = useLive();
  const details = useQuery({ queryKey: ["group", groupId], queryFn: () => groupDetails(groupId) });
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [hasOlder, setHasOlder] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error" | "gone">("loading");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const keepScrollFrom = useRef<number | null>(null);
  const messagesRef = useRef<GroupMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Removed or left (seen through the details refetch after a group_changed event).
  const gone = state === "gone" || details.data === null;
  const memberNames = Object.fromEntries((details.data?.members ?? []).map((member) => [member.id, member.name]));
  const nameOf = (id: string) => memberNames[id] ?? names[id] ?? "কেউ";

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    void markGroupRead(groupId).then(() => { refresh(); onRead(); }).catch(() => {});
  }, [groupId, refresh, onRead]);

  const fail = useCallback((error: unknown) => setState(error instanceof GoneError ? "gone" : "error"), []);

  // The panel is remounted per group and starts in "loading"; state changes come after awaiting.
  const load = useCallback(async () => {
    try {
      const page = await fetchPage(groupId);
      setMessages(page.messages);
      setNames(page.names);
      setHasOlder(Boolean(page.hasOlder));
      stickToBottom.current = true;
      setState("ready");
      markRead();
    } catch (error) {
      fail(error);
    }
  }, [groupId, markRead, fail]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on mount; load() sets state only after awaiting the server
    void load();
  }, [load]);
  const reload = () => { setState("loading"); void load(); };

  const catchUp = useCallback(async () => {
    const lastSaved = [...messagesRef.current].reverse().find((message) => !message.pending && !message.failed);
    try {
      const page = await fetchPage(groupId, lastSaved ? { after: lastSaved.id } : {});
      if (page.messages.length) {
        setNames((current) => ({ ...current, ...page.names }));
        setMessages((current) => merge(current, page.messages));
        if (page.messages.some((message) => message.senderId !== me)) markRead();
      }
    } catch (error) {
      if (error instanceof GoneError) setState("gone");
    }
  }, [groupId, me, markRead]);

  useEffect(() => subscribe((event: LiveEvent) => {
    if (!("groupId" in event) || event.groupId !== groupId) return;
    if (event.type === "group_message") {
      setMessages((current) => merge(current, [event.message]));
      if (event.message.senderId !== me) markRead();
    }
  }), [subscribe, groupId, me, markRead]);

  // Without a socket, poll every 3 seconds while this tab is visible.
  useEffect(() => {
    if (status === "live" || gone) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void catchUp(); }, 3000);
    return () => window.clearInterval(timer);
  }, [status, gone, catchUp]);

  // Stay at the bottom for new messages; keep the reading position when older ones are added above.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    if (keepScrollFrom.current !== null) { box.scrollTop = box.scrollHeight - keepScrollFrom.current; keepScrollFrom.current = null; return; }
    if (stickToBottom.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    const first = messages.find((message) => !message.pending);
    if (!first) return;
    setLoadingOlder(true);
    try {
      const page = await fetchPage(groupId, { before: first.id });
      keepScrollFrom.current = scroller.current ? scroller.current.scrollHeight - scroller.current.scrollTop : null;
      setNames((current) => ({ ...current, ...page.names }));
      setMessages((current) => merge(current, page.messages));
      setHasOlder(Boolean(page.hasOlder));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "আগের message আনা গেল না।");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function deliver(body: string, tempId: string) {
    try {
      const saved = await sendGroupMessage({ groupId, body });
      setMessages((current) => merge(current.filter((message) => message.id !== tempId), [saved]));
      onRead();
    } catch (error) {
      setMessages((current) => current.map((message) => (message.id === tempId ? { ...message, pending: false, failed: true } : message)));
      toast.error(error instanceof Error ? error.message : "Message পাঠানো গেল না।");
    }
  }

  function send() {
    const body = draft.trim();
    if (!body || gone) return;
    const tempId = `temp-${Date.now()}`;
    stickToBottom.current = true;
    setMessages((current) => [...current, { id: tempId, senderId: me, kind: "TEXT", body, createdAt: new Date().toISOString(), pending: true }]);
    setDraft("");
    void deliver(body, tempId);
  }

  function retry(message: GroupMessage) {
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, failed: false, pending: true } : item)));
    void deliver(message.body, message.id);
  }

  const title = details.data?.name ?? initialName;
  const onScroll = (event: UIEvent<HTMLDivElement>) => { const box = event.currentTarget; stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; };
  return <ChatFrame>
    <ChatHeader onBack={onBack}>
      <button type="button" disabled={gone} onClick={() => setInfoOpen(true)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full py-0.5 pr-2 hover:bg-white/10 disabled:hover:bg-transparent">
        <ChatTitle avatar={<ChatAvatar name={title} group className="size-10 bg-white/20 text-white ring-2 ring-white/40" />} title={title} subtitle={details.data ? `${details.data.members.length} জন · সদস্য দেখতে চাপুন` : liveLabel(status)} />
      </button>
    </ChatHeader>

    <MessageScroller scrollRef={scroller} onScroll={onScroll}>
      <ScrollerNotice state={state} onRetry={reload} errorText="গ্রুপ খোলা গেল না।" hasOlder={hasOlder} loadingOlder={loadingOlder} onLoadOlder={() => void loadOlder()} empty={false} />
      {messages.map((message, index) => {
        const newDay = startsNewDay(messages, index);
        if (message.kind === "SYSTEM") return <Fragment key={message.id}>{newDay ? <DayDivider date={message.createdAt} /> : null}<SystemLine>{message.body}</SystemLine></Fragment>;
        const mine = message.senderId === me;
        const previous = messages[index - 1];
        // A run of one sender's messages starts here: tail, extra space, and their name.
        const first = newDay || previous?.senderId !== message.senderId || previous?.kind === "SYSTEM";
        return <Fragment key={message.id}>
          {newDay ? <DayDivider date={message.createdAt} /> : null}
          <Bubble
            mine={mine}
            first={first}
            sender={!mine && first && message.senderId ? nameOf(message.senderId) : null}
            body={message.body}
            createdAt={message.createdAt}
            pending={message.pending}
            failed={message.failed}
            onRetry={() => retry(message)}
          />
        </Fragment>;
      })}
    </MessageScroller>

    {gone ? <ComposerNote>আপনি আর এই গ্রুপে নেই।</ComposerNote>
      : <Composer value={draft} onChange={setDraft} onSend={send} canSend={Boolean(draft.trim()) && state === "ready"} placeholder="গ্রুপে লেখো…" maxLength={MESSAGE_MAX} />}

    <GroupInfoDialog groupId={groupId} open={infoOpen} onOpenChange={setInfoOpen} onLeft={onLeft} />
  </ChatFrame>;
}
