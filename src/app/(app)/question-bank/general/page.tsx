import { BANK_HOME, BankBreadcrumb, GENERAL } from "@/components/question-bank/bank-nav";
import { SubjectGrid } from "@/components/question-bank/bank-folders";
import { requireUser } from "@/lib/auth";
import { listBankSubjects } from "@/server/actions/question-bank-general";

export const metadata = { title: "General — প্রশ্ন ব্যাংক" };

/** General: one card per subject. */
export default async function BankGeneralPage() {
  await requireUser();
  const { subjects, canEdit } = await listBankSubjects();
  return <div className="space-y-4">
    <BankBreadcrumb trail={[BANK_HOME, { label: GENERAL.label }]} />
    <h1 className="text-2xl font-semibold tracking-tight">General</h1>
    <SubjectGrid subjects={subjects} canEdit={canEdit} />
  </div>;
}
