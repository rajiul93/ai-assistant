import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAi } from "@/server/ai-access";
import { logUsage } from "@/server/assistant/ai";

const STT_MODEL = process.env.OPENAI_STT_MODEL || "gpt-4o-transcribe";
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

// Tells the model what it is likely to hear: Bangla mixed with English app words, in a Bangladeshi accent.
const hints = {
  bn: "বাংলাদেশি উচ্চারণে কথ্য বাংলা, মাঝে মাঝে ইংরেজি শব্দ। পড়াশোনার app-এর সহকারীর সঙ্গে কথা: task, subject, topic, timer, revision, note, dashboard, progress, plan, job application, সেভ করো, হ্যাঁ, না।",
  en: "Conversational English, possibly with a Bangladeshi accent, talking to a study app assistant: task, subject, topic, timer, revision, note, dashboard, progress, plan, job application.",
};

// Whether the key may use the model; checked once in a while so the page knows which listener to use.
let availability: { value: boolean; checkedAt: number } | null = null;

export async function GET() {
  const user = await requireUser();
  // Without AI access (or with the token limit used up) the page uses the browser's own recognizer.
  if (!(await checkAi(user)).allowed) return Response.json({ available: false });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ available: false });
  if (!availability || Date.now() - availability.checkedAt > 10 * 60_000) {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5_000) }).catch(() => null);
    const payload = response?.ok ? ((await response.json()) as { data?: Array<{ id: string }> }) : null;
    // Access may be granted to a dated snapshot ("gpt-4o-transcribe-2025-…") rather than the plain name.
    const value = Boolean(payload?.data?.some((model) => model.id === STT_MODEL || model.id.startsWith(`${STT_MODEL}-`)));
    availability = { value, checkedAt: Date.now() };
  }
  return Response.json({ available: availability.value });
}

type TranscriptionPayload = { text?: string; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };

/** Speech → text with OpenAI, which copes with accents and distant voices far better than the browser. */
export async function POST(request: Request) {
  const user = await requireUser();
  // 501 tells the page to switch to the browser's own recognizer.
  if (!(await checkAi(user)).allowed) return Response.json({ error: "unavailable" }, { status: 501 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "not_configured" }, { status: 501 });
  const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "bn";
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) return Response.json({ error: "bad_audio" }, { status: 400 });

  // The user's own subject names are the words most often misheard, so they go into the hint too.
  const subjects = await prisma.subject.findMany({ where: { userId: user.id }, select: { name: true }, take: 30 });
  const prompt = `${hints[lang]}${subjects.length ? ` ${subjects.map((subject) => subject.name).join(", ")}` : ""}`;

  const form = new FormData();
  form.append("file", new Blob([audio], { type: request.headers.get("content-type") || "audio/wav" }), "speech.wav");
  form.append("model", STT_MODEL);
  form.append("language", lang);
  form.append("prompt", prompt);

  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => {
    console.warn("[transcribe] request failed:", error);
    return null;
  });
  if (!response?.ok) {
    logUsage({ userId: user.id, feature: "transcribe", model: STT_MODEL, httpStatus: response?.status ?? null, timedOut: !response, latencyMs: Date.now() - started });
    if (response) console.warn(`[transcribe] ${STT_MODEL}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    // No access to the model: tell the page to go back to the browser's own recognition.
    const unavailable = !response || [401, 403, 404].includes(response.status);
    if (unavailable) availability = null;
    return Response.json({ error: unavailable ? "unavailable" : "failed" }, { status: unavailable ? 501 : 502 });
  }
  const payload = (await response.json()) as TranscriptionPayload;
  const input = payload.usage?.input_tokens ?? 0;
  const output = payload.usage?.output_tokens ?? 0;
  logUsage({ userId: user.id, feature: "transcribe", model: STT_MODEL, httpStatus: 200, latencyMs: Date.now() - started, usage: { input, output, total: payload.usage?.total_tokens ?? input + output } });
  return Response.json({ text: payload.text?.trim() ?? "" });
}
