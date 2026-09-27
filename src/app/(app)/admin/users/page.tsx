import { notFound } from "next/navigation";
import { UserRoles } from "@/components/admin/user-roles";
import { requireUser } from "@/lib/auth";
import { lastPage, readPagination, readQuery } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getPlanStatus } from "@/server/billing";
import { isSuperAdminEmail } from "@/server/roles";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser();
  if (!isSuperAdminEmail(me.email)) notFound();
  // Page, page size and search come from the URL, so a reload keeps them.
  const params = await searchParams;
  const q = readQuery(params);
  const { limit, page: requested } = readPagination(params);
  const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {};
  const [total, blocked] = await Promise.all([prisma.user.count({ where }), prisma.user.count({ where: { status: "BLOCKED" } })]);
  const page = Math.min(requested, lastPage(total, limit));
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, status: true, aiPaused: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * limit,
    take: limit,
  });
  const plans = await Promise.all(users.map((user) => getPlanStatus(user.id)));
  const rows = users.map((user, index) => ({
    ...user,
    superAdmin: isSuperAdminEmail(user.email),
    // A stored SUPER_ADMIN on another email only counts as ADMIN.
    role: isSuperAdminEmail(user.email) ? "SUPER_ADMIN" as const : user.role === "SUPER_ADMIN" ? "ADMIN" as const : user.role,
    plan: {
      active: plans[index].active,
      endsAt: plans[index].endsAt,
      daysLeft: plans[index].daysLeft,
      leftPercent: plans[index].tokensTotal ? Math.round((plans[index].tokensLeft / plans[index].tokensTotal) * 100) : 0,
    },
  }));
  return <UserRoles users={rows} page={page} limit={limit} total={total} blocked={blocked} query={q} />;
}
