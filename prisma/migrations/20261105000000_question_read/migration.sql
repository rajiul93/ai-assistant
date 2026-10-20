-- "পড়া শেষ" marks on Preliminary questions (additive, nullable).
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
