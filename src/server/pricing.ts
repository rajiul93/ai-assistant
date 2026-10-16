import { cache } from "react";
import type { BankExam, PlanType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { quote, type PlanChoice, type PricingCatalog, type Quote } from "@/lib/pricing";
import { isAdminUser } from "@/server/roles";
import { userError } from "@/lib/user-error";

/*
 * Server-only pricing and access helpers (docs/subscription-plan.md). Not a "use server" file: these
 * take a user id and must never be callable from the browser.
 */

/** Settings with the migration's defaults as a fallback, so a missing row never breaks a page. */
export async function loadSettings() {
  return (await prisma.pricingSettings.findUnique({ where: { id: "default" } })) ?? { id: "default", systemPriceBdt: 100, allTracksDiscountPct: 20, gatewayEnabled: false, updatedAt: new Date(0) };
}

/** What is on sale now: active tiers, exams and durations with the current settings. */
export async function loadCatalog(): Promise<PricingCatalog & { gatewayEnabled: boolean }> {
  const [settings, tiers, tracks, durations] = await Promise.all([
    loadSettings(),
    prisma.aiTier.findMany({ where: { active: true }, orderBy: { priceBdt: "asc" } }),
    prisma.examTrack.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.planDuration.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { days: "asc" }] }),
  ]);
  return {
    systemPriceBdt: settings.systemPriceBdt,
    allTracksDiscountPct: settings.allTracksDiscountPct,
    gatewayEnabled: settings.gatewayEnabled,
    tiers: tiers.map(({ planType, name, priceBdt }) => ({ planType, name, priceBdt })),
    tracks: tracks.map(({ id, name, priceBdt }) => ({ id, name, priceBdt })),
    durations: durations.map(({ id, days, label, discountPct }) => ({ id, days, label, discountPct })),
  };
}

/** Every price on the Plans page, computed here: each tier × duration × (each exam, and all). */
export function allQuotes(catalog: PricingCatalog) {
  const quotes: Array<Quote & { key: string; durationId: string; track: string }> = [];
  for (const tier of catalog.tiers) {
    for (const duration of catalog.durations) {
      for (const track of [...catalog.tracks.map((item) => item.id), "all"]) {
        const result = quote(catalog, { planType: tier.planType, track, durationId: duration.id });
        if (result) quotes.push({ ...result, key: `${tier.planType}:${track}:${duration.id}`, durationId: duration.id, track });
      }
    }
  }
  return quotes;
}

/** The server's price for what the customer picked, or an error they can act on. */
export async function priceChoice(choice: PlanChoice) {
  const catalog = await loadCatalog();
  const result = quote(catalog, choice);
  if (!result) throw userError("এই plan এখন বিক্রি হচ্ছে না। পাতাটা আবার খুলে বেছে নিন।");
  const tier = await prisma.aiTier.findUniqueOrThrow({ where: { planType: result.planType } });
  return { quote: result, tier, catalog };
}

/** Entitlements running right now, with the tier they were bought with. */
function runningEntitlements(userId: string) {
  const now = new Date();
  return prisma.entitlement.findMany({
    where: { userId, startsAt: { lte: now }, endsAt: { gt: now } },
    select: { allTracks: true, trackIds: true, endsAt: true, payment: { select: { planType: true, packageName: true } } },
    orderBy: { endsAt: "asc" },
  });
}

/** An old package purchase (before exams were sold separately): it opens every exam. */
const isLegacyScope = (row: { allTracks: boolean; trackIds: string[] }) => row.allTracks && row.trackIds.length === 0;

/**
 * Which exams' paid question-bank content the user may open: admins and old package purchases get
 * all; otherwise the exams of the subscriptions running now. Once per request.
 */
export const examAccess = cache(async (user: { id: string; email: string }): Promise<{ all: boolean; exams: Set<BankExam> }> => {
  if (await isAdminUser(user)) return { all: true, exams: new Set() };
  const running = await runningEntitlements(user.id);
  if (running.some(isLegacyScope)) return { all: true, exams: new Set() };
  const ids = [...new Set(running.flatMap((row) => row.trackIds))];
  const tracks = ids.length ? await prisma.examTrack.findMany({ where: { id: { in: ids }, bankExam: { not: null } }, select: { bankExam: true } }) : [];
  return { all: false, exams: new Set(tracks.map((track) => track.bankExam!)) };
});

export async function canOpenExam(user: { id: string; email: string }, exam: BankExam) {
  const access = await examAccess(user);
  return access.all || access.exams.has(exam);
}

/** The best AI tier among running subscriptions (Professional beats Student), or null. */
export async function runningTier(userId: string): Promise<PlanType | null> {
  const running = await runningEntitlements(userId);
  if (!running.length) return null;
  return running.some((row) => row.payment.planType === "PROFESSIONAL") ? "PROFESSIONAL" : "STUDENT";
}

/** The user's running subscriptions for the Plans page: what each covers and until when. */
export async function runningSubscriptions(userId: string) {
  const running = await runningEntitlements(userId);
  const ids = [...new Set(running.flatMap((row) => row.trackIds))];
  const names = new Map((ids.length ? await prisma.examTrack.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map((track) => [track.id, track.name]));
  return running.map((row) => ({
    planType: row.payment.planType,
    label: row.payment.packageName,
    endsAt: row.endsAt,
    exams: isLegacyScope(row) ? null : row.trackIds.map((id) => names.get(id) ?? "পুরনো পরীক্ষা"),
    allTracks: row.allTracks,
  }));
}
