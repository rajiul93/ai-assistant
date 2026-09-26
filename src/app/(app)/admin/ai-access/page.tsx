import { notFound } from "next/navigation";
import { AiAccessTable } from "@/components/admin/ai-access-table";
import { isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AiAccessPage() {
  const user = await requireUser();
  if (!isAdmin(user.email)) notFound();
  const [users, usage] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, aiAccess: true, aiRequestedAt: true, aiTokenLimit: true, createdAt: true, _count: { select: { aiUsage: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiUsage.groupBy({ by: ["userId"], _sum: { totalTokens: true } }),
  ]);
  const tokensUsed = new Map(usage.map((row) => [row.userId, row._sum.totalTokens ?? 0]));
  const order = { REQUESTED: 0, APPROVED: 1, DISABLED: 2, NONE: 3 } as const;
  // Waiting requests first (oldest request first), then everyone else, newest sign-up first.
  const rows = users
    .map((row) => ({ ...row, admin: isAdmin(row.email), usage: row._count.aiUsage, tokensUsed: tokensUsed.get(row.id) ?? 0 }))
    .sort((a, b) => Number(a.admin) - Number(b.admin)
      || order[a.aiAccess] - order[b.aiAccess]
      || (a.aiAccess === "REQUESTED" ? (a.aiRequestedAt?.getTime() ?? 0) - (b.aiRequestedAt?.getTime() ?? 0) : 0));
  return <AiAccessTable users={rows} />;
}
