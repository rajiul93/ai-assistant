import type { UserRole } from "@prisma/client";
import { ALL_PERMISSIONS, cleanPermissions, type StaffPermission } from "@/lib/staff";
import { freshUserFlags } from "@/server/user-flags";

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
  const role = (await freshUserFlags(user.id))?.role ?? "USER";
  return role === "SUPER_ADMIN" ? "ADMIN" : role;
}

/** Admins and the super admin: no AI limits, and the admin pages. */
export async function isAdminUser(user: WhoAmI) {
  return (await roleOf(user)) !== "USER";
}

/**
 * What this user may do on the admin side, read fresh like the role: everything for the super
 * admin, the stored list for staff (ADMIN), nothing for a USER.
 */
export async function permissionsOf(user: WhoAmI): Promise<StaffPermission[]> {
  if (isSuperAdminEmail(user.email)) return [...ALL_PERMISSIONS];
  const flags = await freshUserFlags(user.id);
  if (!flags || flags.role === "USER") return [];
  return cleanPermissions(flags.staffPermissions);
}

/** True when the user may do this admin work (see src/lib/staff.ts). */
export async function can(user: WhoAmI, permission: StaffPermission) {
  return (await permissionsOf(user)).includes(permission);
}
