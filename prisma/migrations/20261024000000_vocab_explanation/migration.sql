-- Vocabulary: a Bangla explanation per word, written with AI by staff and read by everyone.
-- New nullable columns only.
ALTER TABLE "VerbEntry" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "AffixEntry" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "NounEntry" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
