import { notFound } from "next/navigation";
import { AdminBilling } from "@/components/admin/admin-billing";
import { requireUser } from "@/lib/auth";
import { readPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { listPaymentsForAdmin } from "@/server/actions/billing";
import { getPricingAdmin } from "@/server/actions/pricing";
import { can, roleOf } from "@/server/roles";
import { gatewayConfigured } from "@/server/sslcommerz";

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!(await can(user, "billing"))) notFound();
  // Page and page size come from the URL, so a reload keeps them.
  const params = await searchParams;
  const { page, limit } = readPagination(params);
  const statusParam = typeof params.status === "string" ? params.status.toUpperCase() : "";
  // Pending is the default view: what needs an admin now.
  const status = (["ALL", "APPROVED", "REJECTED"] as const).find((value) => value === statusParam) ?? "PENDING";
  const superAdmin = (await roleOf(user)) === "SUPER_ADMIN";
  const [payments, pricing, accounts] = await Promise.all([
    listPaymentsForAdmin({ page, limit, status }),
    superAdmin ? getPricingAdmin() : null,
    prisma.paymentAccount.findMany(),
  ]);
  return <AdminBilling payments={payments.rows} status={status} pendingCount={payments.pending} page={payments.page} limit={limit} total={payments.total} pricing={pricing} gatewayConfigured={gatewayConfigured()} accounts={accounts} />;
}
