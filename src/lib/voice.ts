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

let currentUtterance: SpeechSynthesisUtterance | null = null;
let quietUntil = 0;
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

export function speak(text: string, onDone?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onDone?.(); return; }
  window.speechSynthesis.cancel();
  const lang = useAssistantStore.getState().lang;
  const voice = bestVoice(lang);
  // Short sentence-sized utterances sound more natural and avoid Chrome cutting off long speech.
  const sentences = toSpokenText(text).match(/[^।!?.]+[।!?.]*/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  if (sentences.length === 0) { onDone?.(); return; }
  const utterances = sentences.map((sentence) => {
    const utterance = new SpeechSynthesisUtterance(sentence);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? speechLangs[lang];
    utterance.rate = 1.05;
    return utterance;
  });
  const last = utterances[utterances.length - 1];
  const done = () => {
    if (currentUtterance !== last) return;
    currentUtterance = null;
    // Phone speakers echo a little after the last word; keep the mic closed a moment longer.
    quietUntil = Date.now() + (isMobileDevice() ? 900 : 500);
    onDone?.();
  };
  last.onend = done;
  last.onerror = done;
  currentUtterance = last;
  speakListeners.forEach((listener) => listener());
  utterances.forEach((utterance) => window.speechSynthesis.speak(utterance));
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  // Voices load asynchronously; touching the list early makes them ready by the first reply.
  window.speechSynthesis.getVoices();
}

export function stopSpeaking() {
  currentUtterance = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/** True while the assistant is talking (plus a short tail), so the mic doesn't hear the speaker. */
export function isAssistantSpeaking() {
  return currentUtterance !== null || Date.now() < quietUntil;
}
