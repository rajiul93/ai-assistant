import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { checkAi } from "@/server/ai-access";
import { logUsage } from "@/server/assistant/ai";
import { audioFromEvents } from "@/server/speech-stream";

const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts-2025-12-15";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "marin";

const requestSchema = z.object({ text: z.string().trim().min(1).max(3000), lang: z.enum(["bn", "en"]).default("bn") });

// Only the gpt-4o TTS models take speaking instructions; tts-1 rejects them.
const instructions = {
  bn: "You are a warm, friendly Bangladeshi study companion. Speak natural, conversational Bangla with a standard Bangladeshi (Dhaka) accent, like a real person talking to a friend — smooth and fluent from start to end, natural intonation, only brief pauses at sentence ends, never robotic or halting. Say English words the way Bangladeshis naturally say them in conversation.",
  en: "You are a warm, friendly study companion. Speak natural, conversational English like a real person talking to a friend — smooth and fluent from start to end, natural intonation, only brief pauses at sentence ends, never robotic or halting.",
};

/**
 * Turns text into natural-sounding speech (MP3), streamed: each piece of audio is sent on as soon as
 * OpenAI produces it, so the browser can start playing about a second in instead of waiting for the
 * whole clip. GET (text in the URL) lets an <audio> element play the stream directly; POST is for
 * fetching a clip ahead of time. The browser's own voice is the fallback when this fails.
 */
async function speech(user: { id: string; email: string }, input: unknown) {
  // Without AI access (or with the token limit used up) the page falls back to the device's own voice.
  if (!(await checkAi(user)).allowed) return new Response(null, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response(null, { status: 503 });
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return new Response(null, { status: 400 });

  const started = Date.now();
  // gpt-4o TTS models stream as events (audio pieces, then the token usage); tts-1 returns raw audio.
  const withEvents = !TTS_MODEL.startsWith("tts-1");
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: parsed.data.text,
      response_format: "mp3",
      ...(withEvents ? { instructions: instructions[parsed.data.lang], stream_format: "sse" } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => {
    console.warn("[speech] request failed:", error);
    return null;
  });
  if (!response?.ok || !response.body) {
    logUsage({ userId: user.id, feature: "speech", model: TTS_MODEL, httpStatus: response?.status ?? null, timedOut: !response, latencyMs: Date.now() - started });
    if (response) console.warn(`[speech] ${TTS_MODEL}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return new Response(null, { status: response?.status || 504 });
  }
  const headers = { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Accel-Buffering": "no" };
  if (!withEvents) {
    logUsage({ userId: user.id, feature: "speech", model: TTS_MODEL, httpStatus: 200, latencyMs: Date.now() - started });
    return new Response(response.body, { headers });
  }
  return new Response(audioFromEvents(response.body, (usage) => {
    logUsage({ userId: user.id, feature: "speech", model: TTS_MODEL, httpStatus: usage ? 200 : null, latencyMs: Date.now() - started, usage });
  }), { headers });
}

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  return speech(user, { text: url.searchParams.get("text") ?? "", lang: url.searchParams.get("lang") ?? "bn" });
}

export async function POST(request: Request) {
  const user = await requireUser();
  return speech(user, await request.json().catch(() => null));
}
