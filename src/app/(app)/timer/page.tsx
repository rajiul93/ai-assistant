import { StudyTimer } from "@/components/timer/study-timer";
import { requireUser } from "@/lib/auth";
import { getFlatTopics, getSubjects } from "@/server/queries";

export default async function TimerPage() {
  const user = await requireUser();
  const [subjects, topics] = await Promise.all([
    getSubjects(user.id),
    getFlatTopics(user.id),
  ]);

  return (
    <StudyTimer
      subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
      topics={topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        subjectId: topic.subjectId,
      }))}
    />
  );
}
