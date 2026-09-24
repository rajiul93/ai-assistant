"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, CircleCheck, Mic, RefreshCcw, Sparkles, Volume2, X } from "lucide-react";
import { VoiceWave } from "@/components/assistant-status";
import type { AssistantStrings } from "@/lib/assistant-i18n";
import type { PendingAction } from "@/lib/assistant-types";
import { useAssistant } from "@/lib/use-assistant";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/voice";
import { useAssistantStore, type AssistantEntry } from "@/store/assistant";

const priorityStyles = { LOW: "bg-zinc-100 text-zinc-600", MEDIUM: "bg-sky-50 text-sky-700", HIGH: "bg-rose-50 text-rose-700" } as const;

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
  } else {
    eyebrow = t.revisionLabel;
    title = action.topicName;
    description = action.notes;
    badge = <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"><RefreshCcw className="size-3.5" /></span>;
    rows = [[t.draftSubject, action.subjectName || "—"], [t.dateLabel, action.dateLabel]];
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
        <button type="button" onClick={onConfirm} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800 active:scale-[0.98]"><Check className="size-4" /> {confirmLabel}</button>
        <button type="button" onClick={onCancel} className="h-9 rounded-xl px-3.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100">{t.cancel}</button>
      </div>
      : <p className={cn("px-3.5 pb-3 text-xs font-medium", state === "saved" ? "text-emerald-600" : "text-zinc-500")}>{state ? t.draftStates[state] : null}</p>}
  </div>;
}

export function StudyAssistant() {
  const { entries, busy, open, setOpen, t, send, confirmAction, cancelAction } = useAssistant();
  const [question, setQuestion] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const setLive = useAssistantStore((state) => state.setLive);
  const voice = useSpeechRecognition({
    onInterim: (value) => { setQuestion(value); setLive({ stage: "listening", text: value }); },
    onResult: (value, alternatives) => { setQuestion(""); void send(value, { voice: true, alternatives }); },
    onError: (error) => { setQuestion(""); setVoiceError(error.message); setLive({ stage: "result", tone: "warn", text: error.message }); },
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, busy, open]);

  function toggleListening() {
    setVoiceError("");
    if (voice.listening) { voice.stop(); return; }
    if (voice.start()) setLive({ stage: "listening", text: "" });
  }

  function close() {
    voice.stop();
    setOpen(false);
  }

  function submit() {
    if (!question.trim() || busy) return;
    const value = question;
    setQuestion("");
    void send(value);
  }

  return <>
    <button
      type="button"
      onClick={() => (open ? close() : setOpen(true))}
      aria-label={t.panelTitle}
      aria-expanded={open}
      className="group fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] transition-transform duration-200 hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
    >
      {busy ? <span className="assistant-orb absolute inset-0 rounded-full opacity-80" /> : null}
      <span className={cn("absolute flex items-center justify-center rounded-full bg-zinc-950", busy ? "inset-0.75" : "inset-0")}>
        {open ? <X className="size-5" /> : <Sparkles className="size-5 transition-transform group-hover:rotate-12" />}
      </span>
    </button>

    {open ? <section aria-label={t.panelTitle} className="assistant-panel-in fixed inset-x-3 bottom-36 z-50 flex max-h-[min(40rem,calc(100dvh-12rem))] flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/95 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:w-100 lg:bottom-24 lg:right-6">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5">
        <span className="relative flex size-9 shrink-0 items-center justify-center">
          {busy ? <span className="assistant-orb absolute -inset-0.75 rounded-full" /> : null}
          <span className="relative flex size-9 items-center justify-center rounded-full bg-linear-to-br from-zinc-900 to-zinc-600 text-white shadow-inner"><Sparkles className="size-4" /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-950">{t.panelTitle}</p>
          <p className="text-xs text-zinc-500">{busy ? t.thinkingBubble : t.panelSubtitle}</p>
        </div>
        <button type="button" onClick={close} aria-label="Close" className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"><X className="size-4" /></button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {entries.length === 0 ? <div className="rounded-2xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-600">{t.emptyHint}</div> : null}
        {entries.map((entry) => entry.role === "user"
          ? <div key={entry.id} className="assistant-in ml-10 flex flex-col items-end">
            {entry.viaVoice ? <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-zinc-400"><Mic className="size-3" /> {t.youSaid}</p> : null}
            <p className="rounded-2xl rounded-br-md bg-zinc-950 px-3.5 py-2 text-sm leading-relaxed text-white">{entry.text}</p>
          </div>
          : <div key={entry.id} className="assistant-in mr-6">
            {entry.source ? <p className={cn("mb-1 text-[11px] font-medium", entry.source === "ai" ? "text-indigo-500" : "text-amber-600")}>{entry.source === "ai" ? `✦ ${t.sourceAi}` : t.sourceFallback}</p> : null}
            <div className="rounded-2xl rounded-bl-md bg-zinc-100/80 px-3.5 py-2 text-sm leading-relaxed text-zinc-900">
              <p className="whitespace-pre-wrap">{entry.text}</p>
              {entry.action ? null : <button type="button" onClick={() => speak(entry.text)} className="mt-1 -ml-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-900"><Volume2 className="size-3" /> {t.listenAgain}</button>}
            </div>
            {entry.action ? <ActionCard action={entry.action} state={entry.draftState} t={t} onConfirm={() => void confirmAction()} onCancel={() => cancelAction()} /> : null}
          </div>)}
        {busy ? <div className="assistant-in mr-6 flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-100/80 px-3.5 py-2.5">
          {[0, 0.15, 0.3].map((delay) => <span key={delay} className="voice-bar size-1.5 rounded-full bg-zinc-400" style={{ animationDelay: `${delay}s` }} />)}
        </div> : null}
      </div>

      <div className="border-t border-zinc-100 p-3">
        {voiceError ? <p role="alert" className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{voiceError}</p> : null}
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-1.5 transition focus-within:border-zinc-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-zinc-900/5">
          <textarea
            rows={1}
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-400"
            value={question}
            placeholder={voice.listening ? t.placeholderListening : t.placeholder}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }}
          />
          <button
            type="button"
            onClick={toggleListening}
            disabled={!voice.supported}
            aria-label={t.speakButton}
            title={voice.supported ? t.speakButton : t.noVoiceSupport}
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-40", voice.listening ? "bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.15)]" : "text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900")}
          >{voice.listening ? <VoiceWave className="h-3.5" /> : <Mic className="size-4" />}</button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !question.trim()}
            aria-label={t.send}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white transition hover:bg-zinc-800 active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400"
          ><ArrowUp className="size-4" /></button>
        </div>
        {!voice.supported ? <p className="mt-2 px-1 text-[11px] text-zinc-500">{t.noVoiceSupport}</p> : null}
      </div>
    </section> : null}
  </>;
}
