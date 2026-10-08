import { notFound } from "next/navigation";
import { ShortExamView, ShortStudyView } from "@/components/short-questions/short-question-views";
import { requireUser } from "@/lib/auth";
import { getShortQuestionSet } from "@/server/actions/short-questions";

/** Testing opens the exam (answers never sent); every other status opens the study view with answers. */
export default async function ShortQuestionSetPage(props: PageProps<"/short-questions/[id]">) {
  const { id } = await props.params;
  await requireUser();
  const set = await getShortQuestionSet(id);
  if (!set) notFound();
  return set.status === "TESTING" ? <ShortExamView set={set} /> : <ShortStudyView set={set} />;
}
