"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_MAX } from "@/lib/collaboration";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { markConversationRead, openConversation, sendMessage } from "@/server/actions/messages";
import type { PublicPerson } from "@/server/collaboration/people";
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

  function retry(message: ChatMessage) {
    setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, failed: false, pending: true } : item)));
    void deliver(message.body, message.id);
  }

  const lastMineSeen = otherLastReadAt ? [...messages].reverse().find((message) => message.senderId === me && !message.pending && message.createdAt <= otherLastReadAt) : null;

  return <section className="flex h-[calc(100dvh-13rem)] min-h-96 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:h-[calc(100dvh-10rem)]">
    <header className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5">
      <button type="button" onClick={onBack} aria-label="Chat list-এ ফিরে যাও" className="flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 lg:hidden"><ArrowLeft className="size-5" /></button>
      <span className="flex size-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">{friend.initial}</span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{friend.name}</p>
        <p className="text-xs text-zinc-500">{status === "live" ? "সরাসরি সংযুক্ত" : status === "connecting" ? "সংযোগ হচ্ছে…" : "প্রতি কয়েক সেকেন্ডে নতুন message দেখা হচ্ছে"}</p>
      </div>
    </header>

    <div ref={scroller} onScroll={(event) => { const box = event.currentTarget; stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; }} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
      {state === "loading" ? <div className="flex justify-center py-10 text-zinc-400"><Loader2 className="size-6 animate-spin" /></div> : null}
      {state === "error" ? <p className="py-10 text-center text-sm text-red-600">Chat খোলা গেল না। <button type="button" onClick={reload} className="underline">আবার চেষ্টা করো</button></p> : null}
      {state === "ready" && hasOlder ? <div className="flex justify-center"><button type="button" disabled={loadingOlder} onClick={() => void loadOlder()} className="rounded-full px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50">{loadingOlder ? "আনা হচ্ছে…" : "আগের message দেখো"}</button></div> : null}
      {state === "ready" && !messages.length ? <p className="py-10 text-center text-sm text-zinc-500">এখনো কোনো message নেই — প্রথমটা লেখো।</p> : null}
      {messages.map((message) => {
        const mine = message.senderId === me;
        return <div key={message.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
          <p className={cn("max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed", mine ? "rounded-br-md bg-zinc-950 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-900", message.pending && "opacity-60", message.failed && "bg-red-100 text-red-900")}>{message.body}</p>
          <p className="mt-0.5 px-1 text-[11px] text-zinc-400">
            {message.failed ? <button type="button" onClick={() => retry(message)} className="inline-flex items-center gap-1 text-red-600 hover:underline"><RotateCcw className="size-3" /> যায়নি — আবার পাঠাও</button>
              : message.pending ? "পাঠানো হচ্ছে…" : formatDateTime(new Date(message.createdAt))}
            {lastMineSeen?.id === message.id ? " · দেখেছে" : ""}
          </p>
        </div>;
      })}
    </div>

    {canSend ? <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-zinc-100 p-2.5">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX))}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}
        rows={1}
        placeholder="Message লেখো… (Enter = পাঠাও, Shift+Enter = নতুন লাইন)"
        aria-label="Message"
        className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none focus:border-zinc-400"
      />
      <button type="submit" disabled={!draft.trim() || !conversationId} aria-label="পাঠাও" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-40"><Send className="size-4" /></button>
    </form> : state === "ready" ? <p className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-500">আপনারা এখন friend নন — পুরনো message পড়া যাবে, নতুন পাঠানো যাবে না।</p> : null}
  </section>;
}
