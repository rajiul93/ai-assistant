import { Suspense } from "react";
import { NotesWorkspace } from "@/components/notes/notes-workspace";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NotesPage() {
  const user = await requireUser();
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, plainText: true, updatedAt: true },
  });
  return (
    <Suspense>
      <NotesWorkspace initialNotes={notes.map((note) => ({ ...note, plainText: note.plainText.slice(0, 400) }))} />
    </Suspense>
  );
}
