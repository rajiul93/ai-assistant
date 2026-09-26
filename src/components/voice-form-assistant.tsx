"use client";

import { useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBestMic } from "@/lib/use-best-mic";
import { speak, stopSpeaking } from "@/lib/voice";

export type VoiceStep = { key: string; question: string; label: string };

export function VoiceFormAssistant({ title = "Voice form", steps, onComplete, compact }: { title?: string; steps: VoiceStep[]; onComplete: (answers: Record<string, string>) => void; /** Icon-only button, for tight rows. */ compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const voice = useBestMic({
    // The question being answered tells the transcriber what kind of answer to expect.
    context: () => steps[stepIndex]?.question ?? "",
    onInterim: (value) => { if (value !== "…") setTranscript(value); },
    onResult: (value) => setTranscript(value),
    onError: (error) => setVoiceError(error.message),
  });
  const current = steps[stepIndex];
  function startListening() { setVoiceError(""); voice.start(); }
  function close() { voice.stop(); stopSpeaking(); setOpen(false); }
  function begin() { setAnswers({}); setTranscript(""); setVoiceError(""); setStepIndex(0); setOpen(true); speak(steps[0].question); }
  function next() {
    if (!transcript.trim() || !current) return;
    voice.stop();
    const nextAnswers = { ...answers, [current.key]: transcript.trim() }; setAnswers(nextAnswers);
    if (stepIndex === steps.length - 1) { close(); onComplete(nextAnswers); return; }
    setTranscript(""); setVoiceError(""); setStepIndex((value) => value + 1); speak(steps[stepIndex + 1].question);
  }
  return <>
    {compact
      ? <Button type="button" variant="outline" onClick={begin} aria-label="Voice দিয়ে পূরণ করুন" title="Voice দিয়ে পূরণ করুন" className="size-11 shrink-0 p-0"><Mic /></Button>
      : <Button type="button" variant="outline" onClick={begin}><Mic /> Voice দিয়ে পূরণ করুন</Button>}
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><div><p className="font-semibold">{title}</p><p className="text-sm text-zinc-500">ধাপ {stepIndex + 1} / {steps.length}</p></div><Button type="button" size="icon" variant="ghost" onClick={close} aria-label="Close"><MicOff /></Button></div>
      <p className="mt-6 text-lg font-medium">{current?.question}</p>
      <textarea className="mt-4 min-h-16 w-full rounded-md border bg-zinc-50 p-4" value={transcript} placeholder="আপনার উত্তর শোনার অপেক্ষায়... ভুল শুনলে এখানে ঠিক করে নিন।" onChange={(event) => setTranscript(event.target.value)} aria-label={current?.label} />
      {voiceError ? <p role="alert" className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">{voiceError}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2"><Button type="button" onClick={startListening} disabled={!voice.supported || voice.listening}><Mic /> {voice.listening ? "শুনছি..." : transcript ? "আবার বলুন" : "বলুন"}</Button><Button type="button" variant="secondary" onClick={() => current && speak(current.question)}><Volume2 /> আবার শুনুন</Button><Button type="button" variant="outline" onClick={next} disabled={!transcript.trim()}>পরের ধাপ</Button></div>
      {!voice.supported ? <p className="mt-3 text-sm text-red-600">এই browser-এ voice recognition নেই। উত্তর লিখে দিতে পারেন, অথবা Chrome ব্যবহার করুন।</p> : null}<p className="mt-4 text-xs text-zinc-500">শেষ ধাপে উত্তরগুলো form-এ বসবে; confirmation ছাড়া save হবে না।</p>
    </div></div> : null}
  </>;
}
