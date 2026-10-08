import { notFound, redirect } from "next/navigation";
import { ShortQuestionForm } from "@/components/short-questions/short-question-form";
import { requireUser } from "@/lib/auth";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import { getShortQuestionSet } from "@/server/actions/short-questions";
import { getSubjects } from "@/server/queries";

export default async function EditShortQuestionSetPage(props: PageProps<"/short-questions/[id]/edit">) {
  const { id } = await props.params;
  const user = await requireUser();
  const [set, subjects] = await Promise.all([getShortQuestionSet(id), getSubjects(user.id)]);
  if (!set) notFound();
  // Editing shows the answers, so a set being tested goes to its exam instead.
  if (set.status === "TESTING") redirect(`/short-questions/${id}`);
  return <ShortQuestionForm
    subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
    initial={{
      id: set.id,
      subjectId: set.subjectId,
      date: dayjs(set.date).tz(APP_TIMEZONE).format("YYYY-MM-DD"),
      topicName: set.topicName,
      questions: set.questions.map((question) => ({ text: question.text, answer: question.answer ?? "" })),
    }}
  />;
}
