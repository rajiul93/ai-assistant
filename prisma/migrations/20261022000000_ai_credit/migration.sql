-- OpenAI balance on /usage: money added to the OpenAI account (super admin enters it).
-- New table only.
CREATE TABLE IF NOT EXISTS "AiCredit" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCredit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiCredit_addedAt_idx" ON "AiCredit"("addedAt");
