import { describe, expect, it } from "vitest";
import { quote, quoteLabel, tokensForDays, type PricingCatalog } from "./pricing";

// The owner's example: four exams at ৳150, System ৳100, Student ৳200, Professional ৳600, 20% off.
const catalog: PricingCatalog = {
  systemPriceBdt: 100,
  allTracksDiscountPct: 20,
  tiers: [
    { planType: "STUDENT", name: "Student AI", priceBdt: 200 },
    { planType: "PROFESSIONAL", name: "Professional AI", priceBdt: 600 },
  ],
  tracks: [
    { id: "bcs", name: "BCS", priceBdt: 150 },
    { id: "primary", name: "BCS Primary", priceBdt: 150 },
    { id: "bank", name: "Bank Job", priceBdt: 150 },
    { id: "ntrca", name: "NTRCA", priceBdt: 150 },
  ],
  durations: [
    { id: "m1", days: 30, label: "১ মাস", discountPct: 0 },
    { id: "m3", days: 90, label: "৩ মাস", discountPct: 10 },
    { id: "d15", days: 15, label: "১৫ দিন", discountPct: 0 },
  ],
};

describe("quote", () => {
  it("prices one exam: System + AI + exam", () => {
    expect(quote(catalog, { planType: "STUDENT", track: "bcs", durationId: "m1" })?.total).toBe(450);
    expect(quote(catalog, { planType: "PROFESSIONAL", track: "ntrca", durationId: "m1" })?.total).toBe(850);
  });

  it("takes the all-exams discount off the exam part only", () => {
    const student = quote(catalog, { planType: "STUDENT", track: "all", durationId: "m1" })!;
    expect(student).toMatchObject({ tracks: 600, tracksDiscount: 120, monthly: 780, total: 780, allTracks: true, trackIds: ["bcs", "primary", "bank", "ntrca"] });
    expect(quote(catalog, { planType: "PROFESSIONAL", track: "all", durationId: "m1" })?.total).toBe(1180);
  });

  it("scales by days and applies the duration discount", () => {
    const three = quote(catalog, { planType: "STUDENT", track: "bcs", durationId: "m3" })!;
    expect(three).toMatchObject({ days: 90, total: 1215, durationDiscount: 135 });
    expect(quote(catalog, { planType: "STUDENT", track: "bcs", durationId: "d15" })?.total).toBe(225);
  });

  it("refuses what isn't on sale", () => {
    expect(quote(catalog, { planType: "STUDENT", track: "nope", durationId: "m1" })).toBeNull();
    expect(quote(catalog, { planType: "STUDENT", track: "bcs", durationId: "nope" })).toBeNull();
    expect(quote({ ...catalog, tiers: [] }, { planType: "STUDENT", track: "bcs", durationId: "m1" })).toBeNull();
    expect(quote({ ...catalog, tracks: [] }, { planType: "STUDENT", track: "all", durationId: "m1" })).toBeNull();
  });

  it("labels and token allowance", () => {
    expect(quoteLabel(quote(catalog, { planType: "STUDENT", track: "all", durationId: "m1" })!)).toBe("সব পরীক্ষা · Student AI · ১ মাস");
    expect(tokensForDays(300_000, 90)).toBe(900_000);
  });
});
