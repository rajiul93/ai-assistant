import { MathText } from "@/components/math-text";

/** The paper's own letters, as the answer key reads them ("1:A, 2:C"). */
export const PAPER_LETTERS = ["A", "B", "C", "D", "E"];

export type PaperData = {
  title: string;
  /** Already formatted for display. */
  date: string;
  description?: string | null;
  /** `correctIndex` null = the key is hidden (the set is in Testing). */
  questions: Array<{ id: string; text: string; options: string[]; correctIndex: number | null }>;
};

export const answerKey = (questions: PaperData["questions"]) => questions.map((question, index) => `${index + 1}:${question.correctIndex === null ? "?" : PAPER_LETTERS[question.correctIndex]}`).join(", ");

/**
 * A question paper for printing / "Save as PDF": the title block, then the questions with their
 * options beside a narrow answer-key column. Plain black on white so it prints cleanly.
 */
export function PaperSheet({ paper }: { paper: PaperData }) {
  const keyed = paper.questions.every((question) => question.correctIndex !== null);
  return <div className="text-[11pt] leading-snug text-black">
    <header className="border-b border-black pb-2 text-center">
      <h1 className="text-[16pt] font-bold"><MathText text={paper.title} /></h1>
      <p className="mt-0.5 text-[10pt]">{paper.date} · মোট প্রশ্ন {paper.questions.length}টি</p>
      {paper.description ? <p className="mt-1 whitespace-pre-line text-[10pt]">{paper.description}</p> : null}
    </header>
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_42mm] gap-4">
      <ol className="space-y-2.5">
        {paper.questions.map((question, index) => <li key={question.id} className="break-inside-avoid">
          <p className="font-medium"><span className="mr-1 font-semibold tabular-nums">{index + 1}.</span><MathText text={question.text} book /></p>
          <ul className="mt-0.5 grid grid-cols-2 gap-x-4 pl-4 text-[10.5pt]">
            {question.options.map((option, optionIndex) => <li key={optionIndex}><span className="mr-1 font-semibold">{PAPER_LETTERS[optionIndex]})</span><MathText text={option} book /></li>)}
          </ul>
        </li>)}
      </ol>
      <aside className="border-l border-black pl-3">
        <h2 className="text-[11pt] font-bold">Answer Key</h2>
        {keyed ? <p className="mt-1 font-mono text-[10pt] leading-relaxed [overflow-wrap:anywhere]">{answerKey(paper.questions)}</p>
          : <p className="mt-1 text-[10pt]">Testing চলছে — answer key লুকানো।</p>}
      </aside>
    </div>
  </div>;
}
