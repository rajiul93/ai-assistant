/**
 * Pausing the study timer while the student is away from Prep (owner, 2026-10-23): another tab,
 * another app, or the phone locked — the same rule on every device — and running again on return,
 * with the time away left out.
 *
 * The timer is shared by all the user's devices, so only the browser that started (or last
 * resumed) the running stretch pauses it: locking a phone where Prep was only glanced at must not
 * stop the timer running on the laptop. Both marks live in this browser's localStorage, shared by
 * its Prep tabs, so moving between two Prep tabs pauses and resumes at once.
 */

const OWNER_KEY = "prep:timer-owner";
const AWAY_KEY = "prep:timer-away";

/** Paused because Prep was left: when, and the total at that moment (to tell it from a later pause). */
export type Away = { at: number; accumulatedMs: number };

/** Called by the timer's own start/resume: this browser runs the stretch that began at `startedAt`. */
export function markOwner(startedAt: number | null) {
  try {
    if (startedAt) localStorage.setItem(OWNER_KEY, String(startedAt));
  } catch { /* storage blocked: this browser just won't auto-pause */ }
}

export function ownsStretch(startedAt: number | null) {
  try {
    return Boolean(startedAt) && localStorage.getItem(OWNER_KEY) === String(startedAt);
  } catch {
    return false;
  }
}

export function readAway(): Away | null {
  try {
    const value = JSON.parse(localStorage.getItem(AWAY_KEY) ?? "null") as Away | null;
    return value && typeof value.at === "number" && typeof value.accumulatedMs === "number" ? value : null;
  } catch {
    return null;
  }
}

export function saveAway(away: Away) {
  try { localStorage.setItem(AWAY_KEY, JSON.stringify(away)); } catch { /* not resumed by itself then */ }
}

export function clearAway() {
  try { localStorage.removeItem(AWAY_KEY); } catch { /* nothing to clear */ }
}

/** "৫ মিনিট ১০ সেকেন্ড" style, in English digits (the caller converts). */
export function awayText(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours ? `${hours} ঘণ্টা` : "", minutes ? `${minutes} মিনিট` : "", !hours && rest ? `${rest} সেকেন্ড` : ""].filter(Boolean).join(" ") || "0 সেকেন্ড";
}
