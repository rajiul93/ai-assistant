import { Suspense } from "react";
import { MessagesView } from "@/components/collaboration/messages-view";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Messages — Prep" };

export default async function MessagesPage() {
  const user = await requireUser();
  return <Suspense><MessagesView me={user.id} /></Suspense>;
}
