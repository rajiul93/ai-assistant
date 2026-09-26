import { speechLangs, type AssistantLang } from "@/lib/assistant-i18n";
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
  return new Promise<boolean>((resolve) => {
    if (token !== speechToken) { resolve(false); return; }
    const audio = sharedAudio();
    const done = (ok: boolean) => {
      audio.onended = null;
      audio.onerror = null;
      interruptAudio = null;
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    interruptAudio = () => { audio.pause(); done(false); };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    audio.src = url;
    audio.play().catch(() => done(false));
  });
}

/**
 * Natural-sounding server voice, fetched as one clip: splitting a reply into pieces leaves audible
 * gaps between them. Returns false if it couldn't be played.
 */
async function speakWithServer(text: string, lang: AssistantLang, token: number) {
  const url = await fetchSpeech(text, lang);
  if (!url) return false;
  if (token !== speechToken) { URL.revokeObjectURL(url); return true; }
  return playUrl(url, token);
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

export function speak(text: string, onDone?: () => void) {
  if (typeof window === "undefined") { onDone?.(); return; }
  stopCurrent();
  const spoken = toSpokenText(text);
  if (!spoken) { onDone?.(); return; }
  const lang = useAssistantStore.getState().lang;
  const token = speechToken;
  const finish = () => {
    if (token !== speechToken) return;
    speaking = false;
    // Phone speakers echo a little after the last word; keep the mic closed a moment longer.
    quietUntil = Date.now() + (isMobileDevice() ? 900 : 500);
    onDone?.();
  };
  speaking = true;
  speakListeners.forEach((listener) => listener());
  if (Date.now() < serverVoiceOffUntil) { speakWithBrowser(spoken, lang, finish); return; }
  void speakWithServer(spoken, lang, token).then((played) => {
    if (token !== speechToken) return;
    if (played) finish();
    else speakWithBrowser(spoken, lang, finish);
  });
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
