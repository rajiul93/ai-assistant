"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleOf } from "@/server/roles";

/**
 * The super admin's price controls (docs/subscription-plan.md): settings, AI tiers, exams and
 * durations. Every action checks the role on the server (read fresh from the database), and every
 * input schema is strict, so an extra field is refused rather than written. New prices apply to new
 * payments only; each payment keeps the price it was made at.
 */

async function requireSuperAdmin() {
  const user = await requireUser();
  if ((await roleOf(user)) !== "SUPER_ADMIN") throw new Error("শুধু super admin দাম বদলাতে পারেন।");
  return user;
}

const done = () => revalidatePath("/", "layout");
const price = z.coerce.number().int().min(0, "দাম ০ বা তার বেশি").max(1_000_000);
const percent = z.coerce.number().int().min(0).max(90, "ছাড় ৯০%-এর বেশি না");
const count = z.coerce.number().int().min(0).max(100_000);
const id = z.string().min(1).max(64);

/** Everything the pricing panel shows, inactive rows included. */
export async function getPricingAdmin() {
  await requireSuperAdmin();
  const [settings, tiers, tracks, durations] = await Promise.all([
    prisma.pricingSettings.findUnique({ where: { id: "default" } }),
    prisma.aiTier.findMany({ orderBy: { priceBdt: "asc" } }),
    prisma.examTrack.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.planDuration.findMany({ orderBy: [{ sortOrder: "asc" }, { days: "asc" }] }),
  ]);
  return { settings, tiers, tracks, durations };
}

export async function saveSettings(input: unknown) {
  await requireSuperAdmin();
  const data = z.object({ systemPriceBdt: price, allTracksDiscountPct: percent, gatewayEnabled: z.boolean() }).strict().parse(input);
  await prisma.pricingSettings.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  done();
}

export async function saveTier(input: unknown) {
  await requireSuperAdmin();
  const { planType, ...data } = z.object({
    planType: z.enum(["STUDENT", "PROFESSIONAL"]),
    name: z.string().trim().min(1).max(40),
    priceBdt: price,
    tokensPerMonth: z.coerce.number().int().min(1_000).max(1_000_000_000),
    messagesPerDay: count,
    scansPerDay: count,
    suggestionsPerDay: count,
    active: z.boolean(),
  }).strict().parse(input);
  await prisma.aiTier.update({ where: { planType }, data });
  done();
}

const trackSchema = z.object({
  name: z.string().trim().min(1, "পরীক্ষার নাম দিন").max(60),
  priceBdt: price,
  bankExam: z.enum(["BCS", "PRIMARY", "GRADE_11_20"]).nullable(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
}).strict();

/**
 * Adds or edits an exam. A new active exam is on sale at once — as its own plan for both tiers and
 * inside "all exams" — because plans are worked out from these rows, never stored.
 */
export async function saveTrack(input: unknown) {
  await requireSuperAdmin();
  const { id: trackId, ...rest } = z.object({ id: id.nullable() }).passthrough().parse(input);
  const data = trackSchema.parse(rest);
  if (data.bankExam) {
    const taken = await prisma.examTrack.findFirst({ where: { bankExam: data.bankExam, ...(trackId ? { id: { not: trackId } } : {}) }, select: { name: true } });
    if (taken) throw new Error(`এই প্রশ্ন ব্যাংক আগেই “${taken.name}”-এর সাথে যুক্ত।`);
  }
  if (trackId) await prisma.examTrack.update({ where: { id: trackId }, data });
  else await prisma.examTrack.create({ data });
  done();
}

/** Removes an exam nobody has bought; one that was bought can only be turned off (records refer to it). */
export async function deleteTrack(trackId: string) {
  await requireSuperAdmin();
  const target = id.parse(trackId);
  if (await prisma.payment.count({ where: { trackIds: { has: target } } })) throw new Error("এই পরীক্ষা কেউ কিনেছে — মুছে না ফেলে বন্ধ (inactive) করুন।");
  await prisma.examTrack.delete({ where: { id: target } });
  done();
}

const durationSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650),
  label: z.string().trim().min(1).max(30),
  discountPct: percent,
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
}).strict();

export async function saveDuration(input: unknown) {
  await requireSuperAdmin();
  const { id: durationId, ...rest } = z.object({ id: id.nullable() }).passthrough().parse(input);
  const data = durationSchema.parse(rest);
  const clash = await prisma.planDuration.findFirst({ where: { days: data.days, ...(durationId ? { id: { not: durationId } } : {}) }, select: { id: true } });
  if (clash) throw new Error(`${data.days} দিনের মেয়াদ আগেই আছে।`);
  if (durationId) await prisma.planDuration.update({ where: { id: durationId }, data });
  else await prisma.planDuration.create({ data });
  done();
}

/** Payments keep their own days, so removing a duration never changes a bought plan. */
export async function deleteDuration(durationId: string) {
  await requireSuperAdmin();
  await prisma.planDuration.delete({ where: { id: id.parse(durationId) } });
  done();
}
