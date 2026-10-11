-- Vocabulary: the user's singular/plural table with Bangla meanings. New table only.
CREATE TABLE IF NOT EXISTS "NounEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "singular" TEXT NOT NULL,
    "plural" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NounEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NounEntry_userId_idx" ON "NounEntry"("userId");

DO $$ BEGIN ALTER TABLE "NounEntry" ADD CONSTRAINT "NounEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
