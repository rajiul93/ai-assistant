"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAssistantSpeaking, voiceErrorMessage, type VoiceError } from "@/lib/voice";
import { useAssistantStore } from "@/store/assistant";

const TARGET_RATE = 16_000;
/** Audio kept from just before speech was detected, so the first syllable isn't cut off. */
const PRE_ROLL_MS = 600;
/** Sound must stay above the threshold this long to count as speech (a click or bang doesn't). */
const START_MS = 120;
/** A pause this long ends the sentence. */
// Long enough for a natural pause mid-sentence ("আমি... কাল physics পড়বো").
const END_SILENCE_MS = 1_100;
const MAX_UTTERANCE_MS = 15_000;
/** Shorter bursts are noise, not words; they aren't sent (or paid for). */
const MIN_SPEECH_MS = 350;
/** The lowest level treated as speech, for very quiet rooms. */
const MIN_LEVEL = 0.006;
/** How far above the room's background speech must rise to start / to keep a sentence going. */
const START_RATIO = 2.0;
const STAY_RATIO = 1.4;
/** Quiet or distant speech is boosted up to this much before sending, so the model hears it clearly. */
const MAX_BOOST = 8;

type Options = {
  /** Stop after the first sentence (a push-to-talk mic) instead of listening on. */
  once?: boolean;
  /** What was said just before (e.g. the assistant's last question), to help with short answers. */
  context?: () => string;
  /** The transcribed sentence ("" when nothing intelligible was said). */
  onText: (text: string) => void;
  /** Called when the user starts talking, before the words are known. */
  onSpeechStart?: () => void;
  onError: (error: VoiceError) => void;
};

type Capture = { stream: MediaStream; context: AudioContext; source: MediaStreamAudioSourceNode; nodes: AudioNode[]; processor: ScriptProcessorNode };

/** Mono float samples → 16 kHz 16-bit WAV, the smallest format the speech model reads well. */
function encodeWav(frames: Float32Array[], sampleRate: number) {
  const length = frames.reduce((total, frame) => total + frame.length, 0);
  const ratio = sampleRate / TARGET_RATE;
  const outLength = Math.floor(length / ratio);
  const buffer = new ArrayBuffer(44 + outLength * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, "RIFF"); view.setUint32(4, 36 + outLength * 2, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true); view.setUint32(28, TARGET_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, "data"); view.setUint32(40, outLength * 2, true);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const frame of frames) { samples.set(frame, offset); offset += frame.length; }
  // Bring a quiet (far-away) voice up to a clear level; loud speech is left as it is.
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const gain = peak > 0 ? Math.min(MAX_BOOST, 0.9 / peak) : 1;
  if (gain > 1.05) for (let index = 0; index < length; index++) samples[index] *= gain;
  for (let index = 0; index < outLength; index++) {
    // Average the samples each output sample covers: a simple low-pass before downsampling.
    const from = Math.floor(index * ratio);
    const to = Math.min(length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let position = from; position < to; position++) sum += samples[position];
    const value = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
    view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Always-on microphone that finds sentences itself and has OpenAI transcribe them. Unlike the
 * browser's recognizer it boosts quiet or distant voices, filters noise, handles Bangladeshi
 * accents, and never plays a start-up chime on phones.
 */
export function useVoiceCapture({ onText, onSpeechStart, onError, once = false, context: getContext }: Options) {
  const [listening, setListening] = useState(false);
  const captureRef = useRef<Capture | null>(null);
  const handlers = useRef({ onText, onSpeechStart, onError, getContext });
  useEffect(() => { handlers.current = { onText, onSpeechStart, onError, getContext }; });

  const stop = useCallback(() => {
    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) {
      capture.processor.onaudioprocess = null;
      capture.source.disconnect();
      capture.nodes.forEach((node) => node.disconnect());
      capture.processor.disconnect();
      capture.stream.getTracks().forEach((track) => track.stop());
      void capture.context.close().catch(() => {});
    }
    setListening(false);
  }, []);

  useEffect(() => stop, [stop]);

  const transcribe = useCallback(async (audio: Blob) => {
    const lang = useAssistantStore.getState().lang;
    try {
      const context = handlers.current.getContext?.().replace(/\s+/g, " ").trim().slice(0, 300);
      const response = await fetch(`/api/transcribe?lang=${lang}`, {
        method: "POST",
        // Header values must be ASCII, so the (often Bangla) context is URI-encoded.
        headers: { "Content-Type": "audio/wav", ...(context ? { "x-speech-context": encodeURIComponent(context) } : {}) },
        body: audio,
      });
      if (!response.ok) { handlers.current.onText(""); return; }
      const { text } = (await response.json()) as { text?: string };
      handlers.current.onText(text?.trim() ?? "");
    } catch {
      // One lost sentence on a flaky connection shouldn't switch the mic off, so this isn't the fatal "network" code.
      handlers.current.onError({ code: "transcribe-failed", message: voiceErrorMessage("network") });
    }
  }, []);

  const start = useCallback(async () => {
    if (captureRef.current) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      handlers.current.onError({ code: "unsupported", message: voiceErrorMessage("unsupported") });
      return false;
    }
    // Phones only let audio start inside the tap, so the context is created before any await.
    const context = new AudioContext();
    void context.resume();
    let stream: MediaStream;
    try {
      // The browser's own processing: cancels the assistant's voice, cuts background hiss, and
      // raises a quiet or distant voice to a usable level.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          // Newer Chrome/Safari can isolate the speaker's voice from the room; ignored where unsupported.
          ...({ voiceIsolation: true } as MediaTrackConstraints),
        },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      const code = name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : name === "NotFoundError" ? "audio-capture" : "start-failed";
      handlers.current.onError({ code, message: voiceErrorMessage(code) });
      void context.close().catch(() => {});
      return false;
    }
    const source = context.createMediaStreamSource(stream);
    // Keep the voice band only: below 80 Hz is fan/traffic rumble and handling noise, above 7 kHz
    // is hiss (and would be lost in the 16 kHz recording anyway). The level check then reacts to
    // speech, not to the room, which lets it notice quieter, more distant voices.
    const highpass = new BiquadFilterNode(context, { type: "highpass", frequency: 80, Q: 0.7 });
    const lowpass = new BiquadFilterNode(context, { type: "lowpass", frequency: 7_000, Q: 0.7 });
    const processor = context.createScriptProcessor(2048, 1, 1);
    const frameMs = (2048 / context.sampleRate) * 1000;

    let noiseFloor = MIN_LEVEL;
    let preRoll: Float32Array[] = [];
    let frames: Float32Array[] = [];
    let inSpeech = false;
    let loudMs = 0;
    let speechMs = 0;
    let silenceMs = 0;
    const reset = () => { inSpeech = false; frames = []; loudMs = 0; speechMs = 0; silenceMs = 0; };

    processor.onaudioprocess = (event) => {
      const samples = new Float32Array(event.inputBuffer.getChannelData(0));
      // The assistant's own voice isn't the user talking.
      if (isAssistantSpeaking()) { reset(); preRoll = []; return; }
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      const level = Math.sqrt(energy / samples.length);
      const threshold = Math.max(MIN_LEVEL, noiseFloor * START_RATIO);

      if (!inSpeech) {
        // Learn the room's background level slowly, so a fan or traffic isn't mistaken for speech.
        noiseFloor = Math.min(0.2, noiseFloor * 0.97 + level * 0.03);
        preRoll.push(samples);
        while (preRoll.length * frameMs > PRE_ROLL_MS) preRoll.shift();
        loudMs = level > threshold ? loudMs + frameMs : 0;
        if (loudMs >= START_MS) {
          inSpeech = true;
          frames = [...preRoll];
          speechMs = loudMs;
          preRoll = [];
          handlers.current.onSpeechStart?.();
        }
        return;
      }

      frames.push(samples);
      // A slightly lower bar to stay "in speech" than to enter it, so soft word endings aren't cut.
      if (level > Math.max(MIN_LEVEL, noiseFloor * STAY_RATIO)) { silenceMs = 0; speechMs += frameMs; } else silenceMs += frameMs;
      if (silenceMs >= END_SILENCE_MS || frames.length * frameMs >= MAX_UTTERANCE_MS) {
        const utterance = frames;
        const spokeFor = speechMs;
        reset();
        if (spokeFor < MIN_SPEECH_MS) { handlers.current.onText(""); return; }
        const audio = encodeWav(utterance, context.sampleRate);
        // Push-to-talk: the sentence is complete, so free the mic before the text comes back.
        if (once) stop();
        void transcribe(audio);
      }
    };
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(processor);
    // Chrome only runs the processor while it is connected to an output; it outputs silence.
    processor.connect(context.destination);
    captureRef.current = { stream, context, source, nodes: [highpass, lowpass], processor };
    setListening(true);
    return true;
  }, [transcribe, once, stop]);

  return { listening, start, stop };
}

/** Whether OpenAI speech-to-text can be used; otherwise the browser's recognizer is the fallback. */
export async function isCloudVoiceAvailable() {
  try {
    const response = await fetch("/api/transcribe", { signal: AbortSignal.timeout(6_000) });
    return response.ok && Boolean(((await response.json()) as { available?: boolean }).available);
  } catch {
    return false;
  }
}
