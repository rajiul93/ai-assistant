import { notFound } from "next/navigation";
import { ExamView, StudyView } from "@/components/preliminary/question-set-views";
import { requireUser } from "@/lib/auth";
import { getQuestionSet } from "@/server/actions/preliminary";

/** Testing opens the exam (answers never sent); every other status opens the study view with answers. */
export default async function QuestionSetPage(props: PageProps<"/preliminary/[id]">) {
  const { id } = await props.params;
  await requireUser();
  const set = await getQuestionSet(id);
  if (!set) notFound();
  return set.status === "TESTING" ? <ExamView set={set} /> : <StudyView set={set} />;
}
