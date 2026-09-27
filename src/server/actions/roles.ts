"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription } from "@/server/billing";
import { isSuperAdminEmail } from "@/server/roles";

/**
 * Super admin only: make a user an ADMIN or a plain USER. Nobody can be made super admin, and the
 * super admin's own role can't be changed.
 */
export async function setUserRole(input: unknown) {
  const { userId, role } = z.object({ userId: z.string().min(1), role: z.enum(["USER", "ADMIN"]) }).parse(input);
  await superAdminOver(userId);
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/", "layout");
}

/** Every control here is the super admin's alone, and none of them can be turned on the super admin. */
async function superAdminOver(userId: string) {
  const me = await requireUser();
  if (!isSuperAdminEmail(me.email)) throw new Error("Only the super admin can do this.");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) throw new Error("User not found.");
  if (isSuperAdminEmail(target.email)) throw new Error("This can't be done to the super admin.");
  return me;
}

/** Block: the whole account stops (the user only sees a notice). Unblock restores everything. */
export async function setUserBlocked(input: unknown) {
  const { userId, blocked } = z.object({ userId: z.string().min(1), blocked: z.boolean() }).parse(input);
  await superAdminOver(userId);
  await prisma.user.update({ where: { id: userId }, data: { status: blocked ? "BLOCKED" : "ACTIVE" } });
  revalidatePath("/", "layout");
}

/** Deactivate: the AI stops for this user (plan days keep running); the rest of the app works. */
export async function setUserAiPaused(input: unknown) {
  const { userId, paused } = z.object({ userId: z.string().min(1), paused: z.boolean() }).parse(input);
  await superAdminOver(userId);
  await prisma.user.update({ where: { id: userId }, data: { aiPaused: paused } });
  revalidatePath("/", "layout");
}

/** Cancel subscription: the plan ends now and its remaining days and use are removed. */
export async function cancelUserSubscription(input: unknown) {
  const { userId } = z.object({ userId: z.string().min(1) }).parse(input);
  const me = await superAdminOver(userId);
  await cancelSubscription(userId, me.email);
  revalidatePath("/", "layout");
}
