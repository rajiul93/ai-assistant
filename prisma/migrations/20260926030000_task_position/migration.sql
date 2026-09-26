-- AlterTable: the user's own task order (drag and drop on the Tasks page)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

-- Start from the order the page showed before: due date first (undated last), newest first
UPDATE "Task" AS t SET "position" = r.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "dueDate" ASC NULLS LAST, "createdAt" DESC) - 1 AS rn FROM "Task") AS r
WHERE t.id = r.id;
