-- Admin controls over a user: block the account, pause the AI, cancel a subscription. Columns only.
DO $$ BEGIN CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "canceledBy" TEXT;
