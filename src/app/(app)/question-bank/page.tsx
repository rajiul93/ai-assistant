import { BankBoard } from "@/components/question-bank/bank-board";
import { requireUser } from "@/lib/auth";
import { BANK_EXAMS } from "@/lib/question-bank";
import { listBankSets } from "@/server/actions/question-bank";

export const metadata = { title: "প্রশ্ন ব্যাংক — Prep" };

export default async function QuestionBankPage(props: PageProps<"/question-bank">) {
  await requireUser();
  const wanted = (await props.searchParams).exam;
  const exam = BANK_EXAMS.find((item) => item.slug === wanted) ?? BANK_EXAMS[0];
  return <BankBoard key={exam.slug} examSlug={exam.slug} sets={await listBankSets(exam.id)} />;
}
