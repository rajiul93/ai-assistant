import { ShortQuestionForm } from "@/components/short-questions/short-question-form";
import { requireUser } from "@/lib/auth";
import { getSubjects, getTopicNodes } from "@/server/queries";

export default async function NewShortQuestionSetPage() {
  const user = await requireUser();
  const [subjects, topics] = await Promise.all([getSubjects(user.id), getTopicNodes(user.id)]);
  return <ShortQuestionForm subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} topics={topics} />;
}
