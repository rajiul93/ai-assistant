import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAi } from "@/server/ai-access";
import { logUsage } from "@/server/assistant/ai";
import { speechHints } from "@/server/speech-hints";

const LIVE_MODEL = process.env.OPENAI_LIVE_STT_MODEL || "gpt-live-transcribe";
/**
 * OpenAI bills live transcription by audio length and reports only seconds; they are recorded as
 * tokens at this rate so voice counts against the plan like everything else (an estimate).
 */
const TOKENS_PER_SECOND = 10;

/**
 * Live typing (words appear while the user is still talking): hands the browser a short-lived
 * key for one OpenAI live-transcription session, so audio goes straight to OpenAI without the
 * real API key ever leaving the server. The key only opens that transcription session.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await checkAi(user)).allowed) return Response.json({ error: "unavailable" }, { status: 501 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "not_configured" }, { status: 501 });
  const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "bn";
  // The user's own subject names are the words most often misheard.
  const subjects = await prisma.subject.findMany({ where: { userId: user.id }, select: { name: true }, take: 30 });
  const keywords = subjects.map((subject) => subject.name.replace(/[<>\r\n]/g, " ").trim()).filter(Boolean);

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // The key must be used to connect within a minute; the session itself then stays open.
      expires_after: { anchor: "created_at", seconds: 60 },
      session: {
        type: "transcription",
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24_000 },
            transcription: { model: LIVE_MODEL, languages: lang === "bn" ? ["bn", "en"] : ["en"], delay: "low", prompt: speechHints[lang], ...(keywords.length ? { keywords } : {}) },
            // The page finds the end of each sentence itself and commits it.
            turn_detection: null,
            noise_reduction: { type: "near_field" },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) {
    if (response) console.warn(`[live-transcribe] HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    // No access to the model: the page keeps using sentence-by-sentence transcription.
    return Response.json({ error: "unavailable" }, { status: response && [401, 403, 404].includes(response.status) ? 501 : 502 });
  }
  const payload = (await response.json()) as { value?: string; expires_at?: number };
  if (!payload.value) return Response.json({ error: "unavailable" }, { status: 502 });
  return Response.json({ key: payload.value });
}

/** The page reports how many seconds each finished sentence took, for the usage page and the plan. */
export async function PUT(request: Request) {
  const user = await requireUser();
  const parsed = z.object({ seconds: z.number().min(0).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const tokens = Math.ceil(parsed.data.seconds * TOKENS_PER_SECOND);
  logUsage({ userId: user.id, feature: "transcribe", model: LIVE_MODEL, httpStatus: 200, latencyMs: 0, usage: { input: tokens, output: 0, total: tokens } });
  return Response.json({ ok: true });
}
