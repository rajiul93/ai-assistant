-- AlterTable: roll number and the portal password for each job application
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "roll" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "password" TEXT;
