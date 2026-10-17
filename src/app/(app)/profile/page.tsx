import { ProfileForm } from "@/components/profile/profile-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanStatus } from "@/server/billing";
import { isAdminUser } from "@/server/roles";

export const metadata = { title: "Profile — Prep" };

export default async function ProfilePage() {
  const me = await requireUser();
  // Read fresh: the session user may be up to 5 minutes old.
  const [user, plan, staff] = await Promise.all([
    prisma.user.findUnique({ where: { id: me.id }, select: { name: true, phone: true, email: true, image: true, createdAt: true } }),
    getPlanStatus(me.id),
    isAdminUser(me),
  ]);
  if (!user) return null;
  return <ProfileForm initial={user} plan={{ active: plan.active, hadPlan: plan.hasPlan, daysLeft: plan.daysLeft, endsAt: plan.endsAt }} staff={staff} />;
}
