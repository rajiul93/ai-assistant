import { AppShell } from "@/components/app-shell";
import { isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiAccess, getAiQuota } from "@/server/ai-access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const admin = isAdmin(user.email);
  const [aiAccess, aiQuota, pendingRequests] = await Promise.all([
    getAiAccess(user),
    getAiQuota(user),
    admin ? prisma.user.count({ where: { aiAccess: "REQUESTED" } }) : 0,
  ]);
  return <AppShell userName={user.name || user.email} aiAccess={aiAccess} aiQuota={aiQuota} admin={admin} pendingRequests={pendingRequests}>{children}</AppShell>;
}
