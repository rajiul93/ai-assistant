import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage, type LandingPricing } from "@/components/landing/landing-page";
import { getCurrentUser } from "@/lib/auth";
import { quote } from "@/lib/pricing";
import { loadCatalog } from "@/server/pricing";
import { gatewayConfigured } from "@/server/sslcommerz";

export const metadata: Metadata = {
  title: "Prep — পড়াশোনা ও চাকরির প্রস্তুতি, AI দিয়ে",
  description: "BCS, প্রাইমারি ও ১১–২০ গ্রেডের প্রস্তুতি এক অ্যাপে: প্রশ্ন ব্যাংক, MCQ ও শর্ট প্রশ্নের পরীক্ষা, task ও study timer, নোট, ভিডিও ক্লাস, বন্ধুদের সাথে গ্রুপ। বেশিরভাগই free।",
};

/** A month's prices for each exam and for all of them; the page still shows without them if the database is unreachable. */
async function monthlyPricing(): Promise<LandingPricing | null> {
  try {
    const catalog = await loadCatalog();
    const month = catalog.durations.find((item) => item.days === 30) ?? catalog.durations[0];
    if (!month || !catalog.tiers.length || !catalog.tracks.length) return null;
    const rows = [...catalog.tracks.map((track) => ({ id: track.id, name: track.name })), { id: "all", name: "সব পরীক্ষা" }].map((row) => ({
      name: row.name,
      all: row.id === "all",
      prices: catalog.tiers.map((tier) => quote(catalog, { planType: tier.planType, track: row.id, durationId: month.id })?.total ?? 0),
    }));
    return { durationLabel: month.label, discountPct: catalog.allTracksDiscountPct, tiers: catalog.tiers.map((tier) => tier.name), rows, from: Math.min(...rows.flatMap((row) => row.prices)), online: catalog.gatewayEnabled && gatewayConfigured() };
  } catch {
    return null;
  }
}

/** The public landing page. Signed-in users go straight to their dashboard (the proxy does this first). */
export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <LandingPage pricing={await monthlyPricing()} />;
}
