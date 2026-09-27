"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/server/roles";
import { approvePayment, getPlanStatus, listActivePackages, listPaymentAccounts, rejectPayment } from "@/server/billing";

function revalidateBilling() {
  revalidatePath("/", "layout");
}

async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdminUser(user))) throw new Error("Only admins can do this.");
  return user;
}

/** Everything the plan picker needs, from the database: packages and prices, where to pay, and the user's plan. */
export async function getBillingOverview() {
  const user = await requireUser();
  const [packages, accounts, plan, payments] = await Promise.all([
    listActivePackages(),
    listPaymentAccounts(),
    getPlanStatus(user.id),
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { packages, accounts, plan, payments };
}

const paymentSchema = z.object({
  packageId: z.string().min(1),
  method: z.enum(["BKASH", "NAGAD"]),
  // Bangladeshi mobile number: 01XXXXXXXXX (spaces, dashes and +88 are ignored).
  senderNumber: z.string().transform((value) => value.replace(/[\s-]/g, "").replace(/^\+?88/, "")).refine((value) => /^01[3-9]\d{8}$/.test(value), "Enter the 11-digit number you sent money from, e.g. 017XXXXXXXX."),
  transactionId: z.string().trim().toUpperCase().refine((value) => /^[A-Z0-9]{6,20}$/.test(value), "Enter the Transaction ID from the payment SMS (letters and numbers)."),
  source: z.enum(["page", "chat"]).default("page"),
});

/**
 * A user reports a Send Money payment. The package's current price, days and tokens are copied
 * into the payment now, so a later price change never alters it. An admin then approves it.
 */
export async function submitPayment(input: unknown) {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Please check the payment details.");
  const data = parsed.data;
  const [pkg, account] = await Promise.all([
    prisma.planPackage.findFirst({ where: { id: data.packageId, active: true } }),
    prisma.paymentAccount.findFirst({ where: { method: data.method, enabled: true } }),
  ]);
  if (!pkg) throw new Error("That package isn't available any more. Please choose again.");
  if (!account) throw new Error("That payment method isn't available right now.");
  try {
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        packageId: pkg.id,
        planType: pkg.planType,
        packageName: pkg.name,
        durationDays: pkg.durationDays,
        tokens: pkg.tokens,
        amountBdt: pkg.priceBdt,
        method: data.method,
        senderNumber: data.senderNumber,
        transactionId: data.transactionId,
        source: data.source,
      },
    });
    revalidateBilling();
    return { id: payment.id, amountBdt: payment.amountBdt };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("This Transaction ID has already been submitted.");
    }
    throw error;
  }
}

// ---------- Admin ----------

/** One page of payments, pending ones first; `pending` is the total waiting across all pages. */
export async function listPaymentsForAdmin({ page, limit }: { page: number; limit: number }) {
  await requireAdmin();
  const [total, pending] = await Promise.all([prisma.payment.count(), prisma.payment.count({ where: { status: "PENDING" } })]);
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(Math.max(1, page), lastPage);
  const rows = await prisma.payment.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    skip: (current - 1) * limit,
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
  return { rows, total, pending, page: current };
}

export async function reviewPayment(input: unknown) {
  const admin = await requireAdmin();
  const { paymentId, approve, note } = z.object({ paymentId: z.string().min(1), approve: z.boolean(), note: z.string().trim().max(300).optional() }).parse(input);
  if (approve) await approvePayment(paymentId, admin.email, note);
  else await rejectPayment(paymentId, admin.email, note);
  revalidateBilling();
}

const packageSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  priceBdt: z.coerce.number().int().min(1, "Price must be at least ৳1").max(1_000_000),
  durationDays: z.coerce.number().int().min(1).max(3650),
  tokens: z.coerce.number().int().min(1_000).max(1_000_000_000),
  active: z.boolean(),
});

/** New prices apply to new payments only; payments already submitted keep the price they had. */
export async function updatePackage(input: unknown) {
  await requireAdmin();
  const { id, ...data } = packageSchema.parse(input);
  await prisma.planPackage.update({ where: { id }, data });
  revalidateBilling();
}

export async function savePaymentAccount(input: unknown) {
  await requireAdmin();
  const data = z.object({
    method: z.enum(["BKASH", "NAGAD"]),
    number: z.string().transform((value) => value.replace(/[\s-]/g, "")).refine((value) => /^(\+?88)?01[3-9]\d{8}$/.test(value), "Enter a valid 11-digit mobile number."),
    accountType: z.string().trim().min(1).max(30),
    enabled: z.boolean(),
  }).parse(input);
  await prisma.paymentAccount.upsert({ where: { method: data.method }, update: data, create: data });
  revalidateBilling();
}
