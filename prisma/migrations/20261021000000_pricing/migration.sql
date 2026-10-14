-- Pricing: System + AI tier + exam, several durations, per-day AI quotas, SSLCommerz
-- (docs/subscription-plan.md). New tables, new nullable/defaulted columns, and default rows.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SSLCOMMERZ';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "allTracks" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "breakdown" JSONB;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "trackIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Purchases made before this change opened every exam: they keep that (allTracks, no trackIds).
-- New rows always set it, so the default is dropped again.
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "allTracks" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Entitlement" ALTER COLUMN "allTracks" DROP DEFAULT;
ALTER TABLE "Entitlement" ADD COLUMN IF NOT EXISTS "trackIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "PricingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "systemPriceBdt" INTEGER NOT NULL,
    "allTracksDiscountPct" INTEGER NOT NULL,
    "gatewayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiTier" (
    "planType" "PlanType" NOT NULL,
    "name" TEXT NOT NULL,
    "priceBdt" INTEGER NOT NULL,
    "tokensPerMonth" INTEGER NOT NULL,
    "messagesPerDay" INTEGER NOT NULL,
    "scansPerDay" INTEGER NOT NULL,
    "suggestionsPerDay" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiTier_pkey" PRIMARY KEY ("planType")
);

CREATE TABLE IF NOT EXISTS "ExamTrack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceBdt" INTEGER NOT NULL,
    "bankExam" "BankExam",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExamTrack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExamTrack_bankExam_key" ON "ExamTrack"("bankExam");

CREATE TABLE IF NOT EXISTS "PlanDuration" (
    "id" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanDuration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanDuration_days_key" ON "PlanDuration"("days");

CREATE TABLE IF NOT EXISTS "AiUse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiUse_userId_kind_createdAt_idx" ON "AiUse"("userId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUse_userId_ref_idx" ON "AiUse"("userId", "ref");
DO $$ BEGIN ALTER TABLE "AiUse" ADD CONSTRAINT "AiUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Starting prices (per 30 days) and quotas; the super admin changes them from the admin panel.
INSERT INTO "PricingSettings" ("id", "systemPriceBdt", "allTracksDiscountPct", "gatewayEnabled", "updatedAt")
VALUES ('default', 100, 20, false, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AiTier" ("planType", "name", "priceBdt", "tokensPerMonth", "messagesPerDay", "scansPerDay", "suggestionsPerDay", "active", "updatedAt") VALUES
  ('STUDENT', 'Student AI', 200, 300000, 30, 10, 20, true, CURRENT_TIMESTAMP),
  ('PROFESSIONAL', 'Professional AI', 600, 3000000, 150, 50, 100, true, CURRENT_TIMESTAMP)
ON CONFLICT ("planType") DO NOTHING;

INSERT INTO "ExamTrack" ("id", "name", "priceBdt", "bankExam", "active", "sortOrder", "updatedAt") VALUES
  ('track_bcs', 'BCS', 150, 'BCS', true, 1, CURRENT_TIMESTAMP),
  ('track_primary', 'প্রাইমারি', 150, 'PRIMARY', true, 2, CURRENT_TIMESTAMP),
  ('track_grade', '১১–২০ গ্রেড', 150, 'GRADE_11_20', true, 3, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO "PlanDuration" ("id", "days", "label", "discountPct", "active", "sortOrder", "updatedAt") VALUES
  ('duration_30', 30, '১ মাস', 0, true, 1, CURRENT_TIMESTAMP),
  ('duration_90', 90, '৩ মাস', 10, true, 2, CURRENT_TIMESTAMP),
  ('duration_180', 180, '৬ মাস', 15, true, 3, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
