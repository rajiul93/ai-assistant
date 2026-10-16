import { BANK_HOME, BankBreadcrumb, PREVIOUS } from "@/components/question-bank/bank-nav";
import { CategoryGrid } from "@/components/question-bank/bank-folders";
import { requireUser } from "@/lib/auth";
import { listBankCategories } from "@/server/actions/question-bank";

export const metadata = { title: "বিগত বছরের প্রশ্ন — প্রশ্ন ব্যাংক" };

/** বিগত বছরের প্রশ্ন: one card per exam/category. */
export default async function BankPreviousPage() {
  await requireUser();
  const { categories, canEdit } = await listBankCategories();
  return <div className="space-y-4">
    <BankBreadcrumb trail={[BANK_HOME, { label: PREVIOUS.label }]} />
    <h1 className="text-2xl font-semibold tracking-tight">বিগত বছরের প্রশ্ন</h1>
    <CategoryGrid categories={categories} canEdit={canEdit} />
  </div>;
}
