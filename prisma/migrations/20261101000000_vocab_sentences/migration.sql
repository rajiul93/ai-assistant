-- Six example sentences per word, with their Bangla (src/lib/vocabulary/sentences.ts). Additive; safe to run twice.
ALTER TABLE "VerbEntry" ADD COLUMN IF NOT EXISTS "sentences" JSONB;
ALTER TABLE "AffixEntry" ADD COLUMN IF NOT EXISTS "sentences" JSONB;
ALTER TABLE "NounEntry" ADD COLUMN IF NOT EXISTS "sentences" JSONB;
