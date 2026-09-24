"use server";

import { requireUser } from "@/lib/auth";
import { getTasks } from "@/server/queries";

export async function listMyTasks() {
  const user = await requireUser();
  return getTasks(user.id);
}
