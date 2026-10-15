import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { CustomerList, type CustomerTab } from "@/components/admin/customer-list";
import { requireUser } from "@/lib/auth";
import { planInfo } from "@/lib/billing-display";
import { lastPage, readPagination, readQuery } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { can, isSuperAdminEmail, SUPER_ADMIN_EMAIL } from "@/server/roles";

const TABS: CustomerTab[] = ["paid", "ended", "free"];

/**
 * Customers in three groups: a plan running now (paid), had a plan that has ended (ended — worth
 * a reminder), never bought (free). A cancelled plan's end is set to the moment it was cancelled,
 * so "a plan that hasn't ended" is exactly "paid now".
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireUser();
  if (!(await can(me, "customers"))) notFound();
  // Phone numbers stay private to the super admin (staff see the rest).
  const showPhone = isSuperAdminEmail(me.email);
  const params = await searchParams;
  const tab = TABS.find((item) => item === params.tab) ?? "paid";
  const q = readQuery(params);
  const { limit, page: requested } = readPagination(params);
  const now = new Date();

  const byTab: Record<CustomerTab, Prisma.UserWhereInput> = {
    paid: { entitlements: { some: { endsAt: { gt: now } } } },
    ended: { entitlements: { some: {}, none: { endsAt: { gt: now } } } },
    free: { entitlements: { none: {} } },
  };
  const digits = q.replace(/\D/g, "");
  // Customers are plain users; staff are on the Staff page.
  const customers: Prisma.UserWhereInput = { role: "USER", NOT: { email: { equals: SUPER_ADMIN_EMAIL, mode: "insensitive" } } };
  const searchOnly: Prisma.UserWhereInput = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, ...(showPhone && digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] } : {};
  const search: Prisma.UserWhereInput = { AND: [customers, searchOnly] };

  const [paid, ended, free, total] = await Promise.all([
    prisma.user.count({ where: { AND: [byTab.paid, search] } }),
    prisma.user.count({ where: { AND: [byTab.ended, search] } }),
    prisma.user.count({ where: { AND: [byTab.free, search] } }),
    prisma.user.count({ where: { AND: [byTab[tab], search] } }),
  ]);
  const page = Math.min(requested, lastPage(total, limit));
  const users = await prisma.user.findMany({
    where: { AND: [byTab[tab], search] },
    select: { id: true, name: true, email: true, phone: true, image: true, status: true, aiPaused: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * limit,
    take: limit,
  });
  const ids = users.map((user) => user.id);
  const [spent, entitlements, lastAi] = await Promise.all([
    prisma.payment.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "APPROVED" }, _sum: { amountBdt: true }, _count: true }),
    prisma.entitlement.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, endsAt: true, payment: { select: { planType: true, packageName: true, breakdown: true, amountBdt: true } } },
      orderBy: { endsAt: "desc" },
    }),
    prisma.aiUsage.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _max: { createdAt: true } }),
  ]);
  // The same plan name as on the admin Billing page; old package payments also say their tier.
  const planLabel = (payment: (typeof entitlements)[number]["payment"]) => (payment.breakdown ? payment.packageName : `${planInfo[payment.planType].label} · ${payment.packageName}`);

  const rows = users.map((user) => {
    const paidRow = spent.find((item) => item.userId === user.id);
    const own = entitlements.filter((item) => item.userId === user.id);
    // Paid: every plan running now (they can run side by side); otherwise the last one bought.
    const running = own.filter((item) => item.endsAt > now);
    const shown = running.length ? running : own.slice(0, 1);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: showPhone ? user.phone : null,
      image: user.image,
      blocked: user.status === "BLOCKED",
      aiPaused: user.aiPaused,
      joinedAt: user.createdAt.toISOString(),
      paidBdt: paidRow?._sum.amountBdt ?? 0,
      payments: paidRow?._count ?? 0,
      planEndsAt: own[0]?.endsAt.toISOString() ?? null,
      plans: shown.map((item) => ({ label: planLabel(item.payment), priceBdt: item.payment.amountBdt, endsAt: item.endsAt.toISOString() })),
      lastAiAt: lastAi.find((item) => item.userId === user.id)?._max.createdAt?.toISOString() ?? null,
    };
  });

  return <CustomerList tab={tab} counts={{ paid, ended, free }} rows={rows} page={page} limit={limit} total={total} query={q} now={now.toISOString()} />;
}
