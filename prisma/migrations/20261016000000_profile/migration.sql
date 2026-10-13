-- Profile page: the user's own name and phone (docs/profile-and-group-chat-plan.md §1).
-- New nullable columns only.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileUpdatedAt" TIMESTAMP(3);
