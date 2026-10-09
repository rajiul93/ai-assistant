-- Confusion: doubts noted to ask in class (CONFUSION), then marked CLEAR with what was learned. New enum and table only.
DO $$ BEGIN CREATE TYPE "ConfusionStatus" AS ENUM ('CONFUSION', 'CLEAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Confusion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "topic" TEXT,
    "text" TEXT NOT NULL,
    "clarification" TEXT,
    "status" "ConfusionStatus" NOT NULL DEFAULT 'CONFUSION',
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Confusion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Confusion_userId_status_idx" ON "Confusion"("userId", "status");
CREATE INDEX IF NOT EXISTS "Confusion_subjectId_idx" ON "Confusion"("subjectId");

DO $$ BEGIN ALTER TABLE "Confusion" ADD CONSTRAINT "Confusion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Confusion" ADD CONSTRAINT "Confusion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
