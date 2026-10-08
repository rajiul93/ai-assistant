-- Short Question: question–answer sets (same Todo → Doing → Testing → Done flow as Preliminary) and self-marked test results. New tables only.
CREATE TABLE IF NOT EXISTS "ShortQuestionSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "topicName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "QuestionSetStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShortQuestionSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShortQuestion" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    CONSTRAINT "ShortQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShortTestAttempt" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortTestAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShortQuestionSet_userId_status_idx" ON "ShortQuestionSet"("userId", "status");
CREATE INDEX IF NOT EXISTS "ShortQuestionSet_subjectId_idx" ON "ShortQuestionSet"("subjectId");
CREATE INDEX IF NOT EXISTS "ShortQuestion_setId_position_idx" ON "ShortQuestion"("setId", "position");
CREATE INDEX IF NOT EXISTS "ShortTestAttempt_setId_submittedAt_idx" ON "ShortTestAttempt"("setId", "submittedAt");
CREATE INDEX IF NOT EXISTS "ShortTestAttempt_userId_idx" ON "ShortTestAttempt"("userId");

DO $$ BEGIN ALTER TABLE "ShortQuestionSet" ADD CONSTRAINT "ShortQuestionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ShortQuestionSet" ADD CONSTRAINT "ShortQuestionSet_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ShortQuestion" ADD CONSTRAINT "ShortQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ShortQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ShortTestAttempt" ADD CONSTRAINT "ShortTestAttempt_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ShortQuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ShortTestAttempt" ADD CONSTRAINT "ShortTestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
