-- Staff permissions: each ADMIN gets a list of what they may do (src/lib/staff.ts).
-- New column only; existing admins keep what admins could do before: billing, question bank, vocabulary.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "User"
SET "staffPermissions" = ARRAY['billing', 'question_bank', 'vocabulary']::TEXT[]
WHERE "role" IN ('ADMIN', 'SUPER_ADMIN') AND cardinality("staffPermissions") = 0;
