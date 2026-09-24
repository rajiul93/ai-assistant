import { SubjectManager } from "@/components/subjects/subject-manager";
import { requireUser } from "@/lib/auth";
import { getSubjects } from "@/server/queries";

export default async function SubjectsPage() {
  const user = await requireUser();
  const subjects = await getSubjects(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subjects & topics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Organize preparation into subjects and nested topics.
        </p>
      </div>
      <SubjectManager subjects={subjects} />
    </div>
  );
}
