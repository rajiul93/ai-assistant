import { prisma } from "@/lib/prisma";

// Flash-Lite answers in ~1s on the free tier (Flash took 25–40s) and handles the assistant's intents well.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
// Tried when the main model is overloaded (503) or rate-limited (429).
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
// Free-tier responses regularly take 25–30s, so allow for that before giving up.
const TOTAL_BUDGET_MS = 40_000;

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
};

/** Who is using the AI and for what — every call is logged for the AI usage page. */
export type AiFeature = "assistant" | "file_assistant" | "answer" | "answer_search" | "note_writer";
/** Images/PDFs sent alongside the prompt (base64); Gemini reads them natively. */
type InlineFile = { mimeType: string; data: string };
type CallOptions = { search?: boolean; responseSchema?: object; files?: InlineFile[]; userId: string; feature: AiFeature };

// After Google Search grounding hits its quota, skip it for a while instead of wasting a request per question.
let searchBlockedUntil = 0;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function statusName(httpStatus: number | null, timedOut: boolean) {
  if (timedOut) return "timeout";
  if (httpStatus === 200) return "ok";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 503) return "overloaded";
  return "error";
}

/** Usage logging must never break or slow the assistant, so failures are only reported to the console. */
function logUsage(entry: { userId: string; feature: AiFeature; model: string; httpStatus: number | null; timedOut?: boolean; latencyMs: number; usage?: GeminiPayload["usageMetadata"] }) {
  const input = entry.usage?.promptTokenCount ?? 0;
  const output = (entry.usage?.candidatesTokenCount ?? 0) + (entry.usage?.thoughtsTokenCount ?? 0);
  void prisma.aiUsage.create({
    data: {
      userId: entry.userId,
      feature: entry.feature,
      model: entry.model,
      status: statusName(entry.httpStatus, Boolean(entry.timedOut)),
      httpStatus: entry.httpStatus,
      inputTokens: input,
      outputTokens: output,
      totalTokens: entry.usage?.totalTokenCount ?? input + output,
      latencyMs: entry.latencyMs,
    },
  }).catch((error: unknown) => console.warn("[assistant] couldn't log AI usage:", error));
}

async function callModel(model: string, apiKey: string, prompt: string, options: CallOptions, timeoutMs: number) {
  const started = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [...(options.files ?? []).map((file) => ({ inline_data: { mime_type: file.mimeType, data: file.data } })), { text: prompt }] }],
      ...(options.search ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        // Gemini 3 models think by default; this app needs quick replies, not deep reasoning.
        ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
        ...(options.responseSchema ? { responseMimeType: "application/json", responseSchema: options.responseSchema } : {}),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    logUsage({ userId: options.userId, feature: options.feature, model, httpStatus: response.status, latencyMs: Date.now() - started });
    return { status: response.status, text: null };
  }
  const payload = (await response.json()) as GeminiPayload;
  logUsage({ userId: options.userId, feature: options.feature, model, httpStatus: 200, latencyMs: Date.now() - started, usage: payload.usageMetadata });
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  return { status: response.status, text: text || null };
}

/** Returns the model's text, or null when the key is missing or every attempt fails. */
export async function callGemini(prompt: string, options: CallOptions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (options.search && Date.now() < searchBlockedUntil) return null;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const models = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])];

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    const started = Date.now();
    try {
      const result = await callModel(model, apiKey, prompt, options, remaining);
      if (result.text) return result.text;
      console.warn(`[assistant] ${model}${options.search ? " (search)" : ""} failed: HTTP ${result.status}`);
      if (options.search && result.status === 429) { searchBlockedUntil = Date.now() + 30 * 60_000; return null; }
      if (result.status !== 503 && result.status !== 429) return null;
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      logUsage({ userId: options.userId, feature: options.feature, model, httpStatus: null, timedOut, latencyMs: Date.now() - started });
      console.warn(`[assistant] ${model} failed: ${timedOut ? "timed out" : String(error)}`);
      return null;
    }
  }
  return null;
}
