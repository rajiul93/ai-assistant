import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, KeyRound, ListChecks } from "lucide-react";
import { MathText } from "@/components/math-text";
import { PAPER_LETTERS as LETTERS } from "@/components/preliminary/paper-sheet";
import { PaperPdfButton } from "@/components/preliminary/print-paper";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dayjs";
import { getQuestionPaper } from "@/server/actions/preliminary";

/**
 * A set as a question paper: questions on one side, the answer key in a column beside them (under
 * them on phones). The key is left out while the set is in Testing.
 */
export default async function QuestionPaperPage(props: PageProps<"/preliminary/[id]/paper">) {
  const { id } = await props.params;
  await requireUser();
  const paper = await getQuestionPaper(id);
  if (!paper) notFound();
  const keyed = paper.status !== "TESTING";

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <Link href="/preliminary" className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"><ArrowLeft className="size-4" /> Preliminary</Link>
      <PaperPdfButton paper={{ title: paper.topicName, date: formatDate(paper.date), description: paper.description, questions: paper.questions }} />
    </div>

    <header className="rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5">
      <h1 className="text-xl font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]"><MathText text={paper.topicName} /></h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(paper.date)}</span>
        <span className="flex items-center gap-1"><ListChecks className="size-3.5" />{paper.questions.length}টি প্রশ্ন</span>
      </p>
      {paper.description ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{paper.description}</p> : null}
    </header>

    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <ol className="space-y-2.5 rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5">
        {paper.questions.map((question, index) => <li key={question.id} className="border-b border-zinc-100 pb-2.5 last:border-0 last:pb-0">
          <p className="text-[15px] font-medium leading-relaxed text-slate-900"><span className="mr-1.5 font-semibold tabular-nums text-slate-500">{index + 1}.</span><MathText text={question.text} book /></p>
          <ul className="mt-1.5 grid gap-x-4 gap-y-1 pl-5 text-sm text-slate-700 sm:grid-cols-2">
            {question.options.map((option, optionIndex) => <li key={optionIndex}><span className="mr-1 font-semibold text-slate-500">{LETTERS[optionIndex]})</span><MathText text={option} book /></li>)}
          </ul>
        </li>)}
      </ol>

      <aside className="h-fit rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] lg:sticky lg:top-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><KeyRound className="size-4 text-amber-600" /> Answer Key</h2>
        {keyed
          ? <p className="mt-2 font-mono text-sm leading-7 text-slate-800 [overflow-wrap:anywhere]">{paper.questions.map((question, index) => `${index + 1}:${LETTERS[question.correctIndex ?? 0]}`).join(", ")}</p>
          : <p className="mt-2 text-sm text-amber-800">Set-টা এখন Testing-এ, তাই answer key লুকানো। Doing বা Done-এ নিলে দেখা যাবে।</p>}
      </aside>
    </div>
  </div>;
}
