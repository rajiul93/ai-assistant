-- Plans & payments. Only new types and tables: nothing existing is changed.
DO $$ BEGIN CREATE TYPE "PlanType" AS ENUM ('STUDENT', 'PROFESSIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMethod" AS ENUM ('BKASH', 'NAGAD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PlanPackage" (
    "id" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "priceBdt" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanPackage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlanPackage_planType_sortOrder_idx" ON "PlanPackage"("planType", "sortOrder");

CREATE TABLE IF NOT EXISTS "PaymentAccount" (
    "method" "PaymentMethod" NOT NULL,
    "number" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'Personal',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("method")
);

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "planType" "PlanType" NOT NULL,
    "packageName" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "amountBdt" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'page',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_method_transactionId_key" ON "Payment"("method", "transactionId");
CREATE INDEX IF NOT EXISTS "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_paymentId_key" ON "Entitlement"("paymentId");
CREATE INDEX IF NOT EXISTS "Entitlement_userId_endsAt_idx" ON "Entitlement"("userId", "endsAt");

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PlanPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Starting packages (admins can change price, days and tokens later)
INSERT INTO "PlanPackage" ("id", "planType", "name", "durationDays", "tokens", "priceBdt", "sortOrder", "updatedAt") VALUES
  ('pkg_student_15d', 'STUDENT', '15 Days', 15, 500000, 199, 0, CURRENT_TIMESTAMP),
  ('pkg_student_1m', 'STUDENT', '1 Month', 30, 1500000, 499, 1, CURRENT_TIMESTAMP),
  ('pkg_pro_1m', 'PROFESSIONAL', '1 Month', 30, 3000000, 999, 0, CURRENT_TIMESTAMP),
  ('pkg_pro_premium', 'PROFESSIONAL', 'Premium', 30, 8000000, 1999, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
