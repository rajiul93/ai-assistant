import { redirect } from "next/navigation";

/** Old URL (v1): the exam's slug is now its category under বিগত বছরের প্রশ্ন. */
export default async function OldBankExamPage(props: PageProps<"/question-bank/[exam]">) {
  redirect(`/question-bank/previous/${encodeURIComponent((await props.params).exam)}`);
}
