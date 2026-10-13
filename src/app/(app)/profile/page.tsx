import { ProfileForm } from "@/components/profile/profile-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Profile — Prep" };

export default async function ProfilePage() {
  const me = await requireUser();
  // Read fresh: the session user may be up to 5 minutes old.
  const user = await prisma.user.findUnique({ where: { id: me.id }, select: { name: true, phone: true, email: true, image: true } });
  if (!user) return null;
  return <ProfileForm initial={user} />;
}
