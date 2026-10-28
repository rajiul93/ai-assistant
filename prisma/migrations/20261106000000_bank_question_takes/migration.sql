-- How many times each user has sent a bank MCQ to their Preliminary (additive).
CREATE TABLE IF NOT EXISTS "BankQuestionTake" (
    "userId" TEXT NOT NULL,
    "bankQuestionId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankQuestionTake_pkey" PRIMARY KEY ("userId","bankQuestionId")
);

CREATE INDEX IF NOT EXISTS "BankQuestionTake_bankQuestionId_idx" ON "BankQuestionTake"("bankQuestionId");

DO $$ BEGIN
  ALTER TABLE "BankQuestionTake" ADD CONSTRAINT "BankQuestionTake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BankQuestionTake" ADD CONSTRAINT "BankQuestionTake_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
