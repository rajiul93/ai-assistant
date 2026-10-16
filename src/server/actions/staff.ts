"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, cleanPermissions, mergePermissions as merge, type StaffPermission } from "@/lib/staff";
import { isSuperAdminEmail, permissionsOf } from "@/server/roles";
import { userError } from "@/lib/user-error";

/**
 * Staff (role ADMIN) and what each may do. Open to the super admin and to staff with the "staff"
 * permission. Rules that keep it safe:
 * - the super admin can't be changed by anyone, and nobody changes their own access here;
 * - a staff member can give or take only permissions they have themselves (the rest of the
 *   other person's list stays as it was), and can't remove someone who has more than they do.
 */

const permissionList = z.array(z.enum(ALL_PERMISSIONS as [StaffPermission, ...StaffPermission[]])).max(ALL_PERMISSIONS.length);

async function requireStaffManager() {
  const me = await requireUser();
  const mine = await permissionsOf(me);
  if (!mine.includes("staff")) throw userError("এটা করতে Staff manage permission লাগবে।");
  return { me, mine, superAdmin: isSuperAdminEmail(me.email) };
}

async function editableTarget(userId: string, meId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, staffPermissions: true } });
  if (!target) throw userError("User পাওয়া যায়নি।");
  if (isSuperAdminEmail(target.email)) throw userError("Super admin-কে বদলানো যায় না।");
  if (target.id === meId) throw userError("নিজের access নিজে বদলানো যায় না।");
  return target;
}

/** Makes a signed-up user staff, found by exact email, with the chosen permissions. */
export async function addStaff(input: unknown) {
  const { email, permissions } = z.object({ email: z.string().trim().toLowerCase().email("ঠিক email দিন").max(200), permissions: permissionList }).parse(input);
  const { me, mine } = await requireStaffManager();
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!user) throw userError("এই email-এ কোনো account নেই — আগে তাকে একবার Prep-এ sign in করতে হবে।");
  const target = await editableTarget(user.id, me.id);
  const next = merge(cleanPermissions(target.staffPermissions), permissions, mine);
  await prisma.user.update({ where: { id: target.id }, data: { role: "ADMIN", staffPermissions: next } });
  revalidatePath("/", "layout");
}

export async function setStaffPermissions(input: unknown) {
  const { userId, permissions } = z.object({ userId: z.string().min(1).max(64), permissions: permissionList }).parse(input);
  const { me, mine } = await requireStaffManager();
  const target = await editableTarget(userId, me.id);
  if (target.role === "USER") throw userError("ইনি staff নন।");
  await prisma.user.update({ where: { id: target.id }, data: { staffPermissions: merge(cleanPermissions(target.staffPermissions), permissions, mine) } });
  revalidatePath("/", "layout");
}

/** Back to a normal user: no admin pages, and AI limits and plans apply again. */
export async function removeStaff(input: unknown) {
  const { userId } = z.object({ userId: z.string().min(1).max(64) }).parse(input);
  const { me, mine, superAdmin } = await requireStaffManager();
  const target = await editableTarget(userId, me.id);
  if (!superAdmin && cleanPermissions(target.staffPermissions).some((id) => !mine.includes(id))) {
    throw userError("যার permission আপনার চেয়ে বেশি, তাকে শুধু super admin বাদ দিতে পারেন।");
  }
  await prisma.user.update({ where: { id: target.id }, data: { role: "USER", staffPermissions: [] } });
  revalidatePath("/", "layout");
}
