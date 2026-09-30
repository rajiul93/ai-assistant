-- Preliminary: MCQ question sets (Todo → Doing → Testing → Done) and test results. New tables only.
DO $$ BEGIN CREATE TYPE "QuestionSetStatus" AS ENUM ('TODO', 'DOING', 'TESTING', 'DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "QuestionSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "topicName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "QuestionSetStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuestionSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestAttempt" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuestionSet_userId_status_idx" ON "QuestionSet"("userId", "status");
CREATE INDEX IF NOT EXISTS "QuestionSet_subjectId_idx" ON "QuestionSet"("subjectId");
CREATE INDEX IF NOT EXISTS "Question_setId_position_idx" ON "Question"("setId", "position");
CREATE INDEX IF NOT EXISTS "TestAttempt_setId_submittedAt_idx" ON "TestAttempt"("setId", "submittedAt");
CREATE INDEX IF NOT EXISTS "TestAttempt_userId_idx" ON "TestAttempt"("userId");

DO $$ BEGIN ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Question" ADD CONSTRAINT "Question_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
