-- CreateEnum (skipped if it already exists: safe to re-run)
DO $$ BEGIN
  CREATE TYPE "AiAccess" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: new users start without AI access
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiAccess" "AiAccess" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "aiRequestedAt" TIMESTAMP(3);

-- People already using the app keep the AI they had
UPDATE "User" SET "aiAccess" = 'APPROVED';
