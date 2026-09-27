-- Notes get a subject/topic and can be attached to tasks. New columns and a new table only.
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "topicId" TEXT;
CREATE INDEX IF NOT EXISTS "Note_subjectId_idx" ON "Note"("subjectId");
CREATE INDEX IF NOT EXISTS "Note_topicId_idx" ON "Note"("topicId");
DO $$ BEGIN ALTER TABLE "Note" ADD CONSTRAINT "Note_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Note" ADD CONSTRAINT "Note_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TaskNote" (
    "taskId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("taskId","noteId")
);
CREATE INDEX IF NOT EXISTS "TaskNote_noteId_idx" ON "TaskNote"("noteId");
DO $$ BEGIN ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
