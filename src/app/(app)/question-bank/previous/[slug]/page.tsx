import { notFound } from "next/navigation";
import { BANK_HOME, BankBreadcrumb, PREVIOUS } from "@/components/question-bank/bank-nav";
import { BankYears } from "@/components/question-bank/bank-set-grid";
import { requireUser } from "@/lib/auth";
import { getBankCategory } from "@/server/actions/question-bank";

/** One category: its sets by year, newest first ("অন্যান্য" for sets without a year). */
export default async function BankCategoryPage(props: PageProps<"/question-bank/previous/[slug]">) {
  await requireUser();
  const category = await getBankCategory((await props.params).slug);
  if (!category) notFound();
  return <div className="space-y-4">
    <BankBreadcrumb trail={[BANK_HOME, PREVIOUS, { label: category.name }]} />
    <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
    <BankYears category={category} />
  </div>;
}
