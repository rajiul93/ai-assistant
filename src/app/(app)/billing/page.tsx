import { BillingView } from "@/components/billing/billing-view";
import { getBillingOverview } from "@/server/actions/billing";

const results = ["success", "pending", "failed", "cancelled"] as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const [overview, { payment }] = await Promise.all([getBillingOverview(), searchParams]);
  return <BillingView overview={overview} paymentResult={results.find((value) => value === payment)} />;
}
