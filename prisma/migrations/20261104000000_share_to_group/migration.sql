-- A share sent to a whole group remembers the group (additive, nullable).
ALTER TABLE "ShareRequest" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

DO $$ BEGIN
  ALTER TABLE "ShareRequest" ADD CONSTRAINT "ShareRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
