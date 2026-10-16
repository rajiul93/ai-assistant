import { notFound } from "next/navigation";
import { FolderOpen, Library } from "lucide-react";
import { BankBreadcrumb, BankTile, examBySlug, sectionHref, tileGrid } from "@/components/question-bank/bank-nav";
import { requireUser } from "@/lib/auth";
import { listBankSets } from "@/server/actions/question-bank";

/** Level 2: one card per section ("বিগত সালের প্রশ্ন", …) of an exam. */
export default async function BankExamPage(props: PageProps<"/question-bank/[exam]">) {
  await requireUser();
  const exam = examBySlug((await props.params).exam);
  if (!exam) notFound();
  const sets = await listBankSets(exam.id);
  const sections = [...new Set(sets.map((set) => set.section))].map((section) => {
    const inside = sets.filter((set) => set.section === section);
    return { section, sets: inside.length, questions: inside.reduce((sum, set) => sum + set.questionCount, 0) };
  });

  return <div className="space-y-4">
    <BankBreadcrumb trail={[{ label: "প্রশ্ন ব্যাংক", href: "/question-bank" }, { label: exam.label }]} />
    <h1 className="text-2xl font-semibold tracking-tight">{exam.label}</h1>
    {sections.length ? <div className={tileGrid}>
      {sections.map((item) => <BankTile key={item.section} href={sectionHref(exam.slug, item.section)} icon={FolderOpen} tone="bg-amber-50 text-amber-700" title={item.section} detail={`${item.sets}টি set · ${item.questions}টি প্রশ্ন`} />)}
    </div> : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">
      <Library className="mx-auto mb-2 size-8 text-zinc-300" />এই পরীক্ষার প্রশ্ন এখনো যোগ হয়নি।
    </div>}
  </div>;
}
