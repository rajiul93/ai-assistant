-- Question Bank v2 (docs/question-bank-v2-plan.md): categories for past-year sets (with year and a
-- free flag), and the General bank (subject → chapter → article / MCQ / short question).
-- Idempotent: safe to run again.

CREATE TABLE IF NOT EXISTS "BankCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "exam" "BankExam",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankCategory_name_key" ON "BankCategory"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "BankCategory_slug_key" ON "BankCategory"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BankCategory_exam_key" ON "BankCategory"("exam");

-- The three built-in exams (slugs as the old URLs, so they keep working).
INSERT INTO "BankCategory" ("id", "name", "slug", "exam", "sortOrder") VALUES
  ('bankcat_bcs', 'BCS', 'bcs', 'BCS', 0),
  ('bankcat_primary', 'প্রাইমারি', 'primary', 'PRIMARY', 1),
  ('bankcat_grade', '১১–২০ গ্রেড', 'grade', 'GRADE_11_20', 2)
ON CONFLICT DO NOTHING;

-- BankSet: category, year, free; exam becomes a mirror of the category's exam.
ALTER TABLE "BankSet" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "BankSet" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "BankSet" ADD COLUMN IF NOT EXISTS "free" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BankSet" ALTER COLUMN "exam" DROP NOT NULL;

UPDATE "BankSet" s SET "categoryId" = c."id" FROM "BankCategory" c WHERE s."categoryId" IS NULL AND c."exam" = s."exam";
-- The year in the set's name, "(2025)" or "(২০২৫)"; none → shown under "অন্যান্য".
UPDATE "BankSet" SET "year" = substring(translate("name", '০১২৩৪৫৬৭৮৯', '0123456789') FROM '(?:19[5-9][0-9]|20[0-9][0-9])')::int
WHERE "year" IS NULL;
ALTER TABLE "BankSet" ALTER COLUMN "categoryId" SET NOT NULL;

DROP INDEX IF EXISTS "BankSet_exam_section_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BankSet_categoryId_section_name_key" ON "BankSet"("categoryId", "section", "name");
CREATE INDEX IF NOT EXISTS "BankSet_exam_idx" ON "BankSet"("exam");
DO $$ BEGIN
  ALTER TABLE "BankSet" ADD CONSTRAINT "BankSet_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BankCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- General bank.
CREATE TABLE IF NOT EXISTS "BankSubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankSubject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankSubject_name_key" ON "BankSubject"("name");
INSERT INTO "BankSubject" ("id", "name", "sortOrder") VALUES
  ('banksub_bangla', 'বাংলা', 0),
  ('banksub_english', 'ইংরেজি', 1),
  ('banksub_math', 'গণিত', 2),
  ('banksub_gk', 'সাধারণ জ্ঞান', 3),
  ('banksub_science', 'বিজ্ঞান', 4)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "BankChapter" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankChapter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BankChapter_subjectId_name_key" ON "BankChapter"("subjectId", "name");
DO $$ BEGIN
  ALTER TABLE "BankChapter" ADD CONSTRAINT "BankChapter_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "BankSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BankArticle" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "free" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankArticle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BankArticle_chapterId_sortOrder_idx" ON "BankArticle"("chapterId", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "BankArticle" ADD CONSTRAINT "BankArticle_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BankChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BankShortQuestion" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "serial" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "free" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankShortQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BankShortQuestion_chapterId_serial_idx" ON "BankShortQuestion"("chapterId", "serial");
CREATE UNIQUE INDEX IF NOT EXISTS "BankShortQuestion_chapterId_fingerprint_key" ON "BankShortQuestion"("chapterId", "fingerprint");
DO $$ BEGIN
  ALTER TABLE "BankShortQuestion" ADD CONSTRAINT "BankShortQuestion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BankChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BankQuestion: in a set or in a chapter (exactly one), with its own free flag for chapters.
ALTER TABLE "BankQuestion" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;
ALTER TABLE "BankQuestion" ADD COLUMN IF NOT EXISTS "free" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BankQuestion" ALTER COLUMN "setId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "BankQuestion_chapterId_serial_idx" ON "BankQuestion"("chapterId", "serial");
CREATE UNIQUE INDEX IF NOT EXISTS "BankQuestion_chapterId_fingerprint_key" ON "BankQuestion"("chapterId", "fingerprint");
DO $$ BEGIN
  ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BankChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BankQuestion" ADD CONSTRAINT "BankQuestion_set_or_chapter" CHECK (("setId" IS NULL) <> ("chapterId" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
