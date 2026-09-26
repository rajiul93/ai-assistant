import { create } from "zustand";
import type { AssistantLang } from "@/lib/assistant-i18n";
import type { Attachment } from "@/lib/attachments";
import type { ChatMessage, PendingAction, ReplySource } from "@/lib/assistant-types";

export type DraftState = "pending" | "saving" | "saved" | "cancelled" | "replaced";

export type AssistantEntry = ChatMessage & {
  id: number;
  /** User message that came from the microphone. */
  viaVoice?: boolean;
  /** Name of the image/PDF sent with this user message. */
  attachmentName?: string;
  source?: ReplySource;
  /** A prepared change shown as a card; it only happens once the user confirms. */
  action?: PendingAction;
  draftState?: DraftState;
  /** A picture the assistant drew (data URL). */
  image?: string;
};

/** What the assistant is doing right now, shown to the user as a live status bar. */
export type LiveStatus =
  | { stage: "listening"; text: string }
  | { stage: "thinking"; text: string; since: number }
  | { stage: "result"; text: string; tone: "ok" | "warn" };

type AssistantStore = {
  lang: AssistantLang;
  open: boolean;
  busy: boolean;
  entries: AssistantEntry[];
  live: LiveStatus | null;
  /** The image/PDF the conversation is about; sent with every message until the user removes it. */
  attachment: Attachment | null;
  setAttachment: (attachment: Attachment | null) => void;
  setLang: (lang: AssistantLang) => void;
  /** Restore the language the user picked last time (call once on the client). */
  loadLang: () => void;
  setOpen: (open: boolean) => void;
  setBusy: (busy: boolean) => void;
  setLive: (live: LiveStatus | null) => void;
  add: (entry: Omit<AssistantEntry, "id">) => number;
  update: (id: number, patch: Partial<AssistantEntry>) => void;
  remove: (id: number) => void;
};

const LANG_KEY = "assistant-lang";
let nextId = 1;
let clearResultTimer: ReturnType<typeof setTimeout> | undefined;

export const useAssistantStore = create<AssistantStore>((set) => ({
  lang: "bn",
  open: false,
  busy: false,
  entries: [],
  live: null,
  attachment: null,
  setAttachment: (attachment) => set({ attachment }),
  setLang: (lang) => {
    set({ lang });
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage unavailable: keep for this visit only */ }
  },
  loadLang: () => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "bn" || saved === "en") set({ lang: saved });
    } catch { /* storage unavailable */ }
  },
  setOpen: (open) => set({ open }),
  setBusy: (busy) => set({ busy }),
  setLive: (live) => {
    clearTimeout(clearResultTimer);
    set({ live });
    // Results are a short confirmation; listening/thinking stay until replaced.
    if (live?.stage === "result") clearResultTimer = setTimeout(() => set({ live: null }), 6000);
  },
  add: (entry) => {
    const id = nextId++;
    set((state) => ({ entries: [...state.entries, { ...entry, id }].slice(-40) }));
    return id;
  },
  update: (id, patch) => set((state) => ({ entries: state.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) })),
  remove: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
}));

export function findPendingAction(entries: AssistantEntry[]) {
  return entries.findLast((entry) => entry.draftState === "pending" && entry.action);
}
