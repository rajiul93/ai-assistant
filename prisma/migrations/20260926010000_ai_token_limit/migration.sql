-- AlterTable: new users get a 1M-token AI limit (IF NOT EXISTS: safe to re-run)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiTokenLimit" INTEGER DEFAULT 1000000;

-- People already using the app aren't limited until an admin sets one
UPDATE "User" SET "aiTokenLimit" = NULL;
