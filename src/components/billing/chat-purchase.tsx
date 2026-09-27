"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PlanPurchase } from "@/components/billing/plan-purchase";
import { getBillingOverview } from "@/server/actions/billing";

/** The plan purchase flow inside the chat, with the same live prices and payment numbers as the Plans page. */
export function ChatPurchase() {
  const overview = useQuery({ queryKey: ["billing-overview"], queryFn: () => getBillingOverview(), staleTime: 30_000 });
  if (overview.isPending) return <p className="flex items-center gap-2 py-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> Plans আনছি…</p>;
  if (overview.isError || !overview.data) return <p className="py-2 text-sm text-red-600">Plans আনা গেল না। Plans পাতা থেকে চেষ্টা করো।</p>;
  return <PlanPurchase packages={overview.data.packages} accounts={overview.data.accounts} source="chat" onSubmitted={() => void overview.refetch()} />;
}
