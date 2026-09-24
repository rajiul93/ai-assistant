"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speechLangs } from "@/lib/assistant-i18n";
import { useAssistantStore } from "@/store/assistant";
import { getRecognitionConstructor, isAssistantSpeaking, isFatalVoiceError, stopSpeaking, voiceErrorMessage, type Recognition, type VoiceError } from "@/lib/voice";

type Options = {
  /** Keep listening (and auto-restart) until stop() is called. */
  continuous?: boolean;
  /** The best guess plus up to four other ways the recogniser heard the same sentence. */
  onResult: (transcript: string, alternatives: string[]) => void;
  /** Words recognised so far, before the sentence is final — for showing live what the mic hears. */
  onInterim?: (transcript: string) => void;
  /** Called once when listening fails or (one-shot mode) ends without hearing anything. */
  onError?: (error: VoiceError) => void;
};

const noopSubscribe = () => () => {};

export function useSpeechRecognition({ continuous = false, onResult, onInterim, onError }: Options) {
  const lang = speechLangs[useAssistantStore((state) => state.lang)];
  const supported = useSyncExternalStore(noopSubscribe, () => Boolean(getRecognitionConstructor()), () => false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const wantedRef = useRef(false);
  const handlers = useRef({ onResult, onInterim, onError });
  useEffect(() => { handlers.current = { onResult, onInterim, onError }; });

  const stop = useCallback(() => {
    wantedRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    setListening(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    const fail = (code: string) => handlers.current.onError?.({ code, message: voiceErrorMessage(code) });
    const Constructor = getRecognitionConstructor();
    if (!Constructor) { fail("unsupported"); return false; }
    recognitionRef.current?.abort();
    // In one-shot mode the user pressed the mic to talk, so don't talk over them.
    if (!continuous) stopSpeaking();

    const recognition = new Constructor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    let heard = false;
    let failed = false;
    // Chrome gives up after a few silent seconds; a one-shot mic keeps waiting up to 15s so the user can think first.
    const startedAt = Date.now();
    let retryOnEnd = false;

    recognition.onresult = (event) => {
      // Ignore the assistant's own voice coming back through the speakers.
      if (continuous && isAssistantSpeaking()) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (!result.isFinal) { interim += transcript; continue; }
        if (!transcript.trim()) continue;
        heard = true;
        const alternatives = Array.from({ length: result.length }, (_, alt) => result[alt]?.transcript?.trim() ?? "").filter(Boolean).slice(1);
        handlers.current.onResult(transcript.trim(), alternatives);
      }
      if (interim.trim()) handlers.current.onInterim?.(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      if (!continuous && !heard && event.error === "no-speech" && Date.now() - startedAt < 15_000) { retryOnEnd = true; return; }
      if (continuous && !isFatalVoiceError(event.error)) return; // e.g. no-speech: just keep listening
      failed = true;
      wantedRef.current = false;
      fail(event.error);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      if ((continuous && wantedRef.current) || retryOnEnd) {
        retryOnEnd = false;
        try { recognition.start(); return; } catch { /* fall through and stop */ }
      }
      recognitionRef.current = null;
      wantedRef.current = false;
      setListening(false);
      if (!continuous && !heard && !failed) fail("no-speech");
    };

    recognitionRef.current = recognition;
    wantedRef.current = true;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      wantedRef.current = false;
      fail("start-failed");
      return false;
    }
    setListening(true);
    return true;
  }, [continuous, lang]);

  return { supported, listening, start, stop };
}
