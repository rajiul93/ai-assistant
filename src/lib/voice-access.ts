import { useSyncExternalStore } from "react";

/**
 * Voice (mic, speech-to-text, read-aloud, voice chat) is for admins and the super admin only
 * (owner, 2026-10-13) — including the browser's own recognizer and voice, so nobody else gets any
 * voice feature, paid or free. The app shell switches it on for admins; until then (and always on
 * the server, where this module is shared by every request) it is off. The server routes check the
 * role again, so this switch only decides what the page shows and tries.
 */

let allowed = false;
const listeners = new Set<() => void>();

export function setVoiceAllowed(value: boolean) {
  if (allowed === value) return;
  allowed = value;
  listeners.forEach((listener) => listener());
}

export const isVoiceAllowed = () => allowed;

/** For useSyncExternalStore: re-render mics and speakers when the switch changes. */
export function subscribeVoiceAllowed(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Whether this page may show voice controls (admins only). */
export function useVoiceAllowed() {
  return useSyncExternalStore(subscribeVoiceAllowed, isVoiceAllowed, () => false);
}
