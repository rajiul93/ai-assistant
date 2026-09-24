import { RevisionManager } from "@/components/revisions/revision-manager";
import { requireUser } from "@/lib/auth";
import { getFlatTopics, getRevisions } from "@/server/queries";

export default async function RevisionsPage() {
  const user = await requireUser();
  const [revisions, topics] = await Promise.all([
    getRevisions(user.id),
    getFlatTopics(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revision</h1>
        <p className="mt-1 text-sm text-zinc-500">Schedule topic reviews and mark them complete.</p>
      </div>
      <RevisionManager
        revisions={revisions}
        topics={topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          subjectName: topic.subject.name,
        }))}
      />
    </div>
  );
}
