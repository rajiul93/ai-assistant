import { notFound } from "next/navigation";
// Solutions are shown in the read-only Quill view (BookText).
import "quill/dist/quill.snow.css";
import { BankBreadcrumb, examBySlug, sectionHref } from "@/components/question-bank/bank-nav";
import { BankQuestionList } from "@/components/question-bank/bank-question-list";
import { SendToPreliminary } from "@/components/question-bank/send-button";
import { requireUser } from "@/lib/auth";
import { getBankSet } from "@/server/actions/question-bank";

/** Level 4: one bank set — every question with its answer, solution and explanation; admins edit here. */
export default async function BankSetPage(props: PageProps<"/question-bank/[exam]/[section]/[setId]">) {
  await requireUser();
  const params = await props.params;
  const set = await getBankSet(params.setId);
  const exam = examBySlug(params.exam);
  // The set's own exam and section decide the trail, whatever the URL said.
  if (!set || !exam || exam.id !== set.exam) notFound();

  return <div className="mx-auto max-w-3xl space-y-4 pb-24">
    <header className="space-y-2">
      <BankBreadcrumb trail={[{ label: "প্রশ্ন ব্যাংক", href: "/question-bank" }, { label: exam.label, href: `/question-bank/${exam.slug}` }, { label: set.section, href: sectionHref(exam.slug, set.section) }, { label: set.name }]} />
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{set.name}</h1>
      <p className="text-sm text-zinc-500">{set.questions.length}টি প্রশ্ন · পড়া আর exam-এর জন্য Preliminary-তে পাঠাও।</p>
    </header>

    <BankQuestionList questions={set.questions} canEdit={set.canEdit} />

    {/* Sending stays in reach while scrolling through the questions. */}
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="mx-auto flex max-w-3xl justify-end"><SendToPreliminary setId={set.id} copyId={set.copyId} className="w-full sm:w-auto" /></div>
    </div>
  </div>;
}
