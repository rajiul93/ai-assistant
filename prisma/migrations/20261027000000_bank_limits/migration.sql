-- Question Bank limits (docs/question-bank-v2-plan.md, owner 2026-10-16): users without a plan open
-- any 3 past-year sets; sets sent from the bank count toward "two at a time until 60%".
-- Idempotent: safe to run again.

ALTER TABLE "QuestionSet" ADD COLUMN IF NOT EXISTS "fromBank" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShortQuestionSet" ADD COLUMN IF NOT EXISTS "fromBank" BOOLEAN NOT NULL DEFAULT false;
-- Copies of bank sets sent before this change are from the bank too.
UPDATE "QuestionSet" SET "fromBank" = true WHERE "bankSetId" IS NOT NULL AND "fromBank" = false;

CREATE TABLE IF NOT EXISTS "BankSetUnlock" (
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankSetUnlock_pkey" PRIMARY KEY ("userId","setId")
);
DO $$ BEGIN
  ALTER TABLE "BankSetUnlock" ADD CONSTRAINT "BankSetUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BankSetUnlock" ADD CONSTRAINT "BankSetUnlock_setId_fkey" FOREIGN KEY ("setId") REFERENCES "BankSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
