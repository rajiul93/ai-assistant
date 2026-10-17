-- A short description under a General chapter's name (owner, 2026-10-17). Idempotent.
ALTER TABLE "BankChapter" ADD COLUMN IF NOT EXISTS "description" TEXT;
