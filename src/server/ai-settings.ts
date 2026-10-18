import { prisma } from "@/lib/prisma";
import { open } from "@/server/secret-box";

/**
 * Which AI answers: OpenAI (key in OPENAI_API_KEY, as always) or Gemini (key entered by the super
 * admin on /usage, stored encrypted). Read for every AI call, so it is kept for 30 seconds per
 * server instance; saving clears it here. Server-only.
 */
export type AiProvider = "openai" | "gemini";
export type AiSettingsNow = { provider: AiProvider; gemini: { key: string; model: string | null } | null };

const KEEP_MS = 30_000;
let cached: { value: AiSettingsNow; at: number } | null = null;

export async function getAiSettings(): Promise<AiSettingsNow> {
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.value;
  // Before the AiSettings migration runs the table is missing: OpenAI, as before.
  const row = await prisma.aiSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  const key = row?.geminiKey ? open(row.geminiKey) : null;
  const value: AiSettingsNow = { provider: row?.provider === "gemini" ? "gemini" : "openai", gemini: key ? { key, model: row?.geminiModel || null } : null };
  cached = { value, at: Date.now() };
  return value;
}

export function forgetAiSettings() {
  cached = null;
}
