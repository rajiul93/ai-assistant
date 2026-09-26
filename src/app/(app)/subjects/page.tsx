import { SubjectManager } from "@/components/subjects/subject-manager";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubjects } from "@/server/queries";

export default async function SubjectsPage() {
  const user = await requireUser();
  const [subjects, openByTopic] = await Promise.all([
    getSubjects(user.id),
    // Which topics already have an unfinished task, so the page can show them as added.
    prisma.task.groupBy({ by: ["topicId"], where: { userId: user.id, topicId: { not: null }, status: { not: "FINISHED" } }, _count: { _all: true } }),
  ]);
  const openTasks = Object.fromEntries(openByTopic.map((row) => [row.topicId as string, row._count._all]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subjects & topics</h1>
        <p className="mt-1 text-sm text-zinc-500">Organize preparation into subjects and topics. Tap “+ Task” to add a topic to your tasks.</p>
      </div>
      <SubjectManager subjects={subjects} openTasks={openTasks} />
    </div>
  );
}
