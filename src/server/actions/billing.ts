"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/server/roles";
import { headers } from "next/headers";
import { normalizeBdPhone } from "@/lib/phone";
import { quoteLabel, tokensForDays } from "@/lib/pricing";
import { aiToday } from "@/server/ai-access";
import { approvePayment, getPlanStatus, listPaymentAccounts, rejectPayment } from "@/server/billing";
import { allQuotes, loadCatalog, loadSettings, priceChoice, runningSubscriptions } from "@/server/pricing";
import { createSession, gatewayConfigured, newTransactionId } from "@/server/sslcommerz";

function revalidateBilling() {
  revalidatePath("/", "layout");
}

async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdminUser(user))) throw new Error("Only admins can do this.");
  return user;
}

/**
 * Everything the Plans page (and the purchase inside the chat) needs: every price — computed here,
 * never on the client — the tiers' daily AI limits, where to pay, and the user's own plans.
 */
export async function getBillingOverview() {
  const user = await requireUser();
  const [catalog, tiers, accounts, plan, payments, running, today, me] = await Promise.all([
    loadCatalog(),
    prisma.aiTier.findMany({ where: { active: true }, orderBy: { priceBdt: "asc" }, select: { planType: true, name: true, messagesPerDay: true, scansPerDay: true, suggestionsPerDay: true, tokensPerMonth: true } }),
    listPaymentAccounts(),
    getPlanStatus(user.id),
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, planType: true, packageName: true, amountBdt: true, method: true, transactionId: true, status: true, source: true, adminNote: true, createdAt: true } }),
    runningSubscriptions(user.id),
    aiToday(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } }),
  ]);
  return {
    catalog: { tiers: catalog.tiers, tracks: catalog.tracks, durations: catalog.durations, allTracksDiscountPct: catalog.allTracksDiscountPct, systemPriceBdt: catalog.systemPriceBdt },
    quotes: allQuotes(catalog),
    // Customers see AI use relative to the Student tier, never raw token counts.
    tiers: tiers.map(({ tokensPerMonth, ...tier }) => ({ ...tier, aiTimes: Math.round((tokensPerMonth / Math.max(1, Math.min(...tiers.map((item) => item.tokensPerMonth)))) * 10) / 10 })),
    accounts,
    gateway: catalog.gatewayEnabled && gatewayConfigured(),
    phone: me?.phone ?? null,
    plan,
    running,
    today,
    payments,
  };
}

const choiceSchema = z.object({
  planType: z.enum(["STUDENT", "PROFESSIONAL"]),
  track: z.string().min(1).max(64),
  durationId: z.string().min(1).max(64),
  source: z.enum(["page", "chat"]).default("page"),
});

const paymentSchema = choiceSchema.extend({
  method: z.enum(["BKASH", "NAGAD"]),
  // Bangladeshi mobile number: 01XXXXXXXXX (spaces, dashes and +88 are ignored).
  senderNumber: z.string().transform((value) => value.replace(/[\s-]/g, "").replace(/^\+?88/, "")).refine((value) => /^01[3-9]\d{8}$/.test(value), "যে নম্বর থেকে পাঠিয়েছেন সেটা ১১ সংখ্যায় দিন, যেমন 017XXXXXXXX।"),
  transactionId: z.string().trim().toUpperCase().refine((value) => /^[A-Z0-9]{6,20}$/.test(value), "Payment SMS-এর Transaction ID দিন (অক্ষর আর সংখ্যা)।"),
}).strict();

/** The payment row for a choice: the server's price and everything it buys, copied in now. */
async function paymentData(choice: z.infer<typeof choiceSchema>) {
  const { quote, tier } = await priceChoice(choice);
  return {
    planType: quote.planType,
    packageName: quoteLabel(quote),
    durationDays: quote.days,
    tokens: tokensForDays(tier.tokensPerMonth, quote.days),
    amountBdt: quote.total,
    trackIds: quote.trackIds,
    allTracks: quote.allTracks,
    breakdown: quote,
    source: choice.source,
  };
}

/**
 * A user reports a Send Money payment for the plan they picked. The client sends only the choice;
 * the price, days, AI allowance and exams are worked out here and kept on the payment, so a later
 * price change never alters it. An admin then approves it.
 */
export async function submitPayment(input: unknown) {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Payment-এর তথ্য দেখে আবার দিন।");
  const data = parsed.data;
  const account = await prisma.paymentAccount.findFirst({ where: { method: data.method, enabled: true } });
  if (!account) throw new Error("এই payment পদ্ধতি এখন বন্ধ আছে।");
  try {
    const payment = await prisma.payment.create({
      data: { userId: user.id, ...(await paymentData(data)), method: data.method, senderNumber: data.senderNumber, transactionId: data.transactionId },
    });
    revalidateBilling();
    return { id: payment.id, amountBdt: payment.amountBdt, label: payment.packageName };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("এই Transaction ID আগেই জমা দেওয়া হয়েছে।");
    }
    throw error;
  }
}

const onlineSchema = choiceSchema.extend({
  phone: z.string().transform((value) => normalizeBdPhone(value)).refine((value): value is string => Boolean(value), "আপনার মোবাইল নম্বর দিন, যেমন 017XXXXXXXX।"),
}).strict();

/**
 * Starts an online payment through SSLCommerz: a pending payment with our own transaction id, then
 * the gateway's page to send the customer to. It is approved only when SSLCommerz confirms it.
 */
export async function startOnlinePayment(input: unknown) {
  const user = await requireUser();
  const parsed = onlineSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "তথ্য দেখে আবার দিন।");
  const settings = await loadSettings();
  if (!settings.gatewayEnabled || !gatewayConfigured()) throw new Error("Online payment এখন বন্ধ আছে। bKash বা Nagad দিয়ে দিন।");
  const data = await paymentData(parsed.data);
  const tranId = newTransactionId();
  const payment = await prisma.payment.create({ data: { userId: user.id, ...data, method: "SSLCOMMERZ", senderNumber: parsed.data.phone, transactionId: tranId } });
  // Where SSLCommerz sends the customer and its notices back: APP_URL when set, else this request's host.
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host");
  const proto = head.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;
  try {
    const url = await createSession({ tranId, amount: payment.amountBdt, product: payment.packageName, customer: { name: user.name ?? "", email: user.email, phone: parsed.data.phone.replace(/^\+88/, "") }, appUrl });
    return { url };
  } catch (error) {
    await prisma.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "REJECTED", adminNote: "Gateway session খোলা যায়নি", reviewedAt: new Date(), reviewedBy: "sslcommerz" } });
    throw error;
  }
}

// ---------- Admin ----------

/** One page of payments, pending ones first; `pending` is the total waiting across all pages. */
export async function listPaymentsForAdmin({ page, limit, status = "PENDING" }: { page: number; limit: number; status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL" }) {
  await requireAdmin();
  const where = status === "ALL" ? {} : { status };
  const [total, pending] = await Promise.all([prisma.payment.count({ where }), prisma.payment.count({ where: { status: "PENDING" } })]);
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(Math.max(1, page), lastPage);
  const rows = await prisma.payment.findMany({
    where,
    // Pending: oldest first (first come, first served); otherwise newest first.
    orderBy: status === "PENDING" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ status: "asc" }, { createdAt: "desc" }, { id: "asc" }],
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
