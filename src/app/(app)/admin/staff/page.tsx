import { notFound } from "next/navigation";
import { StaffManager } from "@/components/admin/staff-manager";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, cleanPermissions } from "@/lib/staff";
import { isSuperAdminEmail, permissionsOf, SUPER_ADMIN_EMAIL } from "@/server/roles";

/** Our staff (role ADMIN, plus the super admin) and what each may do; customers are on /admin/customers. */
export default async function StaffPage() {
  const me = await requireUser();
  const mine = await permissionsOf(me);
  if (!mine.includes("staff")) notFound();
  const staff = await prisma.user.findMany({
    where: { OR: [{ role: { not: "USER" } }, { email: { equals: SUPER_ADMIN_EMAIL, mode: "insensitive" } }] },
    select: { id: true, name: true, email: true, image: true, staffPermissions: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const rows = staff
    .map((user) => {
      const superAdmin = isSuperAdminEmail(user.email);
      return { id: user.id, name: user.name, email: user.email, image: user.image, superAdmin, me: user.id === me.id, permissions: superAdmin ? [...ALL_PERMISSIONS] : cleanPermissions(user.staffPermissions) };
    })
    // The super admin first, then everyone else in the order they joined.
    .sort((a, b) => Number(b.superAdmin) - Number(a.superAdmin));
  return <StaffManager rows={rows} mine={mine} />;
}
