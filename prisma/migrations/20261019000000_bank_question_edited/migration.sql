-- Question Bank: remember which questions an admin edited (or had AI clean), so a later upload of
-- the sheet doesn't overwrite them. One nullable column.
ALTER TABLE "BankQuestion" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
