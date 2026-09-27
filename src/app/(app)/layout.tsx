import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiState } from "@/server/ai-access";
import { roleOf } from "@/server/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const role = await roleOf(user);
  const admin = role !== "USER";
  const [ai, pendingPayments] = await Promise.all([
    getAiState(user, admin),
    admin ? prisma.payment.count({ where: { status: "PENDING" } }) : 0,
  ]);
  return <AppShell userName={user.name || user.email} aiLock={ai.lock} admin={admin} superAdmin={role === "SUPER_ADMIN"} pendingPayments={pendingPayments}>{children}</AppShell>;
}
