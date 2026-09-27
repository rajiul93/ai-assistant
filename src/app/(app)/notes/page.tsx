import { Suspense } from "react";
import { NotesWorkspace } from "@/components/notes/notes-workspace";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFlatTopics, getSubjects, noteSummarySelect } from "@/server/queries";

export default async function NotesPage() {
  const user = await requireUser();
  const [notes, subjects, topics] = await Promise.all([
    prisma.note.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: noteSummarySelect }),
    getSubjects(user.id),
    getFlatTopics(user.id),
  ]);
  return (
    <Suspense>
      <NotesWorkspace
        initialNotes={notes.map((note) => ({ ...note, plainText: note.plainText.slice(0, 400) }))}
        subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
        topics={topics.map((topic) => ({ id: topic.id, name: topic.name, subjectId: topic.subjectId, parentName: topic.parent?.name ?? null }))}
      />
    </Suspense>
  );
}
