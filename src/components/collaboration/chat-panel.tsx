"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_MAX } from "@/lib/collaboration";
import { removeFriend } from "@/server/actions/friends";
import { markConversationRead, openConversation, sendMessage } from "@/server/actions/messages";
import type { PublicPerson } from "@/server/collaboration/people";
import { Bubble, ChatAvatar, ChatFrame, ChatHeader, ChatTitle, Composer, ComposerNote, DayDivider, HeaderMenu, liveLabel, MessageScroller, ScrollerNotice, startsNewDay } from "./chat-ui";
import { useLive, type LiveEvent } from "./live-provider";

type ChatMessage = { id: string; senderId: string; body: string; createdAt: string; pending?: boolean; failed?: boolean };
type Page = { messages: Array<Omit<ChatMessage, "createdAt"> & { createdAt: string }>; hasOlder?: boolean; otherId: string; otherLastReadAt: string | null; canSend: boolean };

async function fetchPage(conversationId: string, cursor: { before?: string; after?: string } = {}): Promise<Page> {
  const params = new URLSearchParams(Object.entries(cursor).filter(([, value]) => value) as Array<[string, string]>);
  const response = await fetch(`/api/messages/${conversationId}?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "Message আনা গেল না।");
  return response.json();
}

/** Adds messages that aren't already on screen, keeping time order. */
const merge = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const seen = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !seen.has(message.id));
  return fresh.length ? [...current, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) : current;
};

/**
 * One chat with a friend. New messages arrive by socket.io (or a 3-second poll when the socket is
 * down); my own appear at once and are confirmed by the server. Reading marks the chat read.
 */
export function ChatPanel({ me, friend, isFriend, conversationId: knownId, onBack, onRead }: {
  me: string;
  friend: PublicPerson;
  isFriend: boolean;
  conversationId: string | null;
  onBack: () => void;
  onRead: () => void;
}) {
  const { status, subscribe, refresh } = useLive();
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState(knownId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [canSend, setCanSend] = useState(isFriend);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const canLoad = Boolean(knownId) || isFriend;
  const [state, setState] = useState<"loading" | "ready" | "error">(canLoad ? "loading" : "ready");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const keepScrollFrom = useRef<number | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const markRead = useCallback((id: string) => {
    if (document.visibilityState !== "visible") return;
    void markConversationRead(id).then(() => { refresh(); onRead(); }).catch(() => {});
  }, [refresh, onRead]);

  // Open (or start, for a friend) the conversation and load its latest page. The panel starts in
  // "loading" (it is remounted per friend); every state change here comes after an await.
  const load = useCallback(async () => {
    try {
      const id = knownId ?? (await openConversation(friend.id));
      if (id !== knownId) setConversationId(id);
      const page = await fetchPage(id);
      setMessages(page.messages);
      setHasOlder(Boolean(page.hasOlder));
      setCanSend(page.canSend);
      setOtherLastReadAt(page.otherLastReadAt);
      stickToBottom.current = true;
      setState("ready");
      markRead(id);
    } catch {
      setState("error");
    }
  }, [knownId, friend.id, markRead]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on mount; load() sets state only after awaiting the server
    if (canLoad) void load();
  }, [canLoad, load]);
  const reload = () => { setState("loading"); void load(); };

  // Anything newer than what's on screen (after a socket event or a poll).
  const catchUp = useCallback(async () => {
    if (!conversationId) return;
    const lastSaved = [...messagesRef.current].reverse().find((message) => !message.pending && !message.failed);
    try {
      const page = await fetchPage(conversationId, lastSaved ? { after: lastSaved.id } : {});
      setOtherLastReadAt(page.otherLastReadAt);
      setCanSend(page.canSend);
      if (page.messages.length) {
        setMessages((current) => merge(current, page.messages));
        if (page.messages.some((message) => message.senderId !== me)) markRead(conversationId);
      }
    } catch { /* the next poll or event tries again */ }
  }, [conversationId, me, markRead]);

  useEffect(() => subscribe((event: LiveEvent) => {
    if (!conversationId || !("conversationId" in event) || event.conversationId !== conversationId) {
      if (event.type === "friends") void catchUp();
      return;
    }
    if (event.type === "message") {
      setMessages((current) => merge(current, [event.message]));
      if (event.message.senderId !== me) markRead(conversationId);
    } else if (event.type === "read") void catchUp();
  }), [subscribe, conversationId, me, markRead, catchUp]);

  // Without a socket, poll every 3 seconds while this tab is visible.
  useEffect(() => {
    if (status === "live" || !conversationId) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void catchUp(); }, 3000);
    return () => window.clearInterval(timer);
  }, [status, conversationId, catchUp]);

  // Stay at the bottom for new messages; keep the reading position when older ones are added above.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    if (keepScrollFrom.current !== null) { box.scrollTop = box.scrollHeight - keepScrollFrom.current; keepScrollFrom.current = null; return; }
    if (stickToBottom.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    const first = messages.find((message) => !message.pending);
    if (!conversationId || !first) return;
    setLoadingOlder(true);
    try {
      const page = await fetchPage(conversationId, { before: first.id });
      keepScrollFrom.current = scroller.current ? scroller.current.scrollHeight - scroller.current.scrollTop : null;
      setMessages((current) => merge(current, page.messages));
      setHasOlder(Boolean(page.hasOlder));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "আগের message আনা গেল না।");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function deliver(body: string, tempId: string) {
    if (!conversationId) return;
    try {
      const saved = await sendMessage({ conversationId, body });
      setMessages((current) => merge(current.filter((message) => message.id !== tempId), [saved]));
      onRead();
    } catch (error) {
      setMessages((current) => current.map((message) => (message.id === tempId ? { ...message, pending: false, failed: true } : message)));
      toast.error(error instanceof Error ? error.message : "Message পাঠানো গেল না।");
    }
  }

  function send() {
    const body = draft.trim();
    if (!body || !conversationId || !canSend) return;
    const tempId = `temp-${Date.now()}`;
    stickToBottom.current = true;
    setMessages((current) => [...current, { id: tempId, senderId: me, body, createdAt: new Date().toISOString(), pending: true }]);
    setDraft("");
    void deliver(body, tempId);
  }

  // Unfriending keeps the chat readable but closes the box (the server cancels waiting shares too).
  async function unfriend() {
    if (!window.confirm(`${friend.name}-কে friend list থেকে সরাবে? পুরনো chat পড়া যাবে, নতুন message পাঠানো যাবে না।`)) return;
    try {
      await removeFriend(friend.id);
      toast.success("Friend list থেকে সরানো হলো");
      setCanSend(false);
      for (const key of ["friends", "conversations"]) void queryClient.invalidateQueries({ queryKey: [key] });
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "সরানো গেল না।");
    }
  }

  function retry(message: ChatMessage) {
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, failed: false, pending: true } : item)));
    void deliver(message.body, message.id);
  }

  const onScroll = (event: UIEvent<HTMLDivElement>) => { const box = event.currentTarget; stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; };

  return <ChatFrame>
    <ChatHeader onBack={onBack}>
      <ChatTitle avatar={<ChatAvatar name={friend.name} image={friend.image} className="size-10 ring-2 ring-white/40" />} title={friend.name} subtitle={liveLabel(status)} />
      {canSend ? <HeaderMenu label="আরও" items={[{ label: "Friend list থেকে সরাও", icon: <UserMinus className="size-4" />, danger: true, onSelect: () => void unfriend() }]} /> : null}
    </ChatHeader>

    <MessageScroller scrollRef={scroller} onScroll={onScroll}>
      <ScrollerNotice state={state} onRetry={reload} errorText="Chat খোলা গেল না।" hasOlder={hasOlder} loadingOlder={loadingOlder} onLoadOlder={() => void loadOlder()} empty={!messages.length} />
      {messages.map((message, index) => {
        const mine = message.senderId === me;
        const newDay = startsNewDay(messages, index);
        return <Fragment key={message.id}>
          {newDay ? <DayDivider date={message.createdAt} /> : null}
          <Bubble
            mine={mine}
            first={newDay || messages[index - 1].senderId !== message.senderId}
            body={message.body}
            createdAt={message.createdAt}
            pending={message.pending}
            failed={message.failed}
            seen={Boolean(otherLastReadAt && message.createdAt <= otherLastReadAt)}
            onRetry={() => retry(message)}
          />
        </Fragment>;
      })}
    </MessageScroller>

    {canSend ? <Composer value={draft} onChange={setDraft} onSend={send} canSend={Boolean(draft.trim() && conversationId)} placeholder="Message লেখো…" maxLength={MESSAGE_MAX} />
      : state === "ready" ? <ComposerNote>আপনারা এখন friend নন — পুরনো message পড়া যাবে, নতুন পাঠানো যাবে না।</ComposerNote> : null}
  </ChatFrame>;
}
