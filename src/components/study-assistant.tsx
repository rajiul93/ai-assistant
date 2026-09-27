"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Check, CircleCheck, Download, FileText, Lock, Maximize2, Mic, Minimize2, NotebookPen, Paperclip, RefreshCcw, Sparkles, Square, Volume2, X } from "lucide-react";
import { ChatMarkdown } from "@/components/chat-markdown";
import { MathText } from "@/components/math-text";
import { ChatPurchase } from "@/components/billing/chat-purchase";
import { ImageViewer } from "@/components/image-viewer";
import { VoiceWave } from "@/components/assistant-status";
import { sectorLabels, statusLabels } from "@/lib/applications";
import type { AssistantLang, AssistantStrings } from "@/lib/assistant-i18n";
import { ATTACHMENT_ACCEPT, formatBytes, isAllowedType, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, MAX_TOTAL_ATTACHMENT_BYTES, type Attachment, type AttachmentType } from "@/lib/attachments";
import { compressImage } from "@/lib/compress-image";
import type { PendingAction } from "@/lib/assistant-types";
import { interruptReply, useAssistant } from "@/lib/use-assistant";
import { useVoiceChat } from "@/lib/use-voice-chat";
import { cn } from "@/lib/utils";
import { isVoicePlaying, speak, subscribeVoicePlaying } from "@/lib/voice";
import type { AiLock } from "@/lib/ai-limits";
import { useAssistantStore, type AssistantEntry } from "@/store/assistant";

const priorityStyles = { LOW: "bg-zinc-100 text-zinc-600", MEDIUM: "bg-sky-50 text-sky-700", HIGH: "bg-rose-50 text-rose-700" } as const;

/** The browser sometimes leaves a file's type empty — fall back to the extension. */
function fileType(file: File): AttachmentType | null {
  if (isAllowedType(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExtension: Record<string, AttachmentType> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  return file.type === "" ? byExtension[extension] ?? null : null;
}

function readBase64(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ActionCard({ action, state, t, onConfirm, onCancel }: { action: PendingAction; state: AssistantEntry["draftState"]; t: AssistantStrings; onConfirm: () => void; onCancel: () => void }) {
  let eyebrow: string | null = null;
  let title: string;
  let badge: React.ReactNode = null;
  let description = "";
  let rows: Array<[string, string]>;
  let confirmLabel = t.confirm;

  if (action.kind === "create_task") {
    const { draft } = action;
    title = draft.title;
    description = draft.description;
    badge = <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", priorityStyles[draft.priority])}>{draft.priority}</span>;
    rows = [[t.draftSubject, draft.subjectName || "—"], [t.draftDue, draft.dueLabel || "—"], [t.draftMinutes, t.minutes(draft.estimatedMinutes)]];
  } else if (action.kind === "complete_task") {
    eyebrow = t.markDoneLabel;
    title = action.title;
    badge = <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CircleCheck className="size-4" /></span>;
    rows = [[t.draftSubject, action.subjectName || "—"]];
    confirmLabel = t.confirmComplete;
  } else if (action.kind === "create_note") {
    eyebrow = t.noteLabel;
    title = action.title;
    description = action.preview;
    badge = <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><NotebookPen className="size-3.5" /></span>;
    rows = [];
    confirmLabel = t.confirmNote;
  } else if (action.kind === "add_application") {
    const { draft } = action;
    eyebrow = t.applicationLabel;
    title = draft.title;
    description = [draft.posts.join(" · "), draft.notes].filter(Boolean).join(" — ");
    badge = <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", draft.sector === "GOVERNMENT" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700")}>{sectorLabels[draft.sector]}</span>;
    rows = [["Organization", draft.organization], ["Status", statusLabels[draft.status]], [t.dateLabel, draft.appliedAt || draft.deadline || "—"]];
    confirmLabel = t.confirmApplication;
  } else {
    eyebrow = t.revisionLabel;
    title = action.title;
    badge = <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"><RefreshCcw className="size-3.5" /></span>;
    rows = [["Revised", `${action.timesRevised}× → ${action.timesRevised + 1}×`]];
    confirmLabel = t.confirmRevision;
  }

  const done = state !== "pending";
  return <div className={cn("mt-2.5 overflow-hidden rounded-2xl border bg-white shadow-sm transition-opacity", done && state !== "saved" && "opacity-60")}>
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-3.5 py-3">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{eyebrow}</p> : null}
        <p className="font-medium leading-snug text-zinc-950">{title}</p>
      </div>
      {badge}
    </div>
    {description ? <p className="line-clamp-3 px-3.5 pt-2.5 text-xs leading-relaxed text-zinc-600">{description}</p> : null}
    <dl className="grid grid-cols-3 gap-2 px-3.5 py-2.5 text-xs">
      {rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[11px] text-zinc-400">{label}</dt><dd className="truncate font-medium text-zinc-800">{value}</dd></div>)}
    </dl>
    {state === "pending"
      ? <div className="flex gap-2 px-3.5 pb-3.5">
        <button type="button" onClick={onConfirm} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800 active:scale-[0.98]"><Check className="size-4" /> {confirmLabel}</button>
        <button type="button" onClick={onCancel} className="h-11 rounded-xl px-3.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100">{t.cancel}</button>
      </div>
      : <p className={cn("px-3.5 pb-3 text-xs font-medium", state === "saved" ? "text-emerald-600" : "text-zinc-500")}>{state ? t.draftStates[state] : null}</p>}
  </div>;
}

/** Shown while the AI is off for this user: why (no plan, plan ended, tokens used up) and a way to buy one. */
function PlanLockCard({ lock, t }: { lock: Exclude<AiLock, null>; t: AssistantStrings }) {
  const message = t.aiLock[lock];
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <p className="flex items-start gap-2 leading-relaxed"><Lock className="mt-0.5 size-4 shrink-0" /> {message}</p>
    {lock === "paused" ? null : <button type="button" onClick={() => useAssistantStore.getState().add({ role: "assistant", text: "", purchase: true })} className="mt-3 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-zinc-800">{t.choosePlan}</button>}
  </div>;
}

const languages: Array<{ value: AssistantLang; label: string; name: string }> = [
  { value: "bn", label: "বাং", name: "বাংলা" },
  { value: "en", label: "EN", name: "English" },
];

export function StudyAssistant({ aiLock }: { aiLock: AiLock }) {
  const { entries, busy, open, setOpen, t, send, confirmAction, cancelAction } = useAssistant();
  const [question, setQuestion] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const setLive = useAssistantStore((state) => state.setLive);
  const lang = useAssistantStore((state) => state.lang);
  const setLang = useAssistantStore((state) => state.setLang);
  const attachments = useAssistantStore((state) => state.attachments);
  const setAttachments = useAssistantStore((state) => state.setAttachments);
  const attachment = attachments[0] ?? null;
  // Tapping a thumbnail opens it full screen; the viewer pages through the selected images only.
  const images = attachments.flatMap((file, index) => (file.mimeType.startsWith("image/") ? [{ src: `data:${file.mimeType};base64,${file.data}`, name: file.name, index }] : []));
  const [viewing, setViewing] = useState<number | null>(null);
  const [reading, setReading] = useState(false);
  // Wider panel for reading code (desktop/tablet; phones already use the full width).
  const [wide, setWide] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voicePlaying = useSyncExternalStore(subscribeVoicePlaying, isVoicePlaying, () => false);
  // Whatever was typed before the user started talking stays in front of the spoken words.
  const questionRef = useRef("");
  const typedBefore = useRef<string | null>(null);
  const setBox = (value: string) => { questionRef.current = value; setQuestion(value); };
  const join = (before: string, spoken: string) => [before.trim(), spoken.trim()].filter(Boolean).join(" ");
  const voice = useVoiceChat({
    // Live typing: the box shows the words while they are being said.
    onDraft: (text) => {
      if (text === "…") { typedBefore.current ??= questionRef.current; return; }
      if (!text) { if (typedBefore.current !== null) setBox(typedBefore.current); return; }
      typedBefore.current ??= questionRef.current;
      setBox(join(typedBefore.current, text));
    },
    onSentence: (text, alternatives) => {
      const message = join(typedBefore.current ?? "", text);
      typedBefore.current = null;
      setBox("");
      void send(message, { voice: true, alternatives });
    },
    onError: (error) => setVoiceError(error.message),
    onStopped: () => setLive({ stage: "result", tone: "ok", text: t.voiceStoppedStatus }),
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, busy, open]);

  /** The mic button turns hands-free voice chat on and off. */
  function toggleListening() {
    setVoiceError("");
    if (voice.listening) { voice.stop(); typedBefore.current = null; return; }
    // Without AI access the mic would only hear "not allowed".
    if (aiLock) { setVoiceError(t.aiLockedStatus); return; }
    // Tapping the mic means "let me talk": the current answer stops, like ChatGPT.
    interruptReply();
    void voice.start();
  }

  function chooseLanguage(value: AssistantLang) {
    if (value === lang) return;
    setLang(value);
    voice.languageChanged();
  }

  useEffect(() => { useAssistantStore.getState().loadLang(); }, []);

  function close() {
    voice.stop();
    setOpen(false);
  }

  /**
   * Adds up to 10 images/PDFs (picked, pasted or dropped). Images are shrunk in the browser so all of
   * them fit in one message; text in them stays readable. Files over the limit are left out with a note.
   */
  async function addFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setVoiceError("");
    const current = useAssistantStore.getState().attachments;
    const room = MAX_ATTACHMENTS - current.length;
    if (room <= 0) { setVoiceError(t.attachmentTooMany(MAX_ATTACHMENTS)); return; }
    const taken = files.slice(0, room);
    const problems: string[] = [];
    if (files.length > room) problems.push(t.attachmentTooMany(MAX_ATTACHMENTS));
    setReading(true);
    try {
      const added: Attachment[] = [];
      let used = current.reduce((total, file) => total + file.size, 0);
      // Share what's left of the budget between the images still to add.
      const perImage = Math.max(150_000, Math.floor((MAX_TOTAL_ATTACHMENT_BYTES - used) / Math.max(1, taken.length)));
      for (const file of taken) {
        const type = fileType(file);
        if (!type) { problems.push(t.attachmentOnlyTypes); continue; }
        if (file.size > MAX_ATTACHMENT_BYTES) { problems.push(t.attachmentTooBig(formatBytes(file.size))); continue; }
        const shrunk = type === "application/pdf" ? { blob: file as Blob, type } : await compressImage(file, perImage);
        if (!shrunk) { problems.push(t.attachmentOnlyTypes); continue; }
        if (used + shrunk.blob.size > MAX_TOTAL_ATTACHMENT_BYTES) { problems.push(t.attachmentTotalTooBig); break; }
        used += shrunk.blob.size;
        added.push({ name: file.name, mimeType: shrunk.type, size: shrunk.blob.size, data: await readBase64(shrunk.blob) });
      }
      if (added.length) setAttachments([...useAssistantStore.getState().attachments, ...added].slice(0, MAX_ATTACHMENTS));
      if (problems.length) setVoiceError([...new Set(problems)].join(" "));
    } catch {
      setVoiceError(t.attachmentOnlyTypes);
    } finally {
      setReading(false);
    }
  }

  function submit() {
    // A new message while an answer is still coming cuts it short (send() does that).
    if (!question.trim() && !attachment) return;
    const value = question;
    typedBefore.current = null;
    setBox("");
    void send(value);
  }

  return <>
    <button
      type="button"
      onClick={() => (open ? close() : setOpen(true))}
      aria-label={t.panelTitle}
      aria-expanded={open}
      className={cn("group fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] transition-transform duration-200 hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6", open && "max-sm:hidden")}
    >
      {busy ? <span className="assistant-orb absolute inset-0 rounded-full opacity-80" /> : null}
      <span className={cn("absolute flex items-center justify-center rounded-full bg-zinc-950", busy ? "inset-0.75" : "inset-0")}>
        {open ? <X className="size-5" /> : <Sparkles className="size-5 transition-transform group-hover:rotate-12" />}
      </span>
    </button>

    {open ? <section
      aria-label={t.panelTitle}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files); }}
      className={cn(
        "assistant-panel-in fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-zinc-200/80 bg-white/95 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:inset-x-auto sm:bottom-36 sm:right-4 sm:max-h-[min(40rem,calc(100dvh-12rem))] sm:w-100 sm:rounded-3xl lg:bottom-24 lg:right-6",
        wide && "sm:max-h-[calc(100dvh-10rem)] sm:w-[min(48rem,calc(100vw-2rem))] lg:max-h-[calc(100dvh-8rem)]",
      )}>
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5">
        <span className="relative flex size-9 shrink-0 items-center justify-center">
          {busy ? <span className="assistant-orb absolute -inset-0.75 rounded-full" /> : null}
          <span className="relative flex size-9 items-center justify-center rounded-full bg-linear-to-br from-zinc-900 to-zinc-600 text-white shadow-inner"><Sparkles className="size-4" /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-950">{t.panelTitle}</p>
          <p className="text-xs text-zinc-500">{busy ? t.thinkingBubble : t.panelSubtitle}</p>
        </div>
        <div role="radiogroup" aria-label="Language" className="flex shrink-0 rounded-full bg-zinc-100 p-0.5">
          {languages.map((item) => <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={lang === item.value}
            title={item.name}
            onClick={() => chooseLanguage(item.value)}
            className={cn("h-8 min-w-9 rounded-full px-2 text-xs font-semibold transition sm:h-7", lang === item.value ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
          >{item.label}</button>)}
        </div>
        <button type="button" onClick={() => setWide((value) => !value)} aria-label={wide ? "Smaller chat" : "Larger chat"} title={wide ? "Smaller chat" : "Larger chat"} className="hidden size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 sm:flex">{wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
        <button type="button" onClick={close} aria-label="Close" className="flex size-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 sm:size-8"><X className="size-4" /></button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {aiLock ? <PlanLockCard lock={aiLock} t={t} /> : null}
        {entries.length === 0 ? <div className="rounded-2xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-600">{t.emptyHint}</div> : null}
        {entries.map((entry) => entry.role === "user"
          ? <div key={entry.id} className="assistant-in ml-10 flex flex-col items-end">
            {entry.viaVoice ? <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-400"><Mic className="size-3" /> {t.youSaid}</p> : null}
            {entry.attachmentName ? <p className="mb-1 flex max-w-full items-center gap-1 truncate text-[11px] font-medium text-zinc-400"><Paperclip className="size-3 shrink-0" /> {entry.attachmentName}</p> : null}
            <p className="rounded-2xl rounded-br-md bg-zinc-950 px-3.5 py-2 text-sm leading-relaxed text-white"><MathText text={entry.text} /></p>
          </div>
          : entry.purchase
          ? <div key={entry.id} className="assistant-in min-w-0 rounded-2xl border border-zinc-200 bg-white p-3"><ChatPurchase /></div>
          : <div key={entry.id} className="assistant-in mr-2 min-w-0">
            {entry.source ? <p className={cn("mb-1 text-[11px] font-medium", entry.source === "ai" ? "text-indigo-500" : "text-amber-600")}>{entry.source === "ai" ? `✦ ${t.sourceAi}` : t.sourceFallback}</p> : null}
            <div className="min-w-0 rounded-2xl rounded-bl-md bg-zinc-100/80 px-3.5 py-2 text-sm leading-relaxed text-zinc-900">
              <ChatMarkdown text={entry.text} />
              {entry.image ? <figure className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not an optimizable asset */}
                <img src={entry.image} alt={entry.text} className="w-full rounded-xl border border-zinc-200 bg-white" />
                <a href={entry.image} download="assistant-image.webp" className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-900"><Download className="size-3" /> Download</a>
              </figure> : null}
              {entry.streaming ? <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-zinc-400 align-middle" aria-hidden /> : null}
              {entry.interrupted ? <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-zinc-400"><Square className="size-2.5 fill-current" /> {t.interruptedLabel}</p> : null}
              {entry.action || entry.streaming ? null : <button type="button" onClick={() => speak(entry.text)} className="mt-1 -ml-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-900"><Volume2 className="size-3" /> {t.listenAgain}</button>}
            </div>
            {entry.action ? <ActionCard action={entry.action} state={entry.draftState} t={t} onConfirm={() => void confirmAction()} onCancel={() => cancelAction()} /> : null}
          </div>)}
        {busy && !entries.at(-1)?.streaming ? <div className="assistant-in mr-6 flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-100/80 px-3.5 py-2.5">
          {[0, 0.15, 0.3].map((delay) => <span key={delay} className="voice-bar size-1.5 rounded-full bg-zinc-400" style={{ animationDelay: `${delay}s` }} />)}
        </div> : null}
      </div>

      {dragging ? <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-zinc-400 bg-white/90 text-sm font-medium text-zinc-700">
        <Paperclip className="mr-2 size-4" /> {t.dropHere}
      </div> : null}

      <div className="border-t border-zinc-100 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
        {voiceError ? <p role="alert" className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{voiceError}</p> : null}
        {attachments.length || reading ? <div className="mb-2 rounded-xl border border-zinc-200 bg-white p-1.5">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {attachments.map((file, index) => <div key={`${file.name}-${index}`} className="relative shrink-0">
              {file.mimeType.startsWith("image/")
                ? <button type="button" onClick={() => setViewing(images.findIndex((image) => image.index === index))} aria-label={`View ${file.name}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own upload, not an optimizable asset */}
                  <img src={`data:${file.mimeType};base64,${file.data}`} alt={file.name} title={`${file.name} · ${formatBytes(file.size)}`} className="size-14 rounded-lg object-cover ring-1 ring-zinc-200 transition hover:opacity-80" />
                </button>
                : <span title={file.name} className="flex size-14 flex-col items-center justify-center gap-0.5 rounded-lg bg-red-50 text-red-600 ring-1 ring-red-100"><FileText className="size-5" /><span className="text-[9px] font-semibold">PDF</span></span>}
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 text-[9px] font-semibold text-white tabular-nums">{index + 1}</span>
              <button type="button" onClick={() => setAttachments(attachments.filter((_, position) => position !== index))} aria-label={`${t.attachmentRemove}: ${file.name}`} className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-zinc-900 text-white shadow ring-2 ring-white"><X className="size-3" /></button>
            </div>)}
            {reading ? <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[10px] text-zinc-500">{t.attachmentReading}</span> : null}
            {attachments.length < MAX_ATTACHMENTS && !reading ? <button type="button" onClick={() => fileInputRef.current?.click()} aria-label={t.attachmentAdd} title={t.attachmentAdd} className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xl text-zinc-400 hover:border-zinc-400 hover:text-zinc-700">+</button> : null}
          </div>
          <div className="mt-1 flex items-center justify-between px-0.5 text-[11px] text-zinc-500">
            <span className="tabular-nums">{attachments.length}/{MAX_ATTACHMENTS} · {t.attachmentActive}</span>
            {attachments.length > 1 ? <button type="button" onClick={() => setAttachments([])} className="font-medium hover:text-zinc-900">{t.attachmentRemove}</button> : null}
          </div>
        </div> : null}
        {viewing !== null && images[viewing] ? <ImageViewer images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} /> : null}
        <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-1.5 transition focus-within:border-zinc-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-zinc-900/5">
          {/* At least three lines tall; grows with the text (where the browser supports it), then scrolls. */}
          <textarea
            rows={3}
            className="max-h-48 min-h-[4.75rem] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm leading-5 outline-none field-sizing-content placeholder:text-zinc-400"
            value={question}
            placeholder={voice.listening ? t.placeholderListening : attachment ? t.placeholderWithFile : t.placeholder}
            onChange={(event) => { typedBefore.current = null; setBox(event.target.value); }}
            onPaste={(event) => { if (event.clipboardData.files.length) { event.preventDefault(); void addFiles(event.clipboardData.files); } }}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={reading}
            aria-label={t.attach}
            title={t.attach}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-9 text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-900 disabled:opacity-40"
          ><Paperclip className="size-4" /></button>
          <button
            type="button"
            onClick={toggleListening}
            disabled={!voice.supported}
            aria-label={voice.listening ? t.voiceStopButton : t.speakButton}
            aria-pressed={voice.listening}
            title={!voice.supported ? t.noVoiceSupport : voice.listening ? t.voiceStopButton : t.speakButton}
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-9 transition disabled:opacity-40", voice.listening ? "bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.15)]" : "text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900")}
          >{voice.listening ? <VoiceWave className="h-3.5" /> : <Mic className="size-4" />}</button>
          {/* Nothing typed while an answer is coming or being spoken: the button stops it instead. */}
          {(busy || voicePlaying) && !question.trim() && !attachment ? <button
            type="button"
            onClick={() => interruptReply()}
            aria-label={t.stopReply}
            title={t.stopReply}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-9 bg-zinc-950 text-white transition hover:bg-zinc-800 active:scale-95"
          ><Square className="size-3.5 fill-current" /></button> : <button
            type="button"
            onClick={submit}
            disabled={reading || (!question.trim() && !attachment)}
            aria-label={t.send}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-9 bg-zinc-950 text-white transition hover:bg-zinc-800 active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400"
          ><ArrowUp className="size-4" /></button>}
        </div>
        {voice.listening ? <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-rose-600"><VoiceWave className="h-3" /> {t.voiceChatOn}</p> : null}
        {!voice.supported ? <p className="mt-2 px-1 text-[11px] text-zinc-500">{t.noVoiceSupport}</p> : null}
      </div>
    </section> : null}
  </>;
}
