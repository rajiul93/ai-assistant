-- AlterTable: a manual order for subjects and topics (drag and drop on the Subjects page)
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

-- Start from today's alphabetical order, so nothing moves until the user drags it
UPDATE "Subject" AS s SET "position" = r.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY name) - 1 AS rn FROM "Subject") AS r
WHERE s.id = r.id;

UPDATE "Topic" AS t SET "position" = r.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY "subjectId", "parentId" ORDER BY name) - 1 AS rn FROM "Topic") AS r
WHERE t.id = r.id;
