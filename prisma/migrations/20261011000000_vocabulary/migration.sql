-- Vocabulary: the user's verb-forms table and prefix/suffix table, each with Bangla meanings. New enum and tables only.
CREATE TABLE IF NOT EXISTS "VerbEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "present" TEXT NOT NULL,
    "past" TEXT NOT NULL,
    "pastParticiple" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerbEntry_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN CREATE TYPE "AffixKind" AS ENUM ('PREFIX', 'SUFFIX'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AffixEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AffixKind" NOT NULL,
    "affix" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffixEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VerbEntry_userId_present_idx" ON "VerbEntry"("userId", "present");
CREATE INDEX IF NOT EXISTS "AffixEntry_userId_kind_idx" ON "AffixEntry"("userId", "kind");

DO $$ BEGIN ALTER TABLE "VerbEntry" ADD CONSTRAINT "VerbEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AffixEntry" ADD CONSTRAINT "AffixEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
