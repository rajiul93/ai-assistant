import type { TypingLanguage, TypingMethod } from "./layouts";

export type TypingResult = {
  at: string;
  kind: "test" | "practice";
  language: TypingLanguage;
  method: TypingMethod | null;
  wpm: number;
  accuracy: number;
  seconds: number;
};

const storageKey = "prep:typing-results";

export function loadResults(): TypingResult[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveResult(result: Omit<TypingResult, "at">) {
  try {
    const next = [{ ...result, at: new Date().toISOString() }, ...loadResults()].slice(0, 200);
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode) — progress just isn't kept
  }
}

export function clearResults() {
  try {
    localStorage.removeItem(storageKey);
  } catch {}
}

// Standard typing metrics: a "word" is 5 characters.
export function scoreTyping(target: string, typed: string, seconds: number) {
  const correct = [...typed].filter((char, index) => char === target[index]).length;
  const minutes = Math.max(seconds, 1) / 60;
  return {
    wpm: Math.round(correct / 5 / minutes),
    accuracy: typed.length ? Math.round((correct / typed.length) * 100) : 100,
  };
}
