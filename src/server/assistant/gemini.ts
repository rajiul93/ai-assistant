import type { Attempt, CallOptions, Usage } from "@/server/assistant/ai";

/**
 * Google Gemini behind `callAI` (owner, 2026-10-18: a second AI beside OpenAI): text, JSON answers
 * (`responseSchema` is already in Gemini's own OpenAPI style), photos and PDFs, Google Search, and
 * streaming. Returns the same Attempt shape as the OpenAI calls.
 */

// Google closed 2.5 Flash to new keys and points them to 3.8 Flash (seen 2026-10-18).
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

type Part = { text?: string; thought?: boolean };
type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Part[] } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
  error?: { message?: string };
};

const BUDGET = { low: 1024, medium: 4096, high: 12288 } as const;

/**
 * Thinking: 2.5 Flash models think only when asked (fast by default, like OpenAI's "none"); Gemini 3
 * models take a level, and only when a caller asks for reasoning (otherwise the model's own default,
 * so a setting it doesn't know can't fail the call); other models a budget when asked.
 */
function thinking(model: string, wanted: CallOptions["reasoning"]) {
  if (model.includes("2.5-flash")) return { thinkingBudget: wanted ? BUDGET[wanted] : 0 };
  if (model.startsWith("gemini-3")) return wanted ? { thinkingLevel: wanted === "low" ? "low" : "high" } : undefined;
  return wanted ? { thinkingBudget: BUDGET[wanted] } : undefined;
}

const textOf = (payload: GeminiPayload) => (payload.candidates?.[0]?.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? "").join("");

function usageOf(payload: GeminiPayload): Usage | undefined {
  const meta = payload.usageMetadata;
  if (!meta) return undefined;
  const input = meta.promptTokenCount ?? 0;
  const output = (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
  return { input, output, total: meta.totalTokenCount ?? input + output };
}

/** A JSON answer sometimes comes wrapped in a ``` fence (always, with search, where the schema can't be enforced). */
const unfence = (text: string) => text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

export async function geminiCall(model: string, apiKey: string, prompt: string, options: CallOptions, signal: AbortSignal): Promise<Attempt> {
  // Google Search and an enforced JSON schema don't go together: with search the shape is asked for in words.
  const enforceSchema = Boolean(options.responseSchema) && !options.search;
  const askedJson = options.responseSchema && options.search ? `\n\nউত্তর শুধু JSON-এ দেবে (কোনো লেখা বা \`\`\` নয়), এই গঠনে: ${JSON.stringify(options.responseSchema)}` : "";
  const parts = [
    ...(options.files ?? []).map((file) => ({ inline_data: { mime_type: file.mimeType, data: file.data } })),
    { text: prompt + askedJson },
  ];
  const thinkingConfig = thinking(model, options.reasoning);
  const body = {
    contents: [{ role: "user", parts }],
    ...(options.search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      ...(enforceSchema ? { responseMimeType: "application/json", responseSchema: options.responseSchema } : {}),
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  };
  const stream = Boolean(options.onDelta);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body), signal });
  if (!response.ok) {
    console.warn(`[ai] gemini ${model}: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return { status: response.status, text: null };
  }
  if (stream && response.body) return readStream(response.body, options.onDelta!);
  const payload = (await response.json()) as GeminiPayload;
  const text = textOf(payload).trim();
  return { status: 200, text: (options.responseSchema ? unfence(text) : text) || null, usage: usageOf(payload) };
}

/** A streamed answer (server-sent events): each piece passed on as it arrives. */
async function readStream(body: ReadableStream<Uint8Array>, onDelta: (text: string) => void): Promise<Attempt> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let text = "";
  let usage: Usage | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      const chunk = JSON.parse(data) as GeminiPayload;
      const piece = textOf(chunk);
      if (piece) { text += piece; onDelta(piece); }
      usage = usageOf(chunk) ?? usage;
    }
  }
  return { status: 200, text: text.trim() || null, usage };
}

/** One tiny call to check a key and model before saving them; the error message when it fails. */
export async function testGemini(apiKey: string, model: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }], generationConfig: thinking(model, undefined) ? { thinkingConfig: thinking(model, undefined) } : {} }),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return { ok: true };
    const payload = (await response.json().catch(() => ({}))) as GeminiPayload;
    return { ok: false, message: payload.error?.message?.slice(0, 200) || `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Gemini-এ পৌঁছানো গেল না" };
  }
}
