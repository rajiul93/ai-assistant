-- The floating dock's shortcuts (User.quickItems). Existing users start with what the dock showed
-- before: the calendar and the calculator. Additive and safe to run twice.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "quickItems" TEXT[] DEFAULT ARRAY['calendar', 'calculator']::TEXT[];
