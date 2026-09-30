import { QuestionSetForm } from "@/components/preliminary/question-set-form";
import { requireUser } from "@/lib/auth";
import { getSubjects } from "@/server/queries";

export default async function NewQuestionSetPage() {
  const user = await requireUser();
  const subjects = await getSubjects(user.id);
  return <QuestionSetForm subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} />;
}
