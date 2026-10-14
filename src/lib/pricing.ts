/**
 * Plan prices (docs/subscription-plan.md). Pure, so the server, the Plans page and the tests all use
 * the same arithmetic — but only the server's result is ever charged.
 *
 *   one exam : System + AI tier + exam
 *   all exams: System + AI tier + (sum of exams − discount% of that sum)
 *   duration : × days/30 × (1 − duration discount%), rounded to the taka
 */

export type PricingCatalog = {
  systemPriceBdt: number;
  allTracksDiscountPct: number;
  tiers: Array<{ planType: "STUDENT" | "PROFESSIONAL"; name: string; priceBdt: number }>;
  /** Active exams only. */
  tracks: Array<{ id: string; name: string; priceBdt: number }>;
  durations: Array<{ id: string; days: number; label: string; discountPct: number }>;
};

/** What the customer picks; never a price. */
export type PlanChoice = { planType: "STUDENT" | "PROFESSIONAL"; track: string | "all"; durationId: string };

export type Quote = {
  planType: "STUDENT" | "PROFESSIONAL";
  tierName: string;
  allTracks: boolean;
  trackIds: string[];
  trackNames: string[];
  days: number;
  durationLabel: string;
  /** Per 30 days. */
  system: number;
  ai: number;
  /** Exams before the all-exams discount. */
  tracks: number;
  tracksDiscount: number;
  monthly: number;
  /** Money off for a longer duration (0 for 30 days without a discount). */
  durationDiscount: number;
  total: number;
};

const roundTaka = (value: number) => Math.round(value);

/** The price of one choice, or null when it isn't on sale (unknown tier, exam or duration). */
export function quote(catalog: PricingCatalog, choice: PlanChoice): Quote | null {
  const tier = catalog.tiers.find((item) => item.planType === choice.planType);
  const duration = catalog.durations.find((item) => item.id === choice.durationId);
  if (!tier || !duration) return null;
  const allTracks = choice.track === "all";
  const tracks = allTracks ? catalog.tracks : catalog.tracks.filter((item) => item.id === choice.track);
  if (!tracks.length) return null;

  const tracksSum = tracks.reduce((sum, item) => sum + item.priceBdt, 0);
  // The discount is off the exam part only, never off System or the AI.
  const tracksDiscount = allTracks ? roundTaka((tracksSum * catalog.allTracksDiscountPct) / 100) : 0;
  const monthly = catalog.systemPriceBdt + tier.priceBdt + tracksSum - tracksDiscount;
  const full = (monthly * duration.days) / 30;
  const total = roundTaka(full * (1 - duration.discountPct / 100));

  return {
    planType: tier.planType,
    tierName: tier.name,
    allTracks,
    trackIds: tracks.map((item) => item.id),
    trackNames: tracks.map((item) => item.name),
    days: duration.days,
    durationLabel: duration.label,
    system: catalog.systemPriceBdt,
    ai: tier.priceBdt,
    tracks: tracksSum,
    tracksDiscount,
    monthly,
    durationDiscount: roundTaka(full) - total,
    total,
  };
}

/** AI tokens a plan of this many days gives, from the tier's 30-day allowance. */
export const tokensForDays = (tokensPerMonth: number, days: number) => Math.round((tokensPerMonth * days) / 30);

/** A short name for receipts and the payment list: "BCS · Student AI · ১ মাস". */
export const quoteLabel = (q: Pick<Quote, "allTracks" | "trackNames" | "tierName" | "durationLabel">) =>
  `${q.allTracks ? "সব পরীক্ষা" : q.trackNames.join(", ")} · ${q.tierName} · ${q.durationLabel}`;

/** Limits used by the per-day AI quota. */
export type AiKind = "message" | "scan" | "suggestion";
export const aiKinds: AiKind[] = ["message", "scan", "suggestion"];
