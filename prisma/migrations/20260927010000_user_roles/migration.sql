-- User roles. Adds a column only; nothing is removed.
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';

-- The existing admins keep admin rights; the owner is the super admin.
UPDATE "User" SET "role" = 'SUPER_ADMIN' WHERE lower("email") = 'rajiulrayhan@gmail.com';
UPDATE "User" SET "role" = 'ADMIN' WHERE lower("email") = 'riazahmed.tex@gmail.com' AND "role" = 'USER';
