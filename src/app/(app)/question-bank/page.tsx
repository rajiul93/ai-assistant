import { GraduationCap, Landmark, School } from "lucide-react";
import { BankTile, tileGrid } from "@/components/question-bank/bank-nav";
import { requireUser } from "@/lib/auth";
import { BANK_EXAMS } from "@/lib/question-bank";
import { bankOverview } from "@/server/actions/question-bank";

export const metadata = { title: "প্রশ্ন ব্যাংক — Prep" };

const icons = { BCS: Landmark, PRIMARY: School, GRADE_11_20: GraduationCap };

/** Level 1: one card per exam. */
export default async function QuestionBankPage() {
  await requireUser();
  const counts = await bankOverview();
  return <div className="mx-auto max-w-3xl space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">প্রশ্ন ব্যাংক</h1>
      <p className="mt-1 text-sm text-zinc-500">বিগত সালের প্রশ্ন, set ধরে। পড়তে বা exam দিতে set-টা নিজের Preliminary-তে পাঠাও।</p>
    </div>
    <div className={tileGrid}>
      {BANK_EXAMS.map((exam) => {
        const count = counts[exam.id];
        return <BankTile key={exam.slug} href={`/question-bank/${exam.slug}`} icon={icons[exam.id]} title={exam.label} detail={count ? `${count.sets}টি set · ${count.questions}টি প্রশ্ন` : "এখনো যোগ হয়নি"} />;
      })}
    </div>
  </div>;
}
