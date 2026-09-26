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
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: parsed.data.text,
      response_format: "mp3",
      ...(TTS_MODEL.startsWith("tts-1") ? {} : { instructions: instructions[parsed.data.lang] }),
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => {
    console.warn("[speech] request failed:", error);
    return null;
  });
  // The speech API reports no token counts; each call is still logged so its cost is visible.
  logUsage({ userId: user.id, feature: "speech", model: TTS_MODEL, httpStatus: response?.status ?? null, timedOut: !response, latencyMs: Date.now() - started });
  if (!response?.ok || !response.body) {
    if (response) console.warn(`[speech] ${TTS_MODEL}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return new Response(null, { status: response?.status ?? 504 });
  }
  return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
