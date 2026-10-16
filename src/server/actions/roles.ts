"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelSubscription } from "@/server/billing";
import { can, isSuperAdminEmail } from "@/server/roles";
import { userError } from "@/lib/user-error";

/**
 * Customer controls (block, AI pause, cancel): staff with the Customers permission. Nothing here
 * can be turned on the super admin, and only the super admin may use them on other staff (staff
 * are managed on the Staff page).
 */
async function customerControl(userId: string) {
  const me = await requireUser();
  if (!(await can(me, "customers"))) throw userError("এটা করতে Customers permission লাগবে।");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!target) throw userError("User পাওয়া যায়নি।");
  if (isSuperAdminEmail(target.email)) throw userError("Super admin-এর ওপর এটা করা যায় না।");
  if (target.role !== "USER" && !isSuperAdminEmail(me.email)) throw userError("Staff-এর ওপর এটা শুধু super admin করতে পারেন।");
  return me;
}

/** Block: the whole account stops (the user only sees a notice). Unblock restores everything. */
export async function setUserBlocked(input: unknown) {
  const { userId, blocked } = z.object({ userId: z.string().min(1), blocked: z.boolean() }).parse(input);
  await customerControl(userId);
  await prisma.user.update({ where: { id: userId }, data: { status: blocked ? "BLOCKED" : "ACTIVE" } });
  revalidatePath("/", "layout");
}

/** Deactivate: the AI stops for this user (plan days keep running); the rest of the app works. */
export async function setUserAiPaused(input: unknown) {
  const { userId, paused } = z.object({ userId: z.string().min(1), paused: z.boolean() }).parse(input);
  await customerControl(userId);
  await prisma.user.update({ where: { id: userId }, data: { aiPaused: paused } });
  revalidatePath("/", "layout");
}

/** Cancel subscription: the plan ends now and its remaining days and use are removed. */
export async function cancelUserSubscription(input: unknown) {
  const { userId } = z.object({ userId: z.string().min(1) }).parse(input);
  const me = await customerControl(userId);
  await cancelSubscription(userId, me.email);
  revalidatePath("/", "layout");
}
