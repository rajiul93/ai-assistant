"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizeBdPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

/**
 * The user's own profile: name and phone (docs/profile-and-group-chat-plan.md §1). The phone is
 * private — only the user and the super admin's user list read it.
 */

const profileSchema = z.object({
  name: z.string().trim().min(2, "নাম অন্তত ২ অক্ষরের দিন").max(60, "নাম সর্বোচ্চ ৬০ অক্ষর"),
  phone: z.string().trim().max(30).transform((value, ctx) => {
    if (!value) return null;
    const phone = normalizeBdPhone(value);
    if (!phone) ctx.addIssue({ code: "custom", message: "সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)" });
    return phone;
  }),
});

export async function updateProfile(input: unknown) {
  const me = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "তথ্য ঠিক নেই।");
  const { name, phone } = parsed.data;
  // profileUpdatedAt tells sign-in to keep this name instead of the Google one.
  await prisma.user.update({ where: { id: me.id }, data: { name, phone, profileUpdatedAt: new Date() } });
  revalidatePath("/", "layout");
  return { name, phone };
}
