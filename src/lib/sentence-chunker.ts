/** The first piece is spoken as soon as it forms, so speech starts fast. */
const FIRST_MIN_CHARS = 8;
/** The first piece may also end at a comma/phrase break once it is this long: a short first clip is voiced faster. */
const FIRST_PHRASE_CHARS = 20;
/** Later pieces gather short sentences together, which sounds more natural than many tiny clips. */
const NEXT_MIN_CHARS = 40;
/** With no sentence end in sight, cut at a phrase break (comma, dash…) once the text gets this long. */
const PHRASE_MAX_CHARS = 180;

/**
 * Splits text that arrives in pieces (a streamed answer) into speakable chunks at natural sentence
 * or phrase boundaries — never mid-word, never word by word. Markdown code blocks are skipped:
 * code is for reading, not for listening.
 */
export function createSentenceChunker(onChunk: (text: string) => void) {
  let buffer = "";
  let inCode = false;
  let emitted = 0;

  /** Index just after the last usable boundary in `text`, or -1. */
  function boundary(text: string, final: boolean) {
    const min = emitted ? NEXT_MIN_CHARS : FIRST_MIN_CHARS;
    let cut = -1;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      const next = text[index + 1];
      const sentenceEnd = char === "।" || char === "?" || char === "!" || char === "\n"
        // A full stop ends a sentence only before a space/end, and not inside a number (3.5).
        || (char === "." && (next === undefined ? final : /\s/.test(next)) && !/\d/.test(text[index - 1] ?? ""));
      if (sentenceEnd && index + 1 >= min) { cut = index + 1; if (emitted) continue; break; }
      // First piece only: stop at the first phrase break, so the first sound comes sooner.
      if (!emitted && (char === "," || char === ";" || char === "—") && next !== undefined && /\s/.test(next) && index + 1 >= FIRST_PHRASE_CHARS) { cut = index + 1; break; }
    }
    if (cut > 0) return cut;
    if (text.length >= PHRASE_MAX_CHARS) {
      const phrase = Math.max(text.lastIndexOf(", ", PHRASE_MAX_CHARS), text.lastIndexOf("; ", PHRASE_MAX_CHARS), text.lastIndexOf(" — ", PHRASE_MAX_CHARS), text.lastIndexOf(": ", PHRASE_MAX_CHARS));
      if (phrase > min) return phrase + 1;
      const space = text.lastIndexOf(" ", PHRASE_MAX_CHARS);
      if (space > min) return space;
    }
    return -1;
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    emitted++;
    onChunk(clean);
  }

  function drain(final: boolean) {
    for (;;) {
      // Drop fenced code: everything between ``` markers (an unfinished block waits for its end).
      const fence = buffer.indexOf("```");
      if (inCode) {
        if (fence < 0) { if (final) buffer = ""; return; }
        buffer = buffer.slice(fence + 3);
        const lineEnd = buffer.indexOf("\n");
        buffer = lineEnd >= 0 ? buffer.slice(lineEnd + 1) : "";
        inCode = false;
        continue;
      }
      const text = fence >= 0 ? buffer.slice(0, fence) : buffer;
      const cut = boundary(text, final || fence >= 0);
      if (cut > 0) { send(text.slice(0, cut)); buffer = buffer.slice(cut); continue; }
      if (fence >= 0) {
        // Speak what came before the code, then skip the code.
        send(text);
        buffer = buffer.slice(fence + 3);
        inCode = true;
        continue;
      }
      if (final) { send(buffer); buffer = ""; }
      return;
    }
  }

  return {
    push(piece: string) { buffer += piece; drain(false); },
    end() { drain(true); },
  };
}
