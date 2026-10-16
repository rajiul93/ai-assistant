import { redirect } from "next/navigation";

/** Old URL (v1) of one set. */
export default async function OldBankSetPage(props: PageProps<"/question-bank/[exam]/[section]/[setId]">) {
  const { exam, setId } = await props.params;
  redirect(`/question-bank/previous/${encodeURIComponent(exam)}/${encodeURIComponent(setId)}`);
}
