"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { affiliateLink, WINDOW_DAYS_MAX } from "@/lib/affiliate";
import { requireUser } from "@/lib/auth";
import { normalizeBdPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { userError } from "@/lib/user-error";
import { affiliateBalance, canEarn, ensureAffiliateCode, loadAffiliateSettings } from "@/server/affiliate";
import { can, isSuperAdminEmail } from "@/server/roles";

/**
 * The affiliate program (docs/affiliate-plan.md): the affiliate's own page (/affiliate) and the
 * admin page (/admin/affiliates). Rules are the super admin's; choosing affiliates, recording cash
 * payouts and voiding a commission need the Billing permission.
 */

const idSchema = z.string().min(1).max(64);

/** This site's address, for the link: APP_URL when set, else the request's own host. */
async function appUrl() {
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host");
  const proto = head.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;
}

/** Someone's name for the affiliate's list: first name only, never the email. */
const shortName = (name: string | null) => (name?.trim().split(/\s+/)[0] || "একজন user");

/** Everything /affiliate shows: whether I can earn, my link, what it brought, and what I'm owed. */
export async function getMyAffiliate() {
  const me = await requireUser();
  const [settings, user] = await Promise.all([
    loadAffiliateSettings(),
    prisma.user.findUnique({ where: { id: me.id }, select: { affiliateActive: true, status: true, affiliatePayoutNumber: true } }),
  ]);
  const rules = { commissionMode: settings.commissionMode, percent: settings.percent, fixedBdt: settings.fixedBdt, recurring: settings.recurring, windowDays: settings.windowDays, payoutMode: settings.payoutMode };
  if (!user || !canEarn(settings, user)) return { eligible: false as const, enabled: settings.enabled, rules };

  const code = await ensureAffiliateCode(me.id);
  const [clicks, signups, commissions, money, payouts] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateId: me.id } }),
    prisma.user.count({ where: { referredById: me.id } }),
    prisma.affiliateCommission.findMany({
      where: { affiliateId: me.id }, orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, amountBdt: true, basisBdt: true, rule: true, canceledAt: true, createdAt: true, customer: { select: { name: true } } },
    }),
    affiliateBalance(me.id),
    prisma.affiliatePayout.findMany({ where: { affiliateId: me.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, amountBdt: true, note: true, createdAt: true } }),
  ]);
  const customers = new Set((await prisma.affiliateCommission.findMany({ where: { affiliateId: me.id, canceledAt: null }, select: { customerId: true } })).map((row) => row.customerId)).size;
  return {
    eligible: true as const, enabled: true, rules, code, link: affiliateLink(await appUrl(), code),
    stats: { clicks, signups, customers },
    money, payoutNumber: user.affiliatePayoutNumber,
    commissions: commissions.map(({ customer, ...row }) => ({ ...row, customer: shortName(customer.name) })),
    payouts,
  };
}

/** Where cash commission is sent (bKash/Nagad personal number). */
export async function saveAffiliatePayoutNumber(input: unknown) {
  const me = await requireUser();
  const raw = z.string().max(20).parse(input);
  const number = raw.trim() ? normalizeBdPhone(raw) : null;
  if (raw.trim() && !number) throw userError("bKash/Nagad নম্বরটা ১১ সংখ্যায় দাও, যেমন 017XXXXXXXX।");
  await prisma.user.update({ where: { id: me.id }, data: { affiliatePayoutNumber: number } });
  revalidatePath("/affiliate");
}

/* ---------- Admin ---------- */

async function requireBilling() {
  const me = await requireUser();
  if (!(await can(me, "billing"))) throw userError("এটা করতে Billing permission লাগবে।");
  return me;
}

/** The admin page: the rules, every affiliate with their numbers, and the latest commissions. */
export async function getAffiliateAdmin() {
  const me = await requireBilling();
  const settings = await loadAffiliateSettings();
  // Affiliates: chosen by an admin, or anyone who already brought someone or earned.
  const people = await prisma.user.findMany({
    where: { OR: [{ affiliateActive: true }, { referrals: { some: {} } }, { commissionsEarned: { some: {} } }] },
    orderBy: { createdAt: "asc" }, take: 300,
    select: { id: true, name: true, email: true, affiliateCode: true, affiliateActive: true, affiliatePayoutNumber: true, status: true, _count: { select: { referrals: true, affiliateClicks: true } } },
  });
  const rows = await Promise.all(people.map(async ({ _count, ...person }) => ({
    ...person, clicks: _count.affiliateClicks, signups: _count.referrals, earning: canEarn(settings, person), ...(await affiliateBalance(person.id)),
  })));
  const commissions = await prisma.affiliateCommission.findMany({
    orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, amountBdt: true, basisBdt: true, rule: true, canceledAt: true, createdAt: true, affiliate: { select: { name: true, email: true } }, customer: { select: { name: true, email: true } } },
  });
  return { settings, canEditRules: isSuperAdminEmail(me.email), affiliates: rows, commissions };
}

const settingsSchema = z.object({
  enabled: z.boolean(),
  openToAll: z.boolean(),
  commissionMode: z.enum(["PERCENT", "FIXED"]),
  percent: z.number().int().min(0, "শতাংশ ০–১০০").max(100, "শতাংশ ০–১০০"),
  fixedBdt: z.number().int().min(0, "টাকা ০ বা বেশি").max(100_000, "টাকা খুব বেশি"),
  recurring: z.boolean(),
  windowDays: z.number().int().min(1, "সময়সীমা অন্তত ১ দিন").max(WINDOW_DAYS_MAX, `সময়সীমা সর্বোচ্চ ${WINDOW_DAYS_MAX} দিন`),
  payoutMode: z.enum(["CASH", "CREDIT"]),
});

/** The rules: super admin only, like prices. They apply to commissions earned from now on. */
export async function saveAffiliateSettings(input: unknown) {
  const me = await requireUser();
  if (!isSuperAdminEmail(me.email)) throw userError("Affiliate-এর নিয়ম শুধু super admin বদলাতে পারে।");
  const data = settingsSchema.parse(input);
  await prisma.affiliateSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  revalidatePath("/admin/affiliates");
  revalidatePath("/affiliate");
}

/** Makes a user an affiliate (by email) or stops it. Their earned money stays theirs. */
export async function setAffiliateActive(input: unknown) {
  await requireBilling();
  const { email, active } = z.object({ email: z.string().trim().toLowerCase().email("ঠিক email দাও"), active: z.boolean() }).parse(input);
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!user) throw userError("এই email-এ কোনো user নেই — আগে তাকে একবার app-এ ঢুকতে হবে।");
  await prisma.user.update({ where: { id: user.id }, data: { affiliateActive: active } });
  if (active) await ensureAffiliateCode(user.id);
  revalidatePath("/admin/affiliates");
}

/** Cash sent to an affiliate (outside the app); at most what they are owed. */
export async function recordAffiliatePayout(input: unknown) {
  const me = await requireBilling();
  const { affiliateId, amountBdt, note } = z.object({
    affiliateId: idSchema,
    amountBdt: z.number().int().min(1, "টাকার অঙ্ক দাও"),
    note: z.string().trim().max(200).nullish().transform((value) => value || null),
  }).parse(input);
  await prisma.$transaction(async (tx) => {
    const { balanceBdt } = await affiliateBalance(affiliateId, tx);
    if (amountBdt > balanceBdt) throw userError(`পাওনা মাত্র ৳${balanceBdt} — এর বেশি দেওয়া যাবে না।`);
    await tx.affiliatePayout.create({ data: { affiliateId, amountBdt, note, paidBy: me.email } });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/admin/affiliates");
}

/** Voids a commission (a refund, abuse); it no longer counts toward what is owed. */
export async function voidAffiliateCommission(id: string) {
  const me = await requireBilling();
  const { count } = await prisma.affiliateCommission.updateMany({ where: { id: idSchema.parse(id), canceledAt: null }, data: { canceledAt: new Date(), canceledBy: me.email } });
  if (!count) throw userError("Commission পাওয়া যায়নি বা আগেই বাতিল।");
  revalidatePath("/admin/affiliates");
}
