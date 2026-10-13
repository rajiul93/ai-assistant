import { AppShell } from "@/components/app-shell";
import { LiveProvider } from "@/components/collaboration/live-provider";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiState } from "@/server/ai-access";
import { roleOf } from "@/server/roles";
import { freshUserFlags } from "@/server/user-flags";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const role = await roleOf(user);
  const admin = role !== "USER";
  const [ai, pendingPayments, flags] = await Promise.all([
    getAiState(user, admin),
    admin ? prisma.payment.count({ where: { status: "PENDING" } }) : 0,
    freshUserFlags(user.id),
  ]);
  // Live counts (bell, Messages badge) for every signed-in page: socket.io if configured, else polling.
  return <LiveProvider><AppShell userName={flags?.name || user.name || user.email} userImage={user.image} aiLock={ai.lock} admin={admin} superAdmin={role === "SUPER_ADMIN"} pendingPayments={pendingPayments}>{children}</AppShell></LiveProvider>;
}
