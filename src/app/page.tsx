import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage, type LandingPlan } from "@/components/landing/landing-page";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Prep — পড়াশোনা ও চাকরির প্রস্তুতি, AI দিয়ে",
  description: "ছবি/PDF থেকে form পূরণ, voice দিয়ে task ও AI-এর সাথে কথা, study timer, notes আর subjects — সব এক জায়গায়। Manual সব কিছু free।",
};

/** Plans on sale, cheapest first; the page still shows without them if the database is unreachable. */
async function plansOnSale(): Promise<LandingPlan[]> {
  try {
    return await prisma.planPackage.findMany({
      where: { active: true },
      orderBy: [{ priceBdt: "asc" }],
      select: { name: true, planType: true, priceBdt: true, durationDays: true },
    });
  } catch {
    return [];
  }
}

/** The public landing page. Signed-in users go straight to their dashboard (the proxy does this first). */
export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <LandingPage plans={await plansOnSale()} />;
}
