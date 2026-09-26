import { prisma } from "@/lib/prisma";

/**
 * One entry point for every AI call in the app, backed by OpenAI.
 * If the main model is busy, fails or times out, the fallback model answers. Every attempt is logged
 * for the AI Usage page.
 */

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
// Optional; tried when the main model is overloaded, rate-limited or times out.
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL;
const TOTAL_BUDGET_MS = 40_000;
const PER_ATTEMPT_WITH_BACKUP_MS = 25_000;

/** Who is using the AI and for what — every call is logged for the AI usage page. */
export type AiFeature = "assistant" | "file_assistant" | "answer" | "answer_search" | "note_writer" | "speech" | "transcribe" | "image";
/** Images/PDFs sent alongside the prompt (base64). */
type InlineFile = { mimeType: string; data: string; name?: string };
/** `responseSchema` is written in an OpenAPI style (type: "OBJECT", nullable: true) and converted to JSON Schema. */
type CallOptions = { search?: boolean; responseSchema?: object; files?: InlineFile[]; userId: string; feature: AiFeature };
type Usage = { input: number; output: number; total: number };
type Attempt = { status: number | null; text: string | null; usage?: Usage };

// After web search hits its quota, skip it for a while instead of wasting a request per question.
let searchBlockedUntil = 0;

export function isAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function statusName(httpStatus: number | null, timedOut: boolean) {
  if (timedOut) return "timeout";
  if (httpStatus === 200) return "ok";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 503 || httpStatus === 529) return "overloaded";
  return "error";
}

/** Usage logging must never break or slow the assistant, so failures are only reported to the console. */
export function logUsage(entry: { userId: string; feature: AiFeature; model: string; httpStatus: number | null; timedOut?: boolean; latencyMs: number; usage?: Usage }) {
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

/** OpenAPI-style schema (type: "OBJECT", nullable: true) → standard JSON Schema. */
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

/**
 * The assistant needs quick replies, not deep reasoning. GPT-6 models accept "none"; GPT-5 models
 * go no lower than "minimal", and their web search needs at least "low".
 */
function reasoningEffort(model: string, search: boolean) {
  if (model.startsWith("gpt-6")) return "none";
  if (model.startsWith("gpt-5")) return search ? "low" : "minimal";
  return null;
}

const dataUrl = (file: InlineFile) => `data:${file.mimeType};base64,${file.data}`;

/** Plain and structured calls: Chat Completions. */
async function chatCompletion(model: string, apiKey: string, prompt: string, options: CallOptions, timeoutMs: number): Promise<Attempt> {
  const fileParts = (options.files ?? []).map((file) => (file.mimeType === "application/pdf"
    ? { type: "file", file: { filename: file.name ?? "document.pdf", file_data: dataUrl(file) } }
    : { type: "image_url", image_url: { url: dataUrl(file) } }));
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: fileParts.length ? [...fileParts, { type: "text", text: prompt }] : prompt }],
      ...(reasoningEffort(model, false) ? { reasoning_effort: reasoningEffort(model, false) } : {}),
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
}

type ResponsesPayload = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

/** Answers that may need current facts: the Responses API with its web_search tool. */
async function webSearchResponse(model: string, apiKey: string, prompt: string, options: CallOptions, timeoutMs: number): Promise<Attempt> {
  const fileParts = (options.files ?? []).map((file) => (file.mimeType === "application/pdf"
    ? { type: "input_file", filename: file.name ?? "document.pdf", file_data: dataUrl(file) }
    : { type: "input_image", image_url: dataUrl(file) }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: [...fileParts, { type: "input_text", text: prompt }] }],
      tools: [{ type: "web_search" }],
      ...(reasoningEffort(model, true) ? { reasoning: { effort: reasoningEffort(model, true) } } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    console.warn(`[ai] openai ${model} (search): HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return { status: response.status, text: null };
  }
  const payload = (await response.json()) as ResponsesPayload;
  const text = payload.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  const input = payload.usage?.input_tokens ?? 0;
  const output = payload.usage?.output_tokens ?? 0;
  return { status: 200, text: text || null, usage: { input, output, total: payload.usage?.total_tokens ?? input + output } };
}

/** Returns the model's text, or null when no API key is configured or every attempt fails. */
export async function callAI(prompt: string, options: CallOptions) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (options.search && Date.now() < searchBlockedUntil) return null;
  const models = [...new Set([OPENAI_MODEL, OPENAI_FALLBACK_MODEL].filter((model): model is string => Boolean(model)))];
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    const timeout = index < models.length - 1 ? Math.min(remaining, PER_ATTEMPT_WITH_BACKUP_MS) : remaining;
    const started = Date.now();
    let attempt: Attempt;
    try {
      attempt = await (options.search ? webSearchResponse : chatCompletion)(model, apiKey, prompt, options, timeout);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      logUsage({ userId: options.userId, feature: options.feature, model, httpStatus: null, timedOut, latencyMs: Date.now() - started });
      console.warn(`[ai] ${model} failed: ${timedOut ? "timed out" : String(error)}`);
      continue;
    }
    logUsage({ userId: options.userId, feature: options.feature, model, httpStatus: attempt.status, latencyMs: Date.now() - started, usage: attempt.usage });
    if (attempt.text) return attempt.text;
    console.warn(`[ai] ${model}${options.search ? " (search)" : ""} failed: HTTP ${attempt.status}`);
    if (options.search && attempt.status === 429) { searchBlockedUntil = Date.now() + 30 * 60_000; return null; }
    // The fallback model only helps when the first was busy or rate-limited.
    if (attempt.status !== 503 && attempt.status !== 429) break;
  }
  return null;
}

// ---------- Images ----------

// Best first; the first one the key may use is picked (OPENAI_IMAGE_MODEL overrides).
const IMAGE_MODELS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"];
let imageModelCache: { model: string | null; checkedAt: number } | null = null;

async function pickImageModel(apiKey: string) {
  if (process.env.OPENAI_IMAGE_MODEL) return process.env.OPENAI_IMAGE_MODEL;
  if (imageModelCache && Date.now() - imageModelCache.checkedAt < 10 * 60_000) return imageModelCache.model;
  const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(5_000) }).catch(() => null);
  const ids = response?.ok ? ((await response.json()) as { data?: Array<{ id: string }> }).data?.map((item) => item.id) ?? [] : [];
  // Access may be to a dated snapshot ("gpt-image-1-2025-…"), so match by prefix too.
  const model = IMAGE_MODELS.find((name) => ids.some((id) => id === name || id.startsWith(`${name}-20`))) ?? null;
  imageModelCache = { model, checkedAt: Date.now() };
  return model;
}

type ImagePayload = { data?: Array<{ b64_json?: string }>; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };

/**
 * Draws an image from a prompt. Returns a data URL, "unavailable" when no image model is enabled
 * for the key, or null when the call failed.
 */
export async function generateImage(prompt: string, { userId }: { userId: string }): Promise<string | "unavailable" | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "unavailable";
  const model = await pickImageModel(apiKey);
  if (!model) return "unavailable";
  const started = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      // Medium quality WebP keeps it quick and small enough to send straight to the chat.
      body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024", quality: "medium", output_format: "webp", output_compression: 85 }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!response.ok) {
      logUsage({ userId, feature: "image", model, httpStatus: response.status, latencyMs: Date.now() - started });
      console.warn(`[ai] image ${model}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
      if ([401, 403, 404].includes(response.status)) { imageModelCache = null; return "unavailable"; }
      return null;
    }
    const payload = (await response.json()) as ImagePayload;
    const input = payload.usage?.input_tokens ?? 0;
    const output = payload.usage?.output_tokens ?? 0;
    logUsage({ userId, feature: "image", model, httpStatus: 200, latencyMs: Date.now() - started, usage: { input, output, total: payload.usage?.total_tokens ?? input + output } });
    const data = payload.data?.[0]?.b64_json;
    return data ? `data:image/webp;base64,${data}` : null;
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    logUsage({ userId, feature: "image", model, httpStatus: null, timedOut, latencyMs: Date.now() - started });
    console.warn(`[ai] image ${model} failed: ${timedOut ? "timed out" : String(error)}`);
    return null;
  }
}
