import { notFound } from "next/navigation";
// Solutions are shown in the read-only Quill view (BookText).
import "quill/dist/quill.snow.css";
import { BANK_HOME, BankBreadcrumb, PREVIOUS } from "@/components/question-bank/bank-nav";
import { BankQuestionList } from "@/components/question-bank/bank-question-list";
import { SendToPreliminary } from "@/components/question-bank/send-button";
import { UnlockSet } from "@/components/question-bank/unlock-set";
import { requireUser } from "@/lib/auth";
import { getBankSet } from "@/server/actions/question-bank";

/** One past-year set — every question with its answer, solution and explanation; staff edit here. */
export default async function BankSetPage(props: PageProps<"/question-bank/previous/[slug]/[setId]">) {
  await requireUser();
  const set = await getBankSet((await props.params).setId);
  if (!set) notFound();
  const hidden = set.total - set.questions.length;

  return <div className="space-y-4 pb-24">
    <header className="space-y-2">
      <BankBreadcrumb trail={[BANK_HOME, PREVIOUS, { label: set.category.name, href: `/question-bank/previous/${set.category.slug}` }, { label: set.name }]} />
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{set.name}</h1>
      <p className="text-sm text-zinc-500">{set.total}টি প্রশ্ন{set.year ? ` · ${set.year}` : ""}{set.free ? " · Free" : ""} · পড়া আর exam-এর জন্য Preliminary-তে পাঠাও।</p>
    </header>

    <BankQuestionList questions={set.questions} canEdit={set.canEdit} moveToChapter={set.canEdit} />

    {hidden > 0 ? <UnlockSet setId={set.id} used={set.unlocks.used} limit={set.unlocks.limit} hidden={hidden} /> : null}

    {/* Sending stays in reach while scrolling through the questions. */}
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="container mx-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <p className="hidden text-xs text-zinc-500 sm:block">প্রশ্ন ব্যাংক থেকে একসাথে ২টা set — test-এ 60% পেলে বা মুছে দিলে পরেরটা</p>
        <SendToPreliminary setId={set.id} copyId={set.copyId} locked={!set.premium || !set.canSend} className="w-full sm:w-auto" />
      </div>
    </div>
  </div>;
}
