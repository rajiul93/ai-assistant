"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assistantStrings } from "@/lib/assistant-i18n";
import type { AssistantReply, PendingAction, TimerStart } from "@/lib/assistant-types";
import { matchQuickCommand } from "@/lib/quick-commands";
import { createSpeechStream, speak } from "@/lib/voice";
import { createApplication } from "@/server/actions/applications";
import { createNote } from "@/server/actions/notes";
import { changeTaskRevisionCount, createTask, updateTaskStatus } from "@/server/actions/tasks";
import { findPendingAction, useAssistantStore } from "@/store/assistant";
import { useTimerStore } from "@/store/timer";
import { useTimerStartStore } from "@/store/timer-start";

// A reply to a waiting card is a confirmation when every word is a "yes/do it" word, e.g.
// "হ্যাঁ", "ঠিক আছে, সেভ করো", "ok save it", "yes please". Anything else goes to the AI.
const wordSet = (list: string[]) => new Set(list.map((word) => word.normalize("NFC")));
const yesWords = wordSet(["হ্যাঁ", "হ্যা", "হা", "হাঁ", "হুম", "জি", "জ্বি", "ঠিক", "আছে", "ওকে", "ok", "okay", "yes", "yeah", "yep", "sure", "save", "সেভ", "করো", "করে", "কর", "দাও", "দেন", "it", "do", "go", "ahead", "please", "প্লিজ", "শেষ", "যোগ", "এটা", "ওটা", "that", "done", "হয়েছে", "চলবে", "perfect", "good", "ভালো", "সব"]);
const strongYes = wordSet(["হ্যাঁ", "হ্যা", "হা", "হাঁ", "হুম", "জি", "জ্বি", "ঠিক", "ওকে", "ok", "okay", "yes", "yeah", "yep", "sure", "save", "সেভ", "perfect", "চলবে"]);
const noWords = wordSet(["না", "নাহ", "no", "nope", "cancel", "never", "mind", "বাতিল", "করো", "থাক", "থাকুক", "লাগবে", "দরকার", "নেই", "don't", "dont", "it", "please", "প্লিজ"]);
const strongNo = wordSet(["না", "নাহ", "no", "nope", "cancel", "বাতিল", "থাক", "থাকুক", "never"]);

function replyWords(text: string) {
  return text.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);
}

function isYes(text: string) {
  const words = replyWords(text);
  return words.length > 0 && words.length <= 7 && words.every((word) => yesWords.has(word)) && words.some((word) => strongYes.has(word));
}

function isNo(text: string) {
  const words = replyWords(text);
  return words.length > 0 && words.length <= 6 && words.every((word) => noWords.has(word)) && words.some((word) => strongNo.has(word));
}

type SendOptions = { voice?: boolean; alternatives?: string[] };

type StreamLine = { type: "delta"; text: string } | { type: "final"; reply: AssistantReply };

/** Reads the assistant's newline-delimited JSON stream: text pieces as they're written, then the reply. */
async function readReplyStream(body: ReadableStream<Uint8Array>, onText: (text: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line) as StreamLine;
      if (message.type === "delta") onText(message.text);
      else return message.reply;
    }
  }
  throw new Error("The reply stream ended early.");
}

export function useAssistant() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const entries = useAssistantStore((state) => state.entries);
  const busy = useAssistantStore((state) => state.busy);
  const open = useAssistantStore((state) => state.open);
  const setOpen = useAssistantStore((state) => state.setOpen);
  const lang = useAssistantStore((state) => state.lang);
  const t = assistantStrings[lang];

  function strings() {
    return assistantStrings[useAssistantStore.getState().lang];
  }

  function say(text: string, voice?: boolean) {
    useAssistantStore.getState().add({ role: "assistant", text });
    if (voice) speak(text);
  }

  /** Runs a confirmed action with the existing server actions; returns what to tell the user. */
  async function perform(action: PendingAction) {
    const s = strings();
    if (action.kind === "create_task") {
      const { draft } = action;
      await createTask({
        title: draft.title,
        description: draft.description,
        subjectId: draft.subjectId,
        topicId: "",
        estimatedMinutes: draft.estimatedMinutes,
        dueDate: draft.dueDate,
        priority: draft.priority,
        status: "NOT_STARTED",
      });
      return { status: s.savedStatus(draft.title), reply: s.savedReply(draft.title) };
    }
    if (action.kind === "complete_task") {
      await updateTaskStatus(action.taskId, "FINISHED");
      return { status: s.completedStatus(action.title), reply: s.completedReply(action.title) };
    }
    if (action.kind === "create_note") {
      await createNote({ title: action.title, content: action.content });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      return { status: s.noteAddedStatus(action.title), reply: s.noteAddedReply(action.title) };
    }
    if (action.kind === "add_application") {
      await createApplication(action.draft);
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      return { status: s.applicationAddedStatus(action.draft.title), reply: s.applicationAddedReply(action.draft.title) };
    }
    const times = await changeTaskRevisionCount(action.taskId, 1);
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    return { status: s.revisedStatus(action.title, times), reply: s.revisedReply(action.title, times) };
  }

  function progressText(action: PendingAction) {
    const s = strings();
    if (action.kind === "create_task") return s.savingTask(action.draft.title);
    if (action.kind === "complete_task") return s.completingTask(action.title);
    if (action.kind === "add_application") return s.addingApplication(action.draft.title);
    if (action.kind === "create_note") return s.addingNote(action.title);
    return s.revising(action.title);
  }

  async function confirmAction({ voice }: SendOptions = {}) {
    const store = useAssistantStore.getState();
    const s = strings();
    const entry = findPendingAction(store.entries);
    if (!entry?.action) return;
    store.update(entry.id, { draftState: "saving" });
    store.setLive({ stage: "thinking", text: progressText(entry.action), since: Date.now() });
    try {
      const result = await perform(entry.action);
      store.update(entry.id, { draftState: "saved" });
      store.setLive({ stage: "result", tone: "ok", text: result.status });
      toast.success(result.status);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
      say(result.reply, voice);
    } catch (error) {
      store.update(entry.id, { draftState: "pending" });
      store.setLive({ stage: "result", tone: "warn", text: s.saveFailedStatus });
      say(s.saveFailedReply(error instanceof Error ? error.message : ""), voice);
    }
  }

  function cancelAction({ voice }: SendOptions = {}) {
    const store = useAssistantStore.getState();
    const s = strings();
    const entry = findPendingAction(store.entries);
    if (!entry) return;
    store.update(entry.id, { draftState: "cancelled" });
    store.setLive({ stage: "result", tone: "ok", text: s.cancelledStatus });
    say(s.cancelledReply, voice);
  }

  /** Starting a timer saves nothing, so it happens right away; the session is saved later from the timer. */
  function startTimer(timer: TimerStart, reply: string, voice?: boolean) {
    const s = strings();
    const store = useAssistantStore.getState();
    const clock = useTimerStore.getState();
    router.push("/tasks");
    if (clock.running) {
      const text = s.timerAlreadyRunning;
      store.add({ role: "assistant", text });
      store.setLive({ stage: "result", tone: "warn", text });
      if (voice) speak(text);
      return;
    }
    // Every session needs a subject: without one from the voice command, ask with the picker.
    if (!timer.subjectId) {
      useTimerStartStore.getState().open({ minutes: timer.minutes, topicId: timer.topicId });
      store.add({ role: "assistant", text: s.pickerAskVoice, source: "ai" });
      store.setLive({ stage: "result", tone: "ok", text: s.pickerTitle });
      if (voice) speak(s.pickerAskVoice);
      return;
    }
    clock.setContext(timer.subjectId, timer.topicId);
    clock.setLabel(timer.topicName || timer.subjectName);
    clock.setTarget(timer.minutes);
    clock.start();
    store.add({ role: "assistant", text: reply, source: "ai" });
    store.setLive({ stage: "result", tone: "ok", text: s.timerStartedStatus(timer.minutes) });
    if (voice) speak(reply);
  }

  async function send(text: string, { voice, alternatives = [] }: SendOptions = {}) {
    const store = useAssistantStore.getState();
    const s = strings();
    const attachment = store.attachment;
    // A file alone is a request too: "tell me what's in this".
    const message = text.trim() || (attachment ? s.attachmentDefaultAsk : "");
    if (!message) return;

    // Page jumps, refresh and back run instantly — even while the AI is still busy with something else.
    // Every way the mic heard the sentence is checked, so one misheard word doesn't break the command.
    const quick = text.trim() ? matchQuickCommand([message, ...alternatives]) : null;
    if (quick) {
      const reply = quick.kind === "navigate" ? s.quick[quick.page] : s.quick[quick.kind];
      store.add({ role: "user", text: message, viaVoice: voice });
      store.add({ role: "assistant", text: reply });
      store.setLive({ stage: "result", tone: "ok", text: reply });
      if (voice) speak(reply);
      if (quick.kind === "navigate") router.push(quick.href);
      else if (quick.kind === "refresh") router.refresh();
      else if (quick.kind === "back") router.back();
      return;
    }
    if (store.busy) {
      store.setLive({ stage: "result", tone: "warn", text: s.stillBusy });
      return;
    }

    const pending = findPendingAction(store.entries);
    const history = store.entries.slice(-10).map(({ role, text: entryText }) => ({ role, text: entryText }));
    const userEntry = store.add({ role: "user", text: message, viaVoice: voice, attachmentName: attachment?.name });
    const wasOpen = store.open;
    // Spoken requests open the chat, so the user can read what was heard and what the assistant answers.
    if (voice) store.setOpen(true);

    // Short yes/no answers to a waiting action are handled locally, without a round trip.
    const heard = [message, ...alternatives];
    if (pending && heard.some(isNo)) return cancelAction({ voice });
    if (pending && heard.some(isYes)) return confirmAction({ voice });

    store.setBusy(true);
    store.setLive({ stage: "thinking", text: message, since: Date.now() });
    let result: AssistantReply;
    // The answer as it streams in: shown in one growing chat bubble and, for voice, spoken sentence by sentence.
    const stream = { entry: null as number | null, text: "", frame: 0, speaker: null as ReturnType<typeof createSpeechStream> | null };
    const showStreamed = () => {
      stream.frame = 0;
      if (stream.entry !== null) useAssistantStore.getState().update(stream.entry, { text: stream.text });
    };
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          alternatives,
          history,
          pending: pending?.action ?? null,
          voice: Boolean(voice),
          lang: store.lang,
          attachment: attachment ? { name: attachment.name, mimeType: attachment.mimeType, data: attachment.data } : null,
        }),
      });
      if (!response.ok) throw new Error("assistant request failed");
      result = (response.headers.get("content-type") ?? "").includes("ndjson") && response.body
        ? await readReplyStream(response.body, (piece) => {
          stream.text += piece;
          if (stream.entry === null) {
            stream.entry = store.add({ role: "assistant", text: stream.text, source: "ai", streaming: true });
            store.setLive({ stage: "result", tone: "ok", text: s.answeredStatus });
            if (voice) stream.speaker = createSpeechStream();
          } else if (!stream.frame) {
            // At most one re-render per frame, however fast the text arrives.
            stream.frame = requestAnimationFrame(showStreamed);
          }
          stream.speaker?.push(piece);
        })
        : (await response.json()) as AssistantReply;
    } catch {
      result = { type: "clarify", source: "fallback", reply: s.networkError };
    } finally {
      store.setBusy(false);
      if (stream.frame) cancelAnimationFrame(stream.frame);
      stream.speaker?.end();
    }

    if (stream.entry !== null) {
      if (result.type === "answer" || result.type === "clarify") {
        // Already shown and spoken while it streamed; settle the bubble on the final text.
        store.update(stream.entry, { text: result.reply, source: result.source, streaming: false });
        if (result.speak && !voice) speak(result.reply);
        return;
      }
      store.remove(stream.entry);
    }

    if (result.type === "ignore") {
      // Background talk: leave the chat as it was and say nothing.
      store.remove(userEntry);
      store.setOpen(wasOpen);
      store.setLive(null);
      return;
    }
    if (result.type === "start_timer") {
      startTimer(result.timer, result.reply, voice);
      return;
    }
    if (result.type === "image") {
      store.add({ role: "assistant", text: result.reply, source: result.source, image: result.image });
      store.setOpen(true);
    } else if (result.type === "confirm") {
      if (pending) store.update(pending.id, { draftState: "replaced" });
      store.add({ role: "assistant", text: result.reply, source: result.source, action: result.action, draftState: "pending" });
      store.setOpen(true);
    } else {
      store.add({ role: "assistant", text: result.reply, source: result.source });
    }
    store.setLive(result.source === "fallback"
      ? { stage: "result", tone: "warn", text: s.fallbackStatus }
      : { stage: "result", tone: "ok", text: result.type === "confirm" ? s.draftReadyStatus : result.type === "navigate" ? s.navigatingStatus : s.answeredStatus });
    if (voice || result.speak) speak(result.reply);
    if (result.type === "navigate") router.push(result.href);
  }

  return { entries, busy, open, setOpen, lang, t, send, confirmAction, cancelAction };
}
