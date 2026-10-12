import { QuestionSetForm } from "@/components/preliminary/question-set-form";
import { requireUser } from "@/lib/auth";
import { getSubjects, getTopicNodes } from "@/server/queries";

export default async function NewQuestionSetPage() {
  const user = await requireUser();
  const [subjects, topics] = await Promise.all([getSubjects(user.id), getTopicNodes(user.id)]);
  return <QuestionSetForm subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} topics={topics} />;
}
