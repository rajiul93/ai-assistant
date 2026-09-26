"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { isCloudVoiceAvailable, useVoiceCapture } from "@/lib/use-voice-capture";
import { voiceErrorMessage, type VoiceError } from "@/lib/voice";

let availability: Promise<boolean> | null = null;
/** Asked once per page load and shared by every mic on the page. */
export function cloudVoiceAvailability() {
  availability ??= isCloudVoiceAvailable();
  return availability;
}

/** A push-to-talk mic waits this long for the user to start talking before giving up. */
const WAIT_FOR_SPEECH_MS = 12_000;

type Options = {
  onResult: (text: string, alternatives: string[]) => void;
  /** Words so far (browser recognizer) or "…" once speech is heard (OpenAI, which returns text at the end). */
  onInterim?: (text: string) => void;
  onError?: (error: VoiceError) => void;
  /** What was said just before, to help OpenAI with short answers. */
  context?: () => string;
};

/**
 * Push-to-talk mic for one sentence: OpenAI transcription when the user's key has it (far better
 * with accents, distance and noise), otherwise the browser's own recognizer.
 */
export function useBestMic({ onResult, onInterim, onError, context }: Options) {
  const [cloudReady, setCloudReady] = useState(false);
  useEffect(() => { void cloudVoiceAvailability().then(setCloudReady); }, []);
  const handlers = useRef({ onResult, onInterim, onError });
  useEffect(() => { handlers.current = { onResult, onInterim, onError }; });
  const waitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cloud = useVoiceCapture({
    once: true,
    context,
    onSpeechStart: () => { clearTimeout(waitTimer.current); handlers.current.onInterim?.("…"); },
    onText: (text) => {
      if (text) handlers.current.onResult(text, []);
      else handlers.current.onError?.({ code: "no-speech", message: voiceErrorMessage("no-speech") });
    },
    onError: (error) => handlers.current.onError?.(error),
  });
  const browser = useSpeechRecognition({
    onResult: (text, alternatives) => handlers.current.onResult(text, alternatives),
    onInterim: (text) => handlers.current.onInterim?.(text),
    onError: (error) => handlers.current.onError?.(error),
  });
  useEffect(() => () => clearTimeout(waitTimer.current), []);

  if (!cloudReady) return browser;
  return {
    supported: true,
    listening: cloud.listening,
    start: () => {
      clearTimeout(waitTimer.current);
      void cloud.start().then((started) => {
        if (!started) return;
        waitTimer.current = setTimeout(() => {
          cloud.stop();
          handlers.current.onError?.({ code: "no-speech", message: voiceErrorMessage("no-speech") });
        }, WAIT_FOR_SPEECH_MS);
      });
      return true;
    },
    stop: () => { clearTimeout(waitTimer.current); cloud.stop(); },
  };
}
