"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speechLangs } from "@/lib/assistant-i18n";
import { useAssistantStore } from "@/store/assistant";
import { getRecognitionConstructor, isAssistantSpeaking, isFatalVoiceError, isMobileDevice, onAssistantSpeak, stopSpeaking, voiceErrorMessage, type Recognition, type VoiceError } from "@/lib/voice";

/** On phones, stop auto-restarting after this many silent sessions in a row: each restart plays a chime. */
const MOBILE_SILENT_SESSIONS = 3;

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

    const mobile = isMobileDevice();
    const recognition = new Constructor();
    recognition.lang = lang;
    // Android's continuous mode re-sends earlier sentences, so phones listen one sentence per session.
    recognition.continuous = continuous && !mobile;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    let heard = false;
    let failed = false;
    // Chrome gives up after a few silent seconds; a one-shot mic keeps waiting up to 15s so the user can think first.
    const startedAt = Date.now();
    let retryOnEnd = false;
    let heardThisSession = false;
    let silentSessions = 0;
    let lastFinal = { text: "", at: 0 };
    let pausedForSpeech = false;
    // Phones finalise a sentence late, after the reply has finished, so ignoring results while the
    // assistant talks isn't enough: close the session and reopen it once the speaker is quiet.
    const unsubscribeSpeak = continuous ? onAssistantSpeak(() => {
      if (recognitionRef.current !== recognition) { unsubscribeSpeak?.(); return; }
      pausedForSpeech = true;
      recognition.abort();
    }) : null;

    recognition.onresult = (event) => {
      // Ignore the assistant's own voice coming back through the speakers.
      if (continuous && isAssistantSpeaking()) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (!result.isFinal) { interim += transcript; continue; }
        if (!transcript.trim()) continue;
        // Android sometimes reports the same sentence twice; sending it again would reopen the chat.
        if (transcript.trim() === lastFinal.text && Date.now() - lastFinal.at < 5_000) continue;
        lastFinal = { text: transcript.trim(), at: Date.now() };
        heard = true;
        heardThisSession = true;
        const alternatives = Array.from({ length: result.length }, (_, alt) => result[alt]?.transcript?.trim() ?? "").filter(Boolean).slice(1);
        handlers.current.onResult(transcript.trim(), alternatives);
      }
      if (interim.trim()) handlers.current.onInterim?.(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      // Not on phones: every retry plays the system chime.
      if (!continuous && !mobile && !heard && event.error === "no-speech" && Date.now() - startedAt < 15_000) { retryOnEnd = true; return; }
      if (continuous && !isFatalVoiceError(event.error)) return; // e.g. no-speech: just keep listening
      failed = true;
      wantedRef.current = false;
      fail(event.error);
    };
    const finish = (code?: string) => {
      unsubscribeSpeak?.();
      recognitionRef.current = null;
      wantedRef.current = false;
      setListening(false);
      if (code) fail(code);
    };
    const restart = () => {
      if (recognitionRef.current !== recognition || !wantedRef.current) return;
      // Wait out the assistant's reply so the chime and the mic don't land on top of it.
      if (isAssistantSpeaking()) { window.setTimeout(restart, 400); return; }
      try { recognition.start(); } catch { finish(); }
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) { unsubscribeSpeak?.(); return; }
      if (pausedForSpeech) {
        // Closed on purpose for the reply; not a silent session.
        pausedForSpeech = false;
        heardThisSession = false;
        if (wantedRef.current) { window.setTimeout(restart, 300); return; }
        finish();
        return;
      }
      silentSessions = heardThisSession ? 0 : silentSessions + 1;
      heardThisSession = false;
      if (continuous && wantedRef.current) {
        if (mobile && silentSessions >= MOBILE_SILENT_SESSIONS) { finish("voice-paused"); return; }
        if (mobile || isAssistantSpeaking()) { window.setTimeout(restart, 400); return; }
        try { recognition.start(); return; } catch { /* fall through and stop */ }
      } else if (retryOnEnd) {
        retryOnEnd = false;
        try { recognition.start(); return; } catch { /* fall through and stop */ }
      }
      finish(!continuous && !heard && !failed ? "no-speech" : undefined);
    };

    recognitionRef.current = recognition;
    wantedRef.current = true;
    try {
      recognition.start();
    } catch {
      unsubscribeSpeak?.();
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
