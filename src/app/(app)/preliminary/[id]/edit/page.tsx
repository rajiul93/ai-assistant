import { notFound, redirect } from "next/navigation";
import { QuestionSetForm } from "@/components/preliminary/question-set-form";
import { requireUser } from "@/lib/auth";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import type { DraftQuestion } from "@/lib/preliminary";
import { getQuestionSet } from "@/server/actions/preliminary";
import { getSubjects } from "@/server/queries";

export default async function EditQuestionSetPage(props: PageProps<"/preliminary/[id]/edit">) {
  const { id } = await props.params;
  const user = await requireUser();
  const [set, subjects] = await Promise.all([getQuestionSet(id), getSubjects(user.id)]);
  if (!set) notFound();
  // Editing shows the answers, so a set being tested goes to its exam instead.
  if (set.status === "TESTING") redirect(`/preliminary/${id}`);
  return <QuestionSetForm
    subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
    initial={{
      id: set.id,
      subjectId: set.subjectId,
      date: dayjs(set.date).tz(APP_TIMEZONE).format("YYYY-MM-DD"),
      topicName: set.topicName,
      questions: set.questions.map((question) => ({ text: question.text, options: question.options as DraftQuestion["options"], correctIndex: question.correctIndex ?? -1 })),
    }}
  />;
}
