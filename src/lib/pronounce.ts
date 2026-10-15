"use client";

import { useEffect, useState } from "react";

/**
 * Says an English word aloud with the browser's own voice (free, no AI, works offline on most
 * phones). For vocabulary pronunciation only, so it is open to everyone — an exception to the
 * admin-only voice rule in voice-access.ts (owner, 2026-10-15).
 */

let speakingText: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function englishVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === "en-US" && /Google|Samantha|Natural/i.test(voice.name))
    ?? voices.find((voice) => voice.lang === "en-US")
    ?? voices.find((voice) => voice.lang.startsWith("en"))
    ?? null;
}

export const canPronounce = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Speaks `text` (stopping anything already speaking); tapping the same word again stops it. */
export function pronounce(text: string) {
  if (!canPronounce()) return;
  const synth = window.speechSynthesis;
  const again = speakingText === text;
  synth.cancel();
  speakingText = null;
  notify();
  if (again) return;
  // "learnt / learned", "un-": say the words, not the marks between them.
  const words = text.replace(/\s*\/\s*/g, ", ").replace(/-/g, " ").trim();
  if (!words) return;
  const utterance = new SpeechSynthesisUtterance(words);
  const voice = englishVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? "en-US";
  utterance.rate = 0.85;
  utterance.onend = utterance.onerror = () => { if (speakingText === text) { speakingText = null; notify(); } };
  speakingText = text;
  notify();
  synth.speak(utterance);
}

/** True while `text` is being spoken (for the speaker button's animation). */
export function useSpeaking(text: string) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const update = () => setSpeaking(speakingText === text);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, [text]);
  return speaking;
}
