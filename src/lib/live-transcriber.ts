/**
 * Live typing with OpenAI's live transcription: audio streams to OpenAI while the user talks and
 * words come back as they are said (about half a second behind). The page still decides where a
 * sentence ends (use-voice-capture's own pause detection) and commits it; the finished sentence
 * then arrives as one final transcript.
 *
 * The browser never sees the real API key: /api/transcribe/live hands out a short-lived key for
 * one transcription session. If anything goes wrong the caller falls back to sentence-by-sentence
 * transcription, so no sentence is lost.
 */

const RATE = 24_000;
/** A committed sentence that hasn't come back by then is transcribed the other way instead. */
const FINAL_TIMEOUT_MS = 8_000;
const CONNECT_TIMEOUT_MS = 6_000;

type Pending = { itemId: string | null; resolve: (text: string | null) => void; timer: ReturnType<typeof setTimeout> };

type RealtimeEvent = {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  usage?: { type?: string; seconds?: number };
};

function toBase64(samples: Int16Array) {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export class LiveTranscriber {
  private ws: WebSocket | null = null;
  private opening: Promise<boolean> | null = null;
  /** Audio captured while the connection was still opening. */
  private backlog: string[] = [];
  private texts = new Map<string, string>();
  private committed = new Set<string>();
  /** The sentence being spoken now: its item id is learned from the first word that comes back. */
  private activeItem: string | null = null;
  private speaking = false;
  private pending: Pending[] = [];
  /** Resampler state: position within the input, carried from one chunk to the next. */
  private position = 0;
  private closed = false;
  /** Set when the model or network refused; the page then stops trying for this visit. */
  unavailable = false;

  constructor(private readonly options: { lang: () => string; onWords: (text: string) => void }) {}

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Opens (or reopens) the session; resolves false when live typing can't be used now. */
  connect(): Promise<boolean> {
    if (this.closed || this.unavailable) return Promise.resolve(false);
    if (this.open) return Promise.resolve(true);
    this.opening ??= (async () => {
      try {
        const response = await fetch(`/api/transcribe/live?lang=${this.options.lang()}`, { method: "POST", signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS) });
        if (response.status === 501) this.unavailable = true;
        if (!response.ok) return false;
        const { key } = (await response.json()) as { key?: string };
        if (!key || this.closed) return false;
        return await new Promise<boolean>((resolve) => {
          // Browsers can't set headers on a WebSocket, so the short-lived key goes in the subprotocol.
          const ws = new WebSocket("wss://api.openai.com/v1/realtime", ["realtime", `openai-insecure-api-key.${key}`]);
          const timer = setTimeout(() => { ws.close(); resolve(false); }, CONNECT_TIMEOUT_MS);
          ws.onopen = () => {
            clearTimeout(timer);
            this.ws = ws;
            for (const chunk of this.backlog) ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: chunk }));
            this.backlog = [];
            resolve(true);
          };
          ws.onmessage = (message) => this.handle(JSON.parse(String(message.data)) as RealtimeEvent);
          ws.onerror = () => { clearTimeout(timer); resolve(false); };
          ws.onclose = () => {
            clearTimeout(timer);
            if (this.ws === ws) this.ws = null;
            // Sentences still waiting are handed back so they can be transcribed the other way.
            for (const entry of this.pending.splice(0)) { clearTimeout(entry.timer); entry.resolve(null); }
            resolve(false);
          };
        });
      } catch {
        return false;
      } finally {
        this.opening = null;
      }
    })();
    return this.opening;
  }

  private handle(event: RealtimeEvent) {
    if (event.type === "conversation.item.input_audio_transcription.delta" && event.item_id) {
      const text = (this.texts.get(event.item_id) ?? "") + (event.delta ?? "");
      this.texts.set(event.item_id, text);
      if (this.speaking && !this.activeItem && !this.committed.has(event.item_id)) this.activeItem = event.item_id;
      if (event.item_id === this.activeItem && this.speaking) this.options.onWords(text.trim());
      return;
    }
    if (event.type === "input_audio_buffer.committed" && event.item_id) {
      this.committed.add(event.item_id);
      const waiting = this.pending.find((entry) => entry.itemId === null);
      if (waiting) waiting.itemId = event.item_id;
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.item_id) {
      const index = this.pending.findIndex((entry) => entry.itemId === event.item_id);
      this.texts.delete(event.item_id);
      if (event.usage?.type === "duration" && event.usage.seconds) {
        // Voice counts against the plan like everything else.
        void fetch("/api/transcribe/live", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seconds: event.usage.seconds }) }).catch(() => {});
      }
      if (index < 0) return;
      const [entry] = this.pending.splice(index, 1);
      clearTimeout(entry.timer);
      entry.resolve((event.transcript ?? "").trim());
      return;
    }
    if (event.type === "error") console.warn("[live-transcribe]", event);
  }

  private send(chunk: string) {
    if (this.open) this.ws!.send(JSON.stringify({ type: "input_audio_buffer.append", audio: chunk }));
    // While connecting, keep up to ~20 s of audio for when it opens.
    else if (this.opening && this.backlog.length < 250) this.backlog.push(chunk);
  }

  /** A new sentence starts: its words will be reported through onWords. */
  begin() {
    this.speaking = true;
    this.activeItem = null;
    if (!this.open) void this.connect();
  }

  /** Float samples at `rate` → 24 kHz 16-bit PCM, streamed. */
  append(samples: Float32Array, rate: number) {
    if (this.closed || (!this.open && !this.opening)) return;
    const step = rate / RATE;
    const out = new Int16Array(Math.max(0, Math.ceil((samples.length - this.position) / step)));
    let count = 0;
    let at = this.position;
    while (at < samples.length) {
      const index = Math.floor(at);
      const fraction = at - index;
      const before = samples[index];
      const after = index + 1 < samples.length ? samples[index + 1] : samples[index];
      const value = Math.max(-1, Math.min(1, before + (after - before) * fraction));
      out[count++] = value < 0 ? value * 0x8000 : value * 0x7fff;
      at += step;
    }
    this.position = at - samples.length;
    if (count) this.send(toBase64(out.subarray(0, count)));
  }

  /** The sentence ended: resolves with its final text, or null (caller transcribes it another way). */
  commit(): Promise<string | null> {
    this.speaking = false;
    this.activeItem = null;
    if (!this.open) { this.backlog = []; return Promise.resolve(null); }
    return new Promise((resolve) => {
      const entry: Pending = { itemId: null, resolve, timer: setTimeout(() => { this.pending = this.pending.filter((item) => item !== entry); resolve(null); }, FINAL_TIMEOUT_MS) };
      this.pending.push(entry);
      this.ws!.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    });
  }

  /** A noise, not a sentence: drop what was sent. */
  discard() {
    this.speaking = false;
    this.activeItem = null;
    this.backlog = [];
    if (this.open) this.ws!.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
  }

  close() {
    this.closed = true;
    this.backlog = [];
    for (const entry of this.pending.splice(0)) { clearTimeout(entry.timer); entry.resolve(null); }
    this.ws?.close();
    this.ws = null;
  }
}
