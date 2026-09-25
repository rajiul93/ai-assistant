import { prisma } from "@/lib/prisma";

/**
 * One entry point for every AI call in the app, backed by Gemini and/or OpenAI.
 * Providers are tried in order (AI_PROVIDER picks the first); if one is busy, fails or times out,
 * the next one answers. Every attempt is logged for the AI Usage page.
 */

// Flash-Lite answers in ~1s on the free tier (Flash took 25–40s) and handles the assistant's intents well.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
// Tried when the main Gemini model is overloaded (503) or rate-limited (429).
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
// Free-tier responses can take 25–30s; with a second provider available, give each attempt less.
const TOTAL_BUDGET_MS = 40_000;
const PER_ATTEMPT_WITH_BACKUP_MS = 20_000;

/** Who is using the AI and for what — every call is logged for the AI usage page. */
export type AiFeature = "assistant" | "file_assistant" | "answer" | "answer_search" | "note_writer";
/** Images/PDFs sent alongside the prompt (base64). */
type InlineFile = { mimeType: string; data: string; name?: string };
/** `responseSchema` uses Gemini's OpenAPI-style schema; it is converted for OpenAI. */
type CallOptions = { search?: boolean; responseSchema?: object; files?: InlineFile[]; userId: string; feature: AiFeature };
type Usage = { input: number; output: number; total: number };
type Attempt = { status: number | null; text: string | null; usage?: Usage };
type Provider = { name: "gemini" | "openai"; model: string; call: (prompt: string, options: CallOptions, timeoutMs: number) => Promise<Attempt> };

// After Google Search grounding hits its quota, skip it for a while instead of wasting a request per question.
let searchBlockedUntil = 0;

export function isAIConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

function statusName(httpStatus: number | null, timedOut: boolean) {
  if (timedOut) return "timeout";
  if (httpStatus === 200) return "ok";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 503 || httpStatus === 529) return "overloaded";
  return "error";
}

/** Usage logging must never break or slow the assistant, so failures are only reported to the console. */
function logUsage(entry: { userId: string; feature: AiFeature; model: string; httpStatus: number | null; timedOut?: boolean; latencyMs: number; usage?: Usage }) {
  void prisma.aiUsage.create({
    data: {
      userId: entry.userId,
      feature: entry.feature,
      model: entry.model,
      status: statusName(entry.httpStatus, Boolean(entry.timedOut)),
      httpStatus: entry.httpStatus,
      inputTokens: entry.usage?.input ?? 0,
      outputTokens: entry.usage?.output ?? 0,
      totalTokens: entry.usage?.total ?? 0,
      latencyMs: entry.latencyMs,
    },
  }).catch((error: unknown) => console.warn("[ai] couldn't log AI usage:", error));
}

// ---------- Gemini ----------

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
};

function geminiProvider(model: string, apiKey: string): Provider {
  return {
    name: "gemini",
    model,
    call: async (prompt, options, timeoutMs) => {
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
      if (!response.ok) return { status: response.status, text: null };
      const payload = (await response.json()) as GeminiPayload;
      const meta = payload.usageMetadata;
      const input = meta?.promptTokenCount ?? 0;
      const output = (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      return { status: 200, text: text || null, usage: { input, output, total: meta?.totalTokenCount ?? input + output } };
    },
  };
}

// ---------- OpenAI ----------

/** Gemini's OpenAPI-style schema (type: "OBJECT", nullable: true) → standard JSON Schema for OpenAI. */
function toJsonSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return schema;
  const source = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "nullable") continue;
    if (key === "type" && typeof value === "string") result.type = value.toLowerCase();
    else if (key === "properties" && value && typeof value === "object") result.properties = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, toJsonSchema(child)]));
    else if (key === "items") result.items = toJsonSchema(value);
    else if (key === "enum" && Array.isArray(value)) result.enum = [...value];
    else result[key] = value;
  }
  if (source.nullable) {
    result.type = [result.type, "null"];
    if (Array.isArray(result.enum)) result.enum = [...(result.enum as unknown[]), null];
  }
  return result;
}

type OpenAIPayload = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function openaiProvider(model: string, apiKey: string): Provider {
  return {
    name: "openai",
    model,
    call: async (prompt, options, timeoutMs) => {
      const fileParts = (options.files ?? []).map((file) => (file.mimeType === "application/pdf"
        ? { type: "file", file: { filename: file.name ?? "document.pdf", file_data: `data:application/pdf;base64,${file.data}` } }
        : { type: "image_url", image_url: { url: `data:${file.mimeType};base64,${file.data}` } }));
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: fileParts.length ? [...fileParts, { type: "text", text: prompt }] : prompt }],
          // GPT-5 models reason by default; the assistant needs quick replies.
          ...(model.startsWith("gpt-5") ? { reasoning_effort: "minimal" } : {}),
          ...(options.responseSchema
            ? { response_format: { type: "json_schema", json_schema: { name: "assistant_reply", strict: false, schema: toJsonSchema(options.responseSchema) } } }
            : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        console.warn(`[ai] openai ${model}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
        return { status: response.status, text: null };
      }
      const payload = (await response.json()) as OpenAIPayload;
      const text = payload.choices?.[0]?.message?.content?.trim();
      const input = payload.usage?.prompt_tokens ?? 0;
      const output = payload.usage?.completion_tokens ?? 0;
      return { status: 200, text: text || null, usage: { input, output, total: payload.usage?.total_tokens ?? input + output } };
    },
  };
}

// ---------- Routing ----------

/** Providers that can handle this call, in the order to try them. */
function providersFor(options: CallOptions): Provider[] {
  const gemini: Provider[] = process.env.GEMINI_API_KEY
    ? [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])].map((model) => geminiProvider(model, process.env.GEMINI_API_KEY!))
    : [];
  // OpenAI can't do Google Search grounding or read HEIC photos, so it sits those calls out.
  const openaiCan = !options.search && !(options.files ?? []).some((file) => /heic|heif/.test(file.mimeType));
  const openai: Provider[] = process.env.OPENAI_API_KEY && openaiCan ? [openaiProvider(OPENAI_MODEL, process.env.OPENAI_API_KEY)] : [];
  return process.env.AI_PROVIDER === "openai" ? [...openai, ...gemini] : [...gemini, ...openai];
}

/** Returns the model's text, or null when no provider is configured or every attempt fails. */
export async function callAI(prompt: string, options: CallOptions) {
  if (options.search && Date.now() < searchBlockedUntil) return null;
  const providers = providersFor(options);
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (let index = 0; index < providers.length; index++) {
    const provider = providers[index];
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    const hasBackup = providers.slice(index + 1).some((next) => next.name !== provider.name);
    const timeout = hasBackup ? Math.min(remaining, PER_ATTEMPT_WITH_BACKUP_MS) : remaining;
    const started = Date.now();
    let attempt: Attempt;
    try {
      attempt = await provider.call(prompt, options, timeout);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      logUsage({ userId: options.userId, feature: options.feature, model: provider.model, httpStatus: null, timedOut, latencyMs: Date.now() - started });
      console.warn(`[ai] ${provider.model} failed: ${timedOut ? "timed out" : String(error)}`);
      continue;
    }
    logUsage({ userId: options.userId, feature: options.feature, model: provider.model, httpStatus: attempt.status, latencyMs: Date.now() - started, usage: attempt.usage });
    if (attempt.text) return attempt.text;
    console.warn(`[ai] ${provider.model}${options.search ? " (search)" : ""} failed: HTTP ${attempt.status}`);
    if (options.search && attempt.status === 429) { searchBlockedUntil = Date.now() + 30 * 60_000; return null; }
    // A second model from the same provider only helps when the first was busy or rate-limited.
    const next = providers[index + 1];
    if (next?.name === provider.name && attempt.status !== 503 && attempt.status !== 429) {
      index = providers.findIndex((candidate, position) => position > index && candidate.name !== provider.name) - 1;
      if (index < -1) break;
    }
  }
  return null;
}
