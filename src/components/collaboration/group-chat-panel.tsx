"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RotateCcw, Send, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { MESSAGE_MAX } from "@/lib/collaboration";
import { formatDateTime } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { groupDetails, markGroupRead, sendGroupMessage } from "@/server/actions/groups";
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
  return <section className="flex h-[calc(100dvh-13rem)] min-h-96 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:h-[calc(100dvh-10rem)]">
    <header className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5">
      <button type="button" onClick={onBack} aria-label="Chat list-এ ফিরে যাও" className="flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 lg:hidden"><ArrowLeft className="size-5" /></button>
      <button type="button" disabled={gone} onClick={() => setInfoOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left hover:bg-zinc-50 disabled:hover:bg-transparent">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"><UsersRound className="size-4" /></span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate text-xs text-zinc-500">{details.data ? `${details.data.members.length} জন · সদস্য দেখতে চাপুন` : status === "live" ? "সরাসরি সংযুক্ত" : "গ্রুপ"}</span>
        </span>
      </button>
    </header>

    <div ref={scroller} onScroll={(event) => { const box = event.currentTarget; stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; }} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
      {state === "loading" ? <div className="flex justify-center py-10 text-zinc-400"><Loader2 className="size-6 animate-spin" /></div> : null}
      {state === "error" ? <p className="py-10 text-center text-sm text-red-600">গ্রুপ খোলা গেল না। <button type="button" onClick={reload} className="underline">আবার চেষ্টা করো</button></p> : null}
      {state === "ready" && hasOlder ? <div className="flex justify-center"><button type="button" disabled={loadingOlder} onClick={() => void loadOlder()} className="rounded-full px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50">{loadingOlder ? "আনা হচ্ছে…" : "আগের message দেখো"}</button></div> : null}
      {messages.map((message, index) => {
        if (message.kind === "SYSTEM") return <p key={message.id} className="mx-auto w-fit max-w-[90%] rounded-full bg-zinc-100 px-3 py-1 text-center text-xs text-zinc-500">{message.body}</p>;
        const mine = message.senderId === me;
        const previous = messages[index - 1];
        // The sender's name only where a run of their messages starts.
        const showName = !mine && message.senderId && (previous?.senderId !== message.senderId || previous?.kind === "SYSTEM");
        return <div key={message.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
          {showName ? <p className="mb-0.5 px-1 text-xs font-medium text-emerald-700">{nameOf(message.senderId!)}</p> : null}
          <p className={cn("max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed", mine ? "rounded-br-md bg-zinc-950 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-900", message.pending && "opacity-60", message.failed && "bg-red-100 text-red-900")}>{message.body}</p>
          <p className="mt-0.5 px-1 text-[11px] text-zinc-400">
            {message.failed ? <button type="button" onClick={() => retry(message)} className="inline-flex items-center gap-1 text-red-600 hover:underline"><RotateCcw className="size-3" /> যায়নি — আবার পাঠাও</button>
              : message.pending ? "পাঠানো হচ্ছে…" : formatDateTime(new Date(message.createdAt))}
          </p>
        </div>;
      })}
    </div>

    {gone ? <p className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-500">আপনি আর এই গ্রুপে নেই।</p>
      : <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-zinc-100 p-2.5">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX))}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}
          rows={1}
          placeholder="গ্রুপে লেখো… (Enter = পাঠাও, Shift+Enter = নতুন লাইন)"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-[15px] outline-none focus:border-zinc-400"
        />
        <button type="submit" disabled={!draft.trim() || state !== "ready"} aria-label="পাঠাও" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-40"><Send className="size-4" /></button>
      </form>}

    <GroupInfoDialog groupId={groupId} open={infoOpen} onOpenChange={setInfoOpen} onLeft={onLeft} />
  </section>;
}
