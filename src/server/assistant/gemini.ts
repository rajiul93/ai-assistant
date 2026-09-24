// Flash-Lite answers in ~1s on the free tier (Flash took 25–40s) and handles the assistant's intents well.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
// Tried when the main model is overloaded (503) or rate-limited (429).
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
// Free-tier responses regularly take 25–30s, so allow for that before giving up.
const TOTAL_BUDGET_MS = 40_000;

type GeminiPayload = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
type CallOptions = { search?: boolean; responseSchema?: object };

// After Google Search grounding hits its quota, skip it for a while instead of wasting a request per question.
let searchBlockedUntil = 0;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function callModel(model: string, apiKey: string, prompt: string, options: CallOptions, timeoutMs: number) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
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
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  return { status: response.status, text: text || null };
}

/** Returns the model's text, or null when the key is missing or every attempt fails. */
export async function callGemini(prompt: string, options: CallOptions = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (options.search && Date.now() < searchBlockedUntil) return null;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const models = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])];

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    try {
      const result = await callModel(model, apiKey, prompt, options, remaining);
      if (result.text) return result.text;
      console.warn(`[assistant] ${model}${options.search ? " (search)" : ""} failed: HTTP ${result.status}`);
      if (options.search && result.status === 429) { searchBlockedUntil = Date.now() + 30 * 60_000; return null; }
      if (result.status !== 503 && result.status !== 429) return null;
    } catch (error) {
      console.warn(`[assistant] ${model} failed: ${error instanceof Error && error.name === "TimeoutError" ? "timed out" : String(error)}`);
      return null;
    }
  }
  return null;
}
