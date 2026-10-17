import { AffiliateView } from "@/components/affiliate/affiliate-view";
import { requireUser } from "@/lib/auth";
import { getMyAffiliate } from "@/server/actions/affiliate";

export const metadata = { title: "Affiliate — Prep" };

/** The affiliate's link to share anywhere, what it brought, and what they are owed (docs/affiliate-plan.md). */
export default async function AffiliatePage() {
  await requireUser();
  return <AffiliateView data={await getMyAffiliate()} />;
}
