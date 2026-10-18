"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanQuickItems } from "@/lib/quick-items";

/** The user's own dock shortcuts, in order; unknown ids are dropped and the list is cut to the limit. */
export async function saveQuickItems(input: unknown) {
  const user = await requireUser();
  const items = cleanQuickItems(z.array(z.string().max(64)).max(50).parse(input));
  await prisma.user.update({ where: { id: user.id }, data: { quickItems: items } });
  // Every signed-in page shows the dock.
  revalidatePath("/", "layout");
  return items;
}
