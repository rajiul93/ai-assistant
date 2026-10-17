import { Prisma, type AffiliateSettings } from "@prisma/client";
import { commissionFor, makeCode, normalizeCode, parseRefCookie, withinWindow } from "@/lib/affiliate";
import { prisma } from "@/lib/prisma";

/**
 * The affiliate program on the server (docs/affiliate-plan.md). Server-only: these take user ids,
 * so never export them from a "use server" file.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** The program's rules (one row; created with the defaults — off — when missing). */
export async function loadAffiliateSettings(db: Db = prisma): Promise<AffiliateSettings> {
  return (await db.affiliateSettings.findUnique({ where: { id: "default" } }))
    ?? db.affiliateSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}

/** Whether this user may earn: the program is on, and it's open to everyone or an admin chose them. Blocked users never earn. */
export function canEarn(settings: AffiliateSettings, user: { affiliateActive: boolean; status: string }) {
  return settings.enabled && user.status !== "BLOCKED" && (settings.openToAll || user.affiliateActive);
}

/** The user's affiliate code, made on first need (a few tries in case two codes clash). */
export async function ensureAffiliateCode(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { affiliateCode: true } });
  if (user?.affiliateCode) return user.affiliateCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode(Math.random, attempt < 3 ? 6 : 8);
    try {
      // Only fills an empty code, so two tabs at once keep the first.
      await prisma.user.updateMany({ where: { id: userId, affiliateCode: null }, data: { affiliateCode: code } });
      const saved = await prisma.user.findUnique({ where: { id: userId }, select: { affiliateCode: true } });
      if (saved?.affiliateCode) return saved.affiliateCode;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  throw new Error("Affiliate code could not be made.");
}

/** A visit through a link (the route guard reports it once per browser per code). */
export async function recordAffiliateClick(rawCode: string) {
  const code = normalizeCode(rawCode);
  if (!code) return;
  const [settings, affiliate] = await Promise.all([
    loadAffiliateSettings(),
    prisma.user.findUnique({ where: { affiliateCode: code }, select: { id: true, affiliateActive: true, status: true } }),
  ]);
  if (affiliate && canEarn(settings, affiliate)) await prisma.affiliateClick.create({ data: { affiliateId: affiliate.id } });
}

/**
 * Ties a user to the affiliate whose link they opened (the `prep_ref` cookie), when they sign in or
 * buy. Only within the admin's window, never to oneself, only once (the first affiliate keeps
 * them), and only before their first approved purchase — someone who already bought wasn't brought
 * by the link.
 */
export async function claimReferral(userId: string, cookieValue: string | undefined) {
  const ref = parseRefCookie(cookieValue);
  if (!ref) return;
  const settings = await loadAffiliateSettings();
  if (!settings.enabled || !withinWindow(ref.at, Date.now(), settings.windowDays)) return;
  const [affiliate, user] = await Promise.all([
    prisma.user.findUnique({ where: { affiliateCode: ref.code }, select: { id: true, affiliateActive: true, status: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { referredById: true, payments: { where: { status: "APPROVED" }, select: { id: true }, take: 1 } } }),
  ]);
  if (!affiliate || !user || affiliate.id === userId || user.referredById || user.payments.length || !canEarn(settings, affiliate)) return;
  await prisma.user.updateMany({ where: { id: userId, referredById: null }, data: { referredById: affiliate.id, referredAt: new Date() } });
}

/**
 * Inside payment approval (billing `approvePayment`): the commission for the affiliate who brought
 * this customer, worked out from what the customer actually paid. Only the first approved purchase
 * earns unless the admin turned on "every purchase". One commission per payment (unique paymentId).
 */
export async function addCommissionForPayment(tx: Prisma.TransactionClient, payment: { id: string; userId: string; amountBdt: number }) {
  const customer = await tx.user.findUnique({ where: { id: payment.userId }, select: { referredById: true } });
  if (!customer?.referredById) return;
  const settings = await loadAffiliateSettings(tx);
  const affiliate = await tx.user.findUnique({ where: { id: customer.referredById }, select: { id: true, affiliateActive: true, status: true } });
  if (!affiliate || !canEarn(settings, affiliate)) return;
  if (!settings.recurring) {
    const earlier = await tx.payment.count({ where: { userId: payment.userId, status: "APPROVED", id: { not: payment.id } } });
    if (earlier) return;
  }
  const { amountBdt, rule } = commissionFor(settings, payment.amountBdt);
  if (amountBdt <= 0) return;
  await tx.affiliateCommission.create({ data: { affiliateId: affiliate.id, customerId: payment.userId, paymentId: payment.id, basisBdt: payment.amountBdt, rule, amountBdt } });
}

/**
 * What an affiliate has earned and what is left: earned (not voided) − cash paid out − credit used
 * on their own purchases (a rejected purchase gives its credit back, so only pending and approved
 * ones count).
 */
export async function affiliateBalance(affiliateId: string, db: Db = prisma) {
  const [earned, paid, used] = await Promise.all([
    db.affiliateCommission.aggregate({ where: { affiliateId, canceledAt: null }, _sum: { amountBdt: true } }),
    db.affiliatePayout.aggregate({ where: { affiliateId }, _sum: { amountBdt: true } }),
    db.payment.aggregate({ where: { userId: affiliateId, status: { not: "REJECTED" } }, _sum: { creditUsedBdt: true } }),
  ]);
  const earnedBdt = earned._sum.amountBdt ?? 0;
  const paidBdt = paid._sum.amountBdt ?? 0;
  const creditUsedBdt = used._sum.creditUsedBdt ?? 0;
  return { earnedBdt, paidBdt, creditUsedBdt, balanceBdt: Math.max(0, earnedBdt - paidBdt - creditUsedBdt) };
}

/** Credit an affiliate may take off a purchase now (credit payout mode only), at most the price. */
export async function creditFor(userId: string, priceBdt: number, db: Db = prisma) {
  const settings = await loadAffiliateSettings(db);
  if (!settings.enabled || settings.payoutMode !== "CREDIT") return 0;
  const { balanceBdt } = await affiliateBalance(userId, db);
  return Math.max(0, Math.min(balanceBdt, priceBdt));
}
