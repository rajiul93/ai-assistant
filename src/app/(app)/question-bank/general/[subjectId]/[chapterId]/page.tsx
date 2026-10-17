import { notFound } from "next/navigation";
// Articles and solutions are shown in the read-only Quill view.
import "quill/dist/quill.snow.css";
import { BANK_HOME, BankBreadcrumb, GENERAL } from "@/components/question-bank/bank-nav";
import { ChapterView } from "@/components/question-bank/chapter-view";
import { requireUser } from "@/lib/auth";
import { getBankChapter } from "@/server/actions/question-bank-general";

/** One chapter: Article / MCQ / Short Question tabs. */
export default async function BankChapterPage(props: PageProps<"/question-bank/general/[subjectId]/[chapterId]">) {
  await requireUser();
  const [params, search] = await Promise.all([props.params, props.searchParams]);
  const chapter = await getBankChapter(params.chapterId);
  // The chapter's own subject decides the trail, whatever the URL said.
  if (!chapter || chapter.subject.id !== params.subjectId) notFound();
  const tab = search.tab === "mcq" || search.tab === "short" ? search.tab : "article";
  return <div className="space-y-4 pb-8">
    <header className="space-y-2">
      <BankBreadcrumb trail={[BANK_HOME, GENERAL, { label: chapter.subject.name, href: `/question-bank/general/${chapter.subject.id}` }, { label: chapter.name }]} />
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{chapter.name}</h1>
      {chapter.description ? <p className="max-w-3xl text-sm leading-relaxed text-zinc-600">{chapter.description}</p> : null}
    </header>
    <ChapterView key={chapter.id} chapter={chapter} initialTab={tab} />
  </div>;
}
