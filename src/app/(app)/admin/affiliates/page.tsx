import { notFound } from "next/navigation";
import { AffiliateAdmin } from "@/components/affiliate/affiliate-admin";
import { requireUser } from "@/lib/auth";
import { getAffiliateAdmin } from "@/server/actions/affiliate";
import { can } from "@/server/roles";

export const metadata = { title: "Affiliates — Prep" };

/** The affiliate program's rules (super admin) and its affiliates, payouts and commissions (Billing permission). */
export default async function AffiliatesAdminPage() {
  const me = await requireUser();
  if (!(await can(me, "billing"))) notFound();
  return <AffiliateAdmin data={await getAffiliateAdmin()} />;
}
