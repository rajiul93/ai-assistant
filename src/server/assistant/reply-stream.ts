/**
 * Pulls the "reply" text out of the assistant's JSON while the model is still writing it, so the
 * answer can be shown and spoken sentence by sentence instead of after the whole JSON is done.
 * Only replies that are the final answer (action "answer" or "clarify") are passed on; for other
 * actions the server replaces the reply with its own text, so nothing is streamed.
 */
export function createReplyStreamer(onText: (text: string) => void, streamActions: readonly string[] = ["answer", "clarify"]) {
  let raw = "";
  let action: string | null = null;
  let start = -1; // index in `raw` where the reply string's characters begin
  let at = -1; // next index in `raw` to decode
  let done = false;
  let held = ""; // reply text decoded before the action was known

  const emit = (text: string) => {
    if (!text) return;
    if (action === null) { held += text; return; }
    if (streamActions.includes(action)) onText(text);
  };

  return {
    feed(piece: string) {
      if (done) return;
      raw += piece;
      if (action === null) {
        const match = /"action"\s*:\s*"([a-z_]+)"/.exec(raw);
        if (match) {
          action = match[1];
          if (held) { const text = held; held = ""; emit(text); }
        }
      }
      if (start < 0) {
        const match = /"reply"\s*:\s*"/.exec(raw);
        if (!match) return;
        start = at = match.index + match[0].length;
      }
      let text = "";
      while (at < raw.length) {
        const char = raw[at];
        if (char === '"') { done = true; break; }
        if (char !== "\\") { text += char; at++; continue; }
        // An escape: wait until all of it has arrived.
        const next = raw[at + 1];
        if (next === undefined) break;
        if (next === "u") {
          const hex = raw.slice(at + 2, at + 6);
          if (hex.length < 4) break;
          text += String.fromCharCode(Number.parseInt(hex, 16));
          at += 6;
          continue;
        }
        text += ({ n: "\n", t: "\t", r: "", b: "", f: "", "/": "/", "\\": "\\", '"': '"' } as Record<string, string>)[next] ?? next;
        at += 2;
      }
      emit(text);
    },
  };
}
