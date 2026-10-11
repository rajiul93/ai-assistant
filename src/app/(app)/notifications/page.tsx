import { NotificationsView } from "@/components/collaboration/notifications-view";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Notifications — Prep" };

export default async function NotificationsPage() {
  await requireUser();
  return <NotificationsView />;
}
