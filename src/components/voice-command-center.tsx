"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { AssistantStatus, VoiceWave } from "@/components/assistant-status";
import { assistantStrings, type AssistantLang } from "@/lib/assistant-i18n";
import { useAssistant } from "@/lib/use-assistant";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { isCloudVoiceAvailable, useVoiceCapture } from "@/lib/use-voice-capture";
import { cn } from "@/lib/utils";
import { isFatalVoiceError, speak, stopSpeaking, voiceErrorMessage, type VoiceError } from "@/lib/voice";
import { quotaExceeded, type AiQuota } from "@/lib/ai-limits";
import type { AiAccessState } from "@/server/ai-access";
import { useAssistantStore } from "@/store/assistant";

const stopPhrases = ["ai বন্ধ", "বন্ধ করো", "শোনা বন্ধ", "stop listening", "ai off", "turn off voice"];
const languages: Array<{ value: AssistantLang; label: string; name: string }> = [
  { value: "bn", label: "বাং", name: "বাংলা" },
  { value: "en", label: "EN", name: "English" },
];

export function VoiceCommandCenter({ aiAccess, aiQuota }: { aiAccess: AiAccessState; aiQuota: AiQuota }) {
  const { send, t } = useAssistant();
  const lang = useAssistantStore((state) => state.lang);
  const setLang = useAssistantStore((state) => state.setLang);
  const setLive = useAssistantStore((state) => state.setLive);

  useEffect(() => { useAssistantStore.getState().loadLang(); }, []);

  // OpenAI transcription hears accents and distant voices far better; the browser's recognizer is
  // the fallback when the key has no speech-to-text model. Checked up front so no sentence is lost.
  const [cloudAvailable, setCloudAvailable] = useState(false);
  useEffect(() => { void isCloudVoiceAvailable().then(setCloudAvailable); }, []);
  const cloud = useVoiceCapture({
    onSpeechStart: () => setLive({ stage: "listening", text: "…" }),
    onText: (text) => {
      if (text) { handleSystemCommand(text, []); return; }
      if (useAssistantStore.getState().live?.stage === "listening") setLive(null);
    },
    onError: (error) => { reportError(error); if (isFatalVoiceError(error.code)) cloud.stop(); },
  });

  const system = useSpeechRecognition({
    continuous: true,
    onInterim: (text) => setLive({ stage: "listening", text }),
    onResult: (value, alternatives) => handleSystemCommand(value, alternatives),
    onError: (error) => reportError(error),
  });
  // start() is rebuilt when the language changes; keep the latest one for delayed restarts.
  const systemStart = useRef(system.start);
  useEffect(() => { systemStart.current = system.start; });

  function reportError(error: VoiceError) {
    setLive({ stage: "result", tone: "warn", text: error.message });
    // Only speak problems the user must fix; a missed sentence is shown quietly instead of interrupting.
    if (isFatalVoiceError(error.code)) speak(error.message);
  }

  function chooseLanguage(value: AssistantLang) {
    if (value === lang) return;
    setLang(value);
    setLive({ stage: "result", tone: "ok", text: `${assistantStrings[value].langName} ✓` });
    // Restart a running browser recognizer so it listens in the new language (OpenAI reads the language per sentence).
    if (system.listening) {
      system.stop();
      window.setTimeout(() => systemStart.current(), 300);
    }
  }

  function handleSystemCommand(raw: string, alternatives: string[]) {
    // A backgrounded tab isn't being talked to, and a single letter is just noise.
    if (document.hidden || raw.replace(/[^\p{L}]/gu, "").length < 2) return;
    const command = raw.toLowerCase().trim();
    if (stopPhrases.some((phrase) => command.includes(phrase))) { toggleSystem(); return; }
    void send(raw, { voice: true, alternatives });
  }

  const listening = cloud.listening || system.listening;

  function toggleSystem() {
    if (listening) {
      cloud.stop();
      system.stop();
      stopSpeaking();
      setLive({ stage: "result", tone: "ok", text: t.voiceStoppedStatus });
      return;
    }
    // Without AI access the mic would only hear "not allowed"; show why and where to ask instead.
    if ((aiAccess !== "ADMIN" && aiAccess !== "APPROVED") || quotaExceeded(aiQuota)) {
      setLive({ stage: "result", tone: "warn", text: t.aiLockedStatus });
      useAssistantStore.getState().setOpen(true);
      return;
    }
    if (cloudAvailable) {
      void cloud.start().then((started) => { if (started) setLive(null); });
      return;
    }
    if (!system.supported) { reportError({ code: "unsupported", message: voiceErrorMessage("unsupported") }); return; }
    if (!system.start()) return;
    setLive(null);
  }

  return <>
    {/* Phones: sits inside the header bar; desktop: floats top-right. */}
    <div className="fixed right-2 top-[calc(0.375rem+env(safe-area-inset-top))] z-40 flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white/80 p-1 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:right-6 lg:top-4">
      <div role="radiogroup" aria-label="Language" className="flex rounded-full bg-zinc-100 p-0.5">
        {languages.map((item) => <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={lang === item.value}
          title={item.name}
          onClick={() => chooseLanguage(item.value)}
          className={cn(
            "h-9 min-w-10 rounded-full px-2.5 text-xs font-semibold transition-all duration-200 lg:h-7 lg:min-w-9",
            lang === item.value ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
          )}
        >{item.label}</button>)}
      </div>
      <button
        type="button"
        onClick={toggleSystem}
        aria-pressed={listening}
        title={t.voiceToggleHint}
        className={cn(
          "flex h-10 min-w-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-all duration-200 lg:h-8",
          listening ? "bg-zinc-950 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.15)]" : "text-zinc-700 hover:bg-zinc-100",
        )}
      >
        {listening ? <VoiceWave className="h-3.5 text-rose-400" /> : <Mic className="size-4" />}
        <span className="hidden sm:inline">{listening ? t.voiceOn : t.voiceOff}</span>
      </button>
    </div>
    <AssistantStatus />
  </>;
}
