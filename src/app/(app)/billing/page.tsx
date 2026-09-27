import { BillingView } from "@/components/billing/billing-view";
import { getBillingOverview } from "@/server/actions/billing";

export default async function BillingPage() {
  const overview = await getBillingOverview();
  return <BillingView {...overview} />;
}
