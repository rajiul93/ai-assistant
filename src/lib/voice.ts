import { speechLangs, type AssistantLang } from "@/lib/assistant-i18n";
import { createSentenceChunker } from "@/lib/sentence-chunker";
import { useAssistantStore } from "@/store/assistant";

export type VoiceError = { code: string; message: string };

export type SpeechResultEvent = Event & { resultIndex: number; results: SpeechRecognitionResultList };
export type SpeechErrorEvent = Event & { error: string };
export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;

export function getRecognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const browserWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
}

/** Phones end every recognition session after one sentence and play a system chime on each start. */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}

const errorMessages: Record<AssistantLang, Record<string, string>> = { bn: {
  "voice-paused": "অনেকক্ষণ কিছু শুনিনি, তাই mic বন্ধ করেছি। আবার বলতে mic-এ চাপ দিন।",
  "not-allowed": "Microphone-এর permission দেওয়া নেই। Address bar-এর বাঁ পাশের আইকনে ক্লিক করে Microphone “Allow” করুন, তারপর আবার চেষ্টা করুন।",
  "service-not-allowed": "Browser এই পাতায় voice recognition চালু করতে দিচ্ছে না। Chrome-এ খুলে আবার চেষ্টা করুন।",
  "audio-capture": "কোনো microphone পাওয়া যাচ্ছে না। Mic ঠিকমতো লাগানো আছে কি না দেখুন।",
  network: "Voice বোঝার জন্য internet লাগে। Connection দেখে আবার চেষ্টা করুন।",
  "no-speech": "আমি কিছু শুনতে পাইনি। Mic-এর একটু কাছে এসে আবার বলুন।",
  "language-not-supported": "এই browser বাংলা voice বুঝতে পারে না। Chrome ব্যবহার করে দেখুন।",
  unsupported: "এই browser-এ voice recognition নেই। Chrome ব্যবহার করে দেখুন।",
  "start-failed": "Microphone চালু করা গেল না। একটু পরে আবার চেষ্টা করুন।",
  other: "Microphone-এ একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",
}, en: {
  "voice-paused": "I paused the mic after a quiet spell. Tap the mic to talk again.",
  "not-allowed": "Microphone access is blocked. Click the icon at the left of the address bar, set Microphone to “Allow”, then try again.",
  "service-not-allowed": "The browser won't allow voice input on this page. Try opening it in Chrome.",
  "audio-capture": "I can't find a microphone. Check that one is connected.",
  network: "Voice input needs the internet. Check your connection and try again.",
  "no-speech": "I didn't catch anything. Try again a little closer to the mic.",
  "language-not-supported": "This browser can't recognise English speech. Try Chrome.",
  unsupported: "This browser has no voice input. Try Chrome.",
  "start-failed": "Couldn't start the microphone. Try again in a moment.",
  other: "Something went wrong with the microphone. Please try again.",
} };

export function voiceErrorMessage(code: string, lang: AssistantLang = useAssistantStore.getState().lang) {
  return errorMessages[lang][code] ?? errorMessages[lang].other;
}

/** Errors that will keep happening if we simply restart listening. */
export function isFatalVoiceError(code: string) {
  return ["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported", "unsupported"].includes(code);
}

let speaking = false;
let quietUntil = 0;
/** Bumped on every new reply or stop, so a reply that was interrupted doesn't finish later. */
let speechToken = 0;
let interruptAudio: (() => void) | null = null;
// When the server voice isn't available (no TTS access, offline), use the browser's voice for a while.
let serverVoiceOffUntil = 0;
const speakListeners = new Set<() => void>();

/** Called whenever the assistant starts talking, so an open mic can close before it hears the speaker. */
export function onAssistantSpeak(listener: () => void) {
  speakListeners.add(listener);
  return () => { speakListeners.delete(listener); };
}

/**
 * The most natural voice the device has for the language. Without an explicit voice, Chrome often
 * reads Bengali with an English voice, which sounds robotic. macOS ships "Piya" (bn-IN); its
 * "Enhanced"/"Premium" downloads sound far more human.
 */
function bestVoice(lang: AssistantLang) {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(lang));
  const score = (voice: SpeechSynthesisVoice) => {
    const code = voice.lang.toLowerCase().replace("_", "-");
    return (/premium|enhanced|natural|neural|siri/i.test(voice.name) ? 4 : 0)
      + (/google/i.test(voice.name) ? 2 : 0)
      + (lang === "bn" ? (code === "bn-bd" ? 1 : 0) : (code === "en-us" || code === "en-gb" ? 1 : 0))
      + (lang === "en" && /samantha|ava|daniel|karen/i.test(voice.name) ? 1 : 0);
  };
  return voices.sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Markdown symbols and links read aloud sound mechanical, so strip them before speaking. */
function toSpokenText(text: string) {
  return text
    // Code is for reading on screen, not for listening to.
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>~|]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

let audioElement: HTMLAudioElement | null = null;
function sharedAudio() {
  audioElement ??= new Audio();
  return audioElement;
}

/** A tiny silent WAV, played on the first tap so phones allow the shared audio element to play later. */
function silentWavUrl() {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((char, index) => { bytes[offset + index] = char.charCodeAt(0); });
  ascii(0, "RIFF"); view.setUint32(4, 38, true); ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, "data"); view.setUint32(40, 2, true);
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

if (typeof window !== "undefined") {
  // Phones only let a page play sound it first started from a tap; unlock the shared element then.
  const unlock = () => {
    const audio = sharedAudio();
    if (audio.src) return;
    audio.src = silentWavUrl();
    void audio.play().catch(() => {});
  };
  document.addEventListener("pointerdown", unlock, { once: true, capture: true });
}

// Recent clips by text, so a repeated phrase ("সেভ করেছি…", "Play" on the same reply) isn't bought twice.
const clipCache = new Map<string, Blob>();
const CLIP_CACHE_SIZE = 30;

function fetchSpeech(text: string, lang: AssistantLang) {
  const key = `${lang}:${text}`;
  const cached = clipCache.get(key);
  if (cached) return Promise.resolve(URL.createObjectURL(cached));
  // Don't keep the mic closed for long if the server is slow; the browser voice takes over.
  return fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }), signal: AbortSignal.timeout(12_000) })
    .then(async (response) => {
      if (response.ok) {
        const blob = await response.blob();
        clipCache.set(key, blob);
        if (clipCache.size > CLIP_CACHE_SIZE) clipCache.delete(clipCache.keys().next().value!);
        return URL.createObjectURL(blob);
      }
      // No TTS access or no key: don't ask again for every reply.
      serverVoiceOffUntil = Date.now() + ([401, 403, 404, 503].includes(response.status) ? 30 * 60_000 : 60_000);
      return null;
    })
    .catch(() => null);
}

function playUrl(url: string, token: number) {
  return playSource(url, token, () => URL.revokeObjectURL(url));
}

/**
 * Plays a clip straight from the speech stream: the <audio> element starts as soon as the first
 * audio bytes arrive (about a second), instead of after the whole clip has been made.
 */
function playStreamed(text: string, lang: AssistantLang, token: number) {
  const src = `/api/speech?${new URLSearchParams({ lang, text })}`;
  return playSource(src, token).then((ok) => {
    // A stream that fails before playing (no AI access, server down): use the browser voice for a while.
    if (!ok && token === speechToken) serverVoiceOffUntil = Date.now() + 60_000;
    return ok;
  });
}

function playSource(src: string, token: number, cleanup?: () => void) {
  return new Promise<boolean>((resolve) => {
    if (token !== speechToken) { cleanup?.(); resolve(false); return; }
    const audio = sharedAudio();
    const done = (ok: boolean) => {
      audio.onended = null;
      audio.onerror = null;
      interruptAudio = null;
      cleanup?.();
      resolve(ok);
    };
    interruptAudio = () => { audio.pause(); done(false); };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    audio.src = src;
    audio.play().catch(() => done(false));
  });
}

/** The device's own voice: free and instant, but often robotic in Bengali. */
function speakWithBrowser(text: string, lang: AssistantLang, finish: () => void) {
  if (!window.speechSynthesis) { finish(); return; }
  const voice = bestVoice(lang);
  // Short sentence-sized utterances sound more natural and avoid Chrome cutting off long speech.
  const sentences = text.match(/[^।!?.]+[।!?.]*/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  if (sentences.length === 0) { finish(); return; }
  const utterances = sentences.map((sentence) => {
    const utterance = new SpeechSynthesisUtterance(sentence);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? speechLangs[lang];
    utterance.rate = 1.05;
    return utterance;
  });
  const last = utterances[utterances.length - 1];
  last.onend = finish;
  last.onerror = finish;
  utterances.forEach((utterance) => window.speechSynthesis.speak(utterance));
}

function stopCurrent() {
  speechToken++;
  interruptAudio?.();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/** Says a whole text: the same sentence-by-sentence streaming path as a live answer. */
export function speak(text: string, onDone?: () => void) {
  const stream = createSpeechStream(onDone);
  stream.push(text);
  stream.end();
}

/** Clips fetched ahead of the one playing, so the next sentence is ready the moment one ends. */
const STREAM_LOOKAHEAD = 3;

/**
 * Speaks an answer while it is still being written. Text goes in as it arrives (`push`); it is cut
 * into sentence/phrase chunks, each chunk's audio is fetched right away (a few ahead), and the
 * chunks play back to back. The first words are heard as soon as the first sentence is complete —
 * never after the whole answer. Starting another reply (or stopSpeaking) cancels it.
 */
export function createSpeechStream(onDone?: () => void) {
  if (typeof window === "undefined") return { push() {}, end() { onDone?.(); } };
  stopCurrent();
  const token = speechToken;
  const lang = useAssistantStore.getState().lang;
  type Clip = { text: string; url: Promise<string | null> | null };
  const cached = (text: string) => clipCache.has(`${lang}:${text}`);
  const queue: Clip[] = [];
  let started = false;
  let playing = false;
  let ended = false;

  const finish = () => {
    if (token !== speechToken) return;
    speaking = false;
    quietUntil = Date.now() + (isMobileDevice() ? 900 : 500);
    onDone?.();
  };
  const prefetch = () => {
    if (Date.now() < serverVoiceOffUntil) return;
    for (const clip of queue.slice(0, STREAM_LOOKAHEAD)) clip.url ??= fetchSpeech(clip.text, lang);
  };
  const browserSays = (text: string) => new Promise<void>((resolve) => speakWithBrowser(text, lang, resolve));

  async function pump() {
    if (playing) return;
    playing = true;
    while (queue.length && token === speechToken) {
      const clip = queue.shift()!;
      // Get the clips behind this one ready while it plays.
      prefetch();
      const serverOn = Date.now() >= serverVoiceOffUntil;
      if (!clip.url && serverOn && !cached(clip.text)) {
        // Nothing fetched yet (usually the first sentence): play it as it streams in.
        if (!(await playStreamed(clip.text, lang, token)) && token === speechToken) await browserSays(clip.text);
        continue;
      }
      const url = clip.url ? await clip.url : serverOn ? await fetchSpeech(clip.text, lang) : null;
      if (token !== speechToken) { if (url) URL.revokeObjectURL(url); break; }
      if (!url || !(await playUrl(url, token))) {
        if (token !== speechToken) break;
        await browserSays(clip.text);
      }
    }
    playing = false;
    if (ended && !queue.length && token === speechToken) finish();
  }

  const chunker = createSentenceChunker((chunk) => {
    if (token !== speechToken) return;
    const text = toSpokenText(chunk);
    if (!text) return;
    if (!started) {
      started = true;
      // From the first sentence on, the mic treats everything it hears as the assistant's voice.
      speaking = true;
      speakListeners.forEach((listener) => listener());
    }
    queue.push({ text, url: null });
    // pump() takes the first clip synchronously, so it streams; prefetch() then covers the rest.
    void pump();
    prefetch();
  });

  return {
    push(piece: string) { if (token === speechToken) chunker.push(piece); },
    end() {
      if (token !== speechToken) return;
      chunker.end();
      ended = true;
      if (!started) onDone?.();
      else if (!playing && !queue.length) finish();
    },
  };
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  // Voices load asynchronously; touching the list early makes them ready by the first reply.
  window.speechSynthesis.getVoices();
}

export function stopSpeaking() {
  stopCurrent();
  speaking = false;
}

/** True while the assistant is talking (plus a short tail), so the mic doesn't hear the speaker. */
export function isAssistantSpeaking() {
  return speaking || Date.now() < quietUntil;
}
