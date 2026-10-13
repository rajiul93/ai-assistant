import { notFound } from "next/navigation";
import { Check } from "lucide-react";
// Solutions are shown in the read-only Quill view (BookText).
import "quill/dist/quill.snow.css";
import { MathText } from "@/components/math-text";
import { SolutionNotes } from "@/components/preliminary/question-set-views";
import { BankBreadcrumb, examBySlug, sectionHref } from "@/components/question-bank/bank-nav";
import { SendToPreliminary } from "@/components/question-bank/send-button";
import { requireUser } from "@/lib/auth";
import { BANK_OPTION_LETTERS } from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import { getBankSet } from "@/server/actions/question-bank";

/** Level 4: one bank set, read-only — every question with its answer, solution and explanation. */
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

    <ol className="space-y-3">
      {set.questions.map((question, index) => <li key={question.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={question.text} book /></p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const right = question.correctIndex === optionIndex;
            return <li key={optionIndex} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", right ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-900" : "border-zinc-200")}>
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", right ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600")}>{right ? <Check className="size-3.5" strokeWidth={3} /> : BANK_OPTION_LETTERS[optionIndex]}</span>
              <MathText text={option} book />
            </li>;
          })}
        </ul>
        <SolutionNotes solution={question.solution} explanation={question.explanation} />
      </li>)}
    </ol>

    {/* Sending stays in reach while scrolling through the questions. */}
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="mx-auto flex max-w-3xl justify-end"><SendToPreliminary setId={set.id} copyId={set.copyId} className="w-full sm:w-auto" /></div>
    </div>
  </div>;
}
