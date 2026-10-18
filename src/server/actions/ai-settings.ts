"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userError } from "@/lib/user-error";
import { forgetAiSettings } from "@/server/ai-settings";
import { GEMINI_DEFAULT_MODEL, testGemini } from "@/server/assistant/gemini";
import { isSuperAdminEmail } from "@/server/roles";
import { open, seal } from "@/server/secret-box";

/**
 * The AI switch on /usage (super admin only): OpenAI or Gemini, and the Gemini key and model. The
 * key is tested before it is saved, stored encrypted, and never sent back to the page (only its
 * last four characters).
 */

async function requireOwner() {
  const user = await requireUser();
  if (!isSuperAdminEmail(user.email)) throw userError("শুধু super admin এটা করতে পারেন।");
  return user;
}

const readRow = () => prisma.aiSettings.findUnique({ where: { id: "default" } });

export async function getAiSettingsView() {
  await requireOwner();
  const row = await readRow();
  const key = row?.geminiKey ? open(row.geminiKey) : null;
  return {
    provider: row?.provider === "gemini" ? ("gemini" as const) : ("openai" as const),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    geminiKeyEnding: key ? key.slice(-4) : null,
    // Saved but no longer readable (the server's secret changed): it has to be entered again.
    geminiKeyUnreadable: Boolean(row?.geminiKey && !key),
    geminiModel: row?.geminiModel ?? "",
    defaultModel: GEMINI_DEFAULT_MODEL,
  };
}

const saveSchema = z.object({
  provider: z.enum(["openai", "gemini"]),
  /** A new key; empty keeps the saved one. */
  geminiKey: z.string().trim().max(200).optional(),
  geminiModel: z.string().trim().max(80).regex(/^[a-z0-9.\-]*$/i, "Model-এর নাম ঠিক নেই (যেমন gemini-3.8-flash)").optional(),
  removeKey: z.boolean().optional(),
});

export async function saveAiSettings(input: z.input<typeof saveSchema>) {
  await requireOwner();
  const data = saveSchema.parse(input);
  const row = await readRow();
  const model = data.geminiModel || null;
  let sealed = data.removeKey ? null : row?.geminiKey ?? null;
  if (data.geminiKey) {
    const tested = await testGemini(data.geminiKey, model || GEMINI_DEFAULT_MODEL);
    if (!tested.ok) throw userError(`Gemini key কাজ করছে না: ${tested.message}`);
    sealed = seal(data.geminiKey);
  }
  if (data.provider === "gemini" && !(sealed && open(sealed))) throw userError("Gemini চালু করতে আগে Gemini key দিন।");
  if (data.provider === "openai" && !process.env.OPENAI_API_KEY && !(sealed && open(sealed))) throw userError("OpenAI key (OPENAI_API_KEY) সেট করা নেই।");
  await prisma.aiSettings.upsert({
    where: { id: "default" },
    create: { id: "default", provider: data.provider, geminiKey: sealed, geminiModel: model },
    update: { provider: data.provider, geminiKey: sealed, geminiModel: model },
  });
  forgetAiSettings();
  revalidatePath("/usage");
}

/** Checks the saved Gemini key and model with one tiny call. */
export async function testSavedGemini() {
  await requireOwner();
  const row = await readRow();
  const key = row?.geminiKey ? open(row.geminiKey) : null;
  if (!key) throw userError("আগে Gemini key সেভ করুন।");
  const tested = await testGemini(key, row?.geminiModel || GEMINI_DEFAULT_MODEL);
  if (!tested.ok) throw userError(`Gemini কাজ করছে না: ${tested.message}`);
}
