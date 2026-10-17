-- Affiliate program (docs/affiliate-plan.md, owner 2026-10-17): links with ?ref=CODE, referrals,
-- commissions on approved payments, cash payouts or plan credit. Idempotent: safe to run again.

DO $$ BEGIN
  CREATE TYPE "AffiliateCommissionMode" AS ENUM ('PERCENT', 'FIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AffiliatePayoutMode" AS ENUM ('CASH', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS     "affiliateActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "affiliateCode" TEXT,
ADD COLUMN IF NOT EXISTS     "affiliatePayoutNumber" TEXT,
ADD COLUMN IF NOT EXISTS     "referredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS     "referredById" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS     "creditUsedBdt" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "AffiliateSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "openToAll" BOOLEAN NOT NULL DEFAULT false,
    "commissionMode" "AffiliateCommissionMode" NOT NULL DEFAULT 'PERCENT',
    "percent" INTEGER NOT NULL DEFAULT 20,
    "fixedBdt" INTEGER NOT NULL DEFAULT 50,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "windowDays" INTEGER NOT NULL DEFAULT 30,
    "payoutMode" "AffiliatePayoutMode" NOT NULL DEFAULT 'CASH',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "basisBdt" INTEGER NOT NULL,
    "rule" TEXT NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "canceledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "note" TEXT,
    "paidBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AffiliateClick_affiliateId_createdAt_idx" ON "AffiliateClick"("affiliateId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateCommission_paymentId_key" ON "AffiliateCommission"("paymentId");
CREATE INDEX IF NOT EXISTS "AffiliateCommission_affiliateId_createdAt_idx" ON "AffiliateCommission"("affiliateId", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliatePayout_affiliateId_createdAt_idx" ON "AffiliatePayout"("affiliateId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "User_affiliateCode_key" ON "User"("affiliateCode");
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO "AffiliateSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
