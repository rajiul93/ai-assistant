import { notFound } from "next/navigation";
import { AdminBilling } from "@/components/admin/admin-billing";
import { requireUser } from "@/lib/auth";
import { readPagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { listPaymentsForAdmin } from "@/server/actions/billing";
import { isAdminUser } from "@/server/roles";

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!(await isAdminUser(user))) notFound();
  // Page and page size come from the URL, so a reload keeps them.
  const { page, limit } = readPagination(await searchParams);
  const [payments, packages, accounts] = await Promise.all([
    listPaymentsForAdmin({ page, limit }),
    prisma.planPackage.findMany({ orderBy: [{ planType: "asc" }, { sortOrder: "asc" }] }),
    prisma.paymentAccount.findMany(),
  ]);
  return <AdminBilling payments={payments.rows} pendingCount={payments.pending} page={payments.page} limit={limit} total={payments.total} packages={packages} accounts={accounts} />;
}
