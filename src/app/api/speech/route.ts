import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { logUsage } from "@/server/assistant/ai";

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts-2025-12-15";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "marin";

const requestSchema = z.object({ text: z.string().trim().min(1).max(3000), lang: z.enum(["bn", "en"]).default("bn") });

// Only the gpt-4o TTS models take speaking instructions; tts-1 rejects them.
const instructions = {
  bn: "You are a warm, friendly Bangladeshi study companion. Speak natural, conversational Bangla with a standard Bangladeshi (Dhaka) accent, like a real person talking to a friend — smooth and fluent from start to end, natural intonation, only brief pauses at sentence ends, never robotic or halting. Say English words the way Bangladeshis naturally say them in conversation.",
  en: "You are a warm, friendly study companion. Speak natural, conversational English like a real person talking to a friend — smooth and fluent from start to end, natural intonation, only brief pauses at sentence ends, never robotic or halting.",
};

/** Turns the assistant's reply into natural-sounding speech (MP3). The browser voice is the fallback. */
export async function POST(request: Request) {
  const user = await requireUser();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response(null, { status: 503 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });

  const started = Date.now();
  // gpt-4o TTS models can stream as events, which end with the token usage; tts-1 only returns raw audio.
  const withUsage = !TTS_MODEL.startsWith("tts-1");
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: parsed.data.text,
      response_format: "mp3",
      ...(withUsage ? { instructions: instructions[parsed.data.lang], stream_format: "sse" } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => {
    console.warn("[speech] request failed:", error);
    return null;
  });
  if (!response?.ok) {
    logUsage({ userId: user.id, feature: "speech", model: TTS_MODEL, httpStatus: response?.status ?? null, timedOut: !response, latencyMs: Date.now() - started });
    if (response) console.warn(`[speech] ${TTS_MODEL}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return new Response(null, { status: response?.status ?? 504 });
  }

  let audio: Buffer;
  let usage: { input: number; output: number; total: number } | undefined;
  try {
    if (withUsage) ({ audio, usage } = await readSpeechEvents(await response.text()));
    else audio = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn("[speech] couldn't read the audio:", error);
    logUsage({ userId: user.id, feature: "speech", model: TTS_MODEL, httpStatus: null, latencyMs: Date.now() - started });
    return new Response(null, { status: 502 });
  }
  logUsage({ userId: user.id, feature: "speech", model: TTS_MODEL, httpStatus: 200, latencyMs: Date.now() - started, usage });
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}

type SpeechEvent = { type?: string; audio?: string; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };

/** Joins the streamed MP3 chunks and picks up the token usage sent with the final event. */
function readSpeechEvents(body: string) {
  const chunks: Buffer[] = [];
  let usage: { input: number; output: number; total: number } | undefined;
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    const event = JSON.parse(data) as SpeechEvent;
    if (event.type === "speech.audio.delta" && event.audio) chunks.push(Buffer.from(event.audio, "base64"));
    if (event.type === "speech.audio.done" && event.usage) {
      const input = event.usage.input_tokens ?? 0;
      const output = event.usage.output_tokens ?? 0;
      usage = { input, output, total: event.usage.total_tokens ?? input + output };
    }
  }
  if (chunks.length === 0) throw new Error("no audio in the response");
  return { audio: Buffer.concat(chunks), usage };
}
