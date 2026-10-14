import { notFound } from "next/navigation";
import { BankBreadcrumb, examBySlug, sectionFromParam } from "@/components/question-bank/bank-nav";
import { BankSetGrid } from "@/components/question-bank/bank-set-grid";
import { requireUser } from "@/lib/auth";
import { listBankSets } from "@/server/actions/question-bank";
import { canOpenExam } from "@/server/pricing";

/** Level 3: the sets (one per exam session) of a section, as cards. */
export default async function BankSectionPage(props: PageProps<"/question-bank/[exam]/[section]">) {
  const user = await requireUser();
  const params = await props.params;
  const exam = examBySlug(params.exam);
  if (!exam) notFound();
  const section = sectionFromParam(params.section);
  const sets = (await listBankSets(exam.id)).filter((set) => set.section === section);
  if (!sets.length) notFound();

  return <div className="mx-auto max-w-3xl space-y-4">
    <BankBreadcrumb trail={[{ label: "প্রশ্ন ব্যাংক", href: "/question-bank" }, { label: exam.label, href: `/question-bank/${exam.slug}` }, { label: section }]} />
    <h1 className="text-2xl font-semibold tracking-tight">{section}</h1>
    <BankSetGrid examSlug={exam.slug} sets={sets} locked={!(await canOpenExam(user, exam.id))} />
  </div>;
}
