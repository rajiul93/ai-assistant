import { QuickItemsSettings } from "@/components/settings/quick-items-settings";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_QUICK_ITEMS } from "@/lib/quick-items";

export const metadata = { title: "সেটিংস — Prep" };

/** The user's own settings; for now the floating dock's shortcuts. */
export default async function SettingsPage() {
  const me = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: me.id }, select: { quickItems: true } });
  return <div className="mx-auto max-w-2xl space-y-4">
    <h1 className="text-2xl font-bold tracking-tight text-slate-900">সেটিংস</h1>
    <QuickItemsSettings initial={user?.quickItems ?? DEFAULT_QUICK_ITEMS} />
  </div>;
}
