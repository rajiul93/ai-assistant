import { redirect } from "next/navigation";

/** Old URL (v1): sections are gone; the category lists its sets by year. */
export default async function OldBankSectionPage(props: PageProps<"/question-bank/[exam]/[section]">) {
  redirect(`/question-bank/previous/${encodeURIComponent((await props.params).exam)}`);
}
