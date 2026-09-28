"use client";

import { useEffect, useRef, useState } from "react";
import { interruptReply } from "@/lib/use-assistant";
import { cloudVoiceAvailability } from "@/lib/use-best-mic";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useVoiceCapture } from "@/lib/use-voice-capture";
import { isAssistantEcho, isFatalVoiceError, isSpeechPaused, pauseSpeaking, resumeSpeaking, speak, stopSpeaking, voiceErrorMessage, type VoiceError } from "@/lib/voice";
import { useAssistantStore } from "@/store/assistant";

const stopPhrases = ["ai বন্ধ", "বন্ধ করো", "শোনা বন্ধ", "stop listening", "ai off", "turn off voice"];
// Said on their own, these only stop the answer being spoken (the mic stays on), like ChatGPT.
const hushPhrases = new Set(["থামো", "থাম", "থামুন", "থামাও", "চুপ", "চুপ করো", "চুপ কর", "আচ্ছা থামো", "ঠিক আছে থামো", "এক মিনিট", "দাঁড়াও", "stop", "stop it", "wait", "hold on", "enough", "okay stop", "ok stop", "shut up", "be quiet"]);

type Options = {
  /** The words heard so far, while the user is still talking ("" clears them). */
  onDraft: (text: string) => void;
  /** A finished sentence to send to the assistant. */
  onSentence: (text: string, alternatives: string[]) => void;
  onError: (error: VoiceError) => void;
  /** Turned off with a spoken "AI বন্ধ" / "stop listening". */
  onStopped: () => void;
};

/**
 * Hands-free chat from the message box, like ChatGPT's voice mode: once on, the mic keeps
 * listening; what the user says is typed into the box live, each finished sentence is sent, and
 * the answer is spoken. Talking over an answer interrupts it (see use-voice-capture's barge-in).
 * OpenAI transcription is used when the key has it; otherwise the browser's own recognizer.
 */
export function useVoiceChat({ onDraft, onSentence, onError, onStopped }: Options) {
  const [cloudAvailable, setCloudAvailable] = useState(false);
  useEffect(() => { void cloudVoiceAvailability().then(setCloudAvailable); }, []);
  const handlers = useRef({ onDraft, onSentence, onError, onStopped });
  useEffect(() => { handlers.current = { onDraft, onSentence, onError, onStopped }; });

  /** Hush / off phrases and noise are handled here; anything else is a message. */
  function heard(raw: string, alternatives: string[]) {
    handlers.current.onDraft("");
    // A backgrounded tab isn't being talked to, and a single letter is just noise.
    if (document.hidden || raw.replace(/[^\p{L}]/gu, "").length < 2) { resumeSpeaking(); return; }
    const command = raw.toLowerCase().trim();
    if (stopPhrases.some((phrase) => command.includes(phrase))) { stop(); handlers.current.onStopped(); return; }
    if (hushPhrases.has(command.replace(/[^\p{L}\p{M}\s]/gu, "").replace(/\s+/g, " ").trim())) {
      interruptReply();
      return;
    }
    handlers.current.onSentence(raw, alternatives);
  }

  function reportError(error: VoiceError) {
    handlers.current.onError(error);
    // Only speak problems the user must fix; a missed sentence is shown quietly instead.
    if (isFatalVoiceError(error.code)) { stop(); speak(error.message); }
  }

  const cloud = useVoiceCapture({
    // The assistant returns the corrected wording with its answer, so no separate clean-up call (and wait).
    fixText: false,
    // Words appear in the box while they are being said (OpenAI live transcription).
    live: true,
    context: () => useAssistantStore.getState().entries.findLast((entry) => entry.role === "assistant")?.text ?? "",
    onSpeechStart: () => handlers.current.onDraft("…"),
    // Talking over the assistant holds its voice at once; the words then decide what happens.
    onBargeIn: () => { pauseSpeaking(); },
    onPartial: (text) => handlers.current.onDraft(text),
    onText: (text) => {
      // The assistant's own voice leaking back through the speaker is not a new command.
      const echo = isSpeechPaused() && text.split(/\s+/).length >= 3 && isAssistantEcho(text);
      if (text && !echo) { heard(text, []); return; }
      // A cough, a noise or an echo: carry on talking.
      handlers.current.onDraft("");
      resumeSpeaking();
    },
    onError: reportError,
  });

  const system = useSpeechRecognition({
    continuous: true,
    onInterim: (text) => handlers.current.onDraft(text),
    onResult: (value, alternatives) => heard(value, alternatives),
    onError: reportError,
  });
  // start() is rebuilt when the language changes; keep the latest one for delayed restarts.
  const systemStart = useRef(system.start);
  useEffect(() => { systemStart.current = system.start; });

  const listening = cloud.listening || system.listening;

  function stop() {
    cloud.stop();
    system.stop();
    stopSpeaking();
    handlers.current.onDraft("");
  }

  async function start() {
    if (await cloudVoiceAvailability()) return cloud.start();
    if (!system.supported) { reportError({ code: "unsupported", message: voiceErrorMessage("unsupported") }); return false; }
    return system.start();
  }

  /** The browser recognizer listens in one language; restart it after a switch (OpenAI reads the language per sentence). */
  function languageChanged() {
    if (!system.listening) return;
    system.stop();
    window.setTimeout(() => systemStart.current(), 300);
  }

  return { listening, supported: cloudAvailable || system.supported, start, stop, languageChanged };
}
