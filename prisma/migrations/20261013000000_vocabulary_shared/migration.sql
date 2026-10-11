-- Vocabulary becomes shared: built-in rows (seeded) have no owner and an admin's additions outlive
-- their account; nouns remember whether they name a person; each user can mark rows as learned.
-- Relaxes constraints and adds a column and a table only — no data is removed.
DO $$ BEGIN CREATE TYPE "VocabKind" AS ENUM ('VERB', 'NOUN', 'AFFIX', 'PERSON'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "VerbEntry" DROP CONSTRAINT IF EXISTS "VerbEntry_userId_fkey";
ALTER TABLE "AffixEntry" DROP CONSTRAINT IF EXISTS "AffixEntry_userId_fkey";
ALTER TABLE "NounEntry" DROP CONSTRAINT IF EXISTS "NounEntry_userId_fkey";

ALTER TABLE "VerbEntry" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AffixEntry" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "NounEntry" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "NounEntry" ADD COLUMN IF NOT EXISTS "person" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "VocabLearned" (
    "userId" TEXT NOT NULL,
    "kind" "VocabKind" NOT NULL,
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabLearned_pkey" PRIMARY KEY ("userId","kind","entryId")
);

ALTER TABLE "VerbEntry" ADD CONSTRAINT "VerbEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffixEntry" ADD CONSTRAINT "AffixEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NounEntry" ADD CONSTRAINT "NounEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DO $$ BEGIN ALTER TABLE "VocabLearned" ADD CONSTRAINT "VocabLearned_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
