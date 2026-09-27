import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** The one super admin. Fixed in code, so no database edit can create another. */
export const SUPER_ADMIN_EMAIL = "rajiulrayhan@gmail.com";

type WhoAmI = { id: string; email: string };

export function isSuperAdminEmail(email: string | null | undefined) {
  return Boolean(email) && email!.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

/**
 * The user's role, read fresh from the database every time (not from the 5-minute session cache),
 * so a role change takes effect on the next request. A stored SUPER_ADMIN on any other email counts
 * only as ADMIN.
 */
export async function roleOf(user: WhoAmI): Promise<UserRole> {
  if (isSuperAdminEmail(user.email)) return "SUPER_ADMIN";
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const role = row?.role ?? "USER";
  return role === "SUPER_ADMIN" ? "ADMIN" : role;
}

/** Admins and the super admin: no AI limits, and the admin pages. */
export async function isAdminUser(user: WhoAmI) {
  return (await roleOf(user)) !== "USER";
}
