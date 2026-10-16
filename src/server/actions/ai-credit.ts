"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/server/roles";
import { userError } from "@/lib/user-error";

/**
 * Money put on the OpenAI account, entered by the super admin, so /usage can show the dollars
 * left. OpenAI has no API for the prepaid balance; spending comes from its Costs API instead.
 */

async function requireOwner() {
  const user = await requireUser();
  if (!isSuperAdminEmail(user.email)) throw userError("শুধু super admin এটা করতে পারেন।");
  return user;
}

const addSchema = z.object({
  amountUsd: z.number().positive("পরিমাণ লিখুন").max(100_000),
  /** YYYY-MM-DD: the day the money was added. */
  addedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ দিন"),
  note: z.string().trim().max(200).optional(),
});

export async function addAiCredit(input: z.input<typeof addSchema>) {
  await requireOwner();
  const { amountUsd, addedOn, note } = addSchema.parse(input);
  const addedAt = new Date(`${addedOn}T00:00:00Z`);
  if (addedAt.getTime() > Date.now() + 86_400_000) throw userError("ভবিষ্যতের তারিখ দেওয়া যাবে না।");
  await prisma.aiCredit.create({ data: { amountCents: Math.round(amountUsd * 100), addedAt, note: note || null } });
  revalidatePath("/usage");
}

export async function deleteAiCredit(id: string) {
  await requireOwner();
  await prisma.aiCredit.deleteMany({ where: { id: z.string().min(1).max(64).parse(id) } });
  revalidatePath("/usage");
}
