import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiCall } from "./gemini";

const reply = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }), { status: 200 });

describe("gemini", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the schema and photos, and returns the answer without the model's thoughts", async () => {
    const fetchMock = vi.fn(async () => reply('{"ok":true}'));
    vi.stubGlobal("fetch", fetchMock);
    const schema = { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } } };
    const attempt = await geminiCall("gemini-2.5-flash", "key", "hi", { userId: "u", feature: "answer", responseSchema: schema, files: [{ mimeType: "image/png", data: "AAA" }] }, AbortSignal.timeout(1000));
    expect(attempt).toMatchObject({ status: 200, text: '{"ok":true}', usage: { input: 10, output: 5, total: 15 } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("models/gemini-2.5-flash:generateContent");
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } });
    expect(body.contents[0].parts[0]).toEqual({ inline_data: { mime_type: "image/png", data: "AAA" } });
  });

  it("with search asks for JSON in words and unwraps a fenced answer", async () => {
    const fetchMock = vi.fn(async () => reply('```json\n{"ok":true}\n```'));
    vi.stubGlobal("fetch", fetchMock);
    const attempt = await geminiCall("gemini-2.5-flash", "key", "hi", { userId: "u", feature: "answer", search: true, reasoning: "medium", responseSchema: { type: "OBJECT" } }, AbortSignal.timeout(1000));
    expect(attempt.text).toBe('{"ok":true}');
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.generationConfig.responseSchema).toBeUndefined();
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 4096 });
  });
});

describe("gemini 3", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("leaves thinking to the model unless a caller asks for reasoning", async () => {
    const fetchMock = vi.fn(async () => reply("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await geminiCall("gemini-3.8-flash", "key", "hi", { userId: "u", feature: "answer" }, AbortSignal.timeout(1000));
    await geminiCall("gemini-3.8-flash", "key", "hi", { userId: "u", feature: "answer", reasoning: "medium" }, AbortSignal.timeout(1000));
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)));
    expect(bodies[0].generationConfig.thinkingConfig).toBeUndefined();
    expect(bodies[1].generationConfig.thinkingConfig).toEqual({ thinkingLevel: "high" });
  });
});

describe("gemini rate limits", () => {
  it("reads how long Gemini asks to wait", async () => {
    const { retryDelayMs } = await import("./gemini");
    expect(retryDelayMs(JSON.stringify({ error: { code: 429, details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure" }, { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "17s" }] } }))).toBe(17_000);
    expect(retryDelayMs(JSON.stringify({ error: { details: [{ retryDelay: "1.5s" }] } }))).toBe(1_500);
    expect(retryDelayMs("not json")).toBeNull();
  });
});
