import { TaskBoard } from "@/components/tasks/task-board";
import { requireUser } from "@/lib/auth";
import { getFlatTopics, getRevisions, getSubjects, getTasks } from "@/server/queries";

export default async function TasksPage() {
  const user = await requireUser();
  const [tasks, subjects, topics, revisions] = await Promise.all([
    getTasks(user.id),
    getSubjects(user.id),
    getFlatTopics(user.id),
    getRevisions(user.id),
  ]);

  return (
    <TaskBoard
      initialTasks={tasks}
      subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
      topics={topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        subjectId: topic.subjectId,
        parentName: topic.parent?.name ?? null,
      }))}
      revisions={revisions}
      revisionTopics={topics.map((topic) => ({ id: topic.id, name: topic.name, subjectName: topic.subject.name }))}
    />
  );
}
