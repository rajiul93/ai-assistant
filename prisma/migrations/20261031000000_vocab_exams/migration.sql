-- Vocabulary exams and sets of 50 (src/lib/vocabulary/exam.ts). Additive; safe to run twice.
-- Words already learned all start in set 1.

DO $$ BEGIN
  CREATE TYPE "VocabExamType" AS ENUM ('FORMS', 'MEANING', 'SPELLING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "VocabLearned" ADD COLUMN IF NOT EXISTS "batch" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "VocabLearned" ADD COLUMN IF NOT EXISTS "missedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "VocabExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batch" INTEGER NOT NULL,
    "type" "VocabExamType" NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabExam_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VocabExam_userId_batch_idx" ON "VocabExam"("userId", "batch");

DO $$ BEGIN
  ALTER TABLE "VocabExam" ADD CONSTRAINT "VocabExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
