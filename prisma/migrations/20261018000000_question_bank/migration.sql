-- Question Bank (docs/question-bank-plan.md): shared sets uploaded by the super admin, and the link
-- from a user's Preliminary copy back to its bank set. Preliminary questions gain optional
-- solution/explanation. New enum, tables and nullable columns only.
DO $$ BEGIN CREATE TYPE "BankExam" AS ENUM ('BCS', 'PRIMARY', 'GRADE_11_20'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "QuestionSet" ADD COLUMN IF NOT EXISTS "bankSetId" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "solution" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "explanation" TEXT;

CREATE TABLE IF NOT EXISTS "BankSet" (
    "id" TEXT NOT NULL,
    "exam" "BankExam" NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSet_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "BankQuestion" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "serial" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "solution" TEXT,
    "explanation" TEXT,
    "sources" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankSet_exam_section_name_key" ON "BankSet"("exam", "section", "name");
CREATE INDEX IF NOT EXISTS "BankQuestion_setId_serial_idx" ON "BankQuestion"("setId", "serial");
CREATE UNIQUE INDEX IF NOT EXISTS "BankQuestion_setId_fingerprint_key" ON "BankQuestion"("setId", "fingerprint");
-- One copy per user per bank set (NULLs — sets not from the bank — never clash).
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionSet_userId_bankSetId_key" ON "QuestionSet"("userId", "bankSetId");

DO $$ BEGIN ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_bankSetId_fkey" FOREIGN KEY ("bankSetId") REFERENCES "BankSet"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "BankSet"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
