"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { TOKEN_LIMIT_OPTIONS } from "@/lib/ai-limits";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** A user asks the admins for AI access (again, if it was turned off). */
export async function requestAiAccess() {
  const user = await requireUser();
  if (isAdmin(user.email)) return;
  await prisma.user.updateMany({
    where: { id: user.id, aiAccess: { in: ["NONE", "DISABLED"] } },
    data: { aiAccess: "REQUESTED", aiRequestedAt: new Date() },
  });
  revalidatePath("/", "layout");
}

/** Admins only: approve / turn on, or turn off, one user's AI access. */
export async function setUserAiAccess(input: unknown) {
  const admin = await requireUser();
  if (!isAdmin(admin.email)) throw new Error("Only admins can change AI access.");
  const { userId, enabled } = z.object({ userId: z.string().min(1), enabled: z.boolean() }).parse(input);
  await prisma.user.update({ where: { id: userId }, data: { aiAccess: enabled ? "APPROVED" : "DISABLED" } });
  revalidatePath("/", "layout");
}

/** Admins only: set a user's total AI token limit to one of the offered sizes, or null for unlimited. */
export async function setUserTokenLimit(input: unknown) {
  const admin = await requireUser();
  if (!isAdmin(admin.email)) throw new Error("Only admins can change token limits.");
  const { userId, limit } = z.object({
    userId: z.string().min(1),
    limit: z.number().int().refine((value) => (TOKEN_LIMIT_OPTIONS as readonly number[]).includes(value)).nullable(),
  }).parse(input);
  await prisma.user.update({ where: { id: userId }, data: { aiTokenLimit: limit } });
  revalidatePath("/", "layout");
}
