import { notFound } from "next/navigation";
import { BANK_HOME, BankBreadcrumb, GENERAL } from "@/components/question-bank/bank-nav";
import { ChapterGrid } from "@/components/question-bank/bank-folders";
import { requireUser } from "@/lib/auth";
import { getBankSubject } from "@/server/actions/question-bank-general";

/** One subject: its chapters. */
export default async function BankSubjectPage(props: PageProps<"/question-bank/general/[subjectId]">) {
  await requireUser();
  const subject = await getBankSubject((await props.params).subjectId);
  if (!subject) notFound();
  return <div className="space-y-4">
    <BankBreadcrumb trail={[BANK_HOME, GENERAL, { label: subject.name }]} />
    <h1 className="text-2xl font-semibold tracking-tight">{subject.name}</h1>
    <ChapterGrid subjectId={subject.id} chapters={subject.chapters} others={subject.others} canEdit={subject.canEdit} />
  </div>;
}
