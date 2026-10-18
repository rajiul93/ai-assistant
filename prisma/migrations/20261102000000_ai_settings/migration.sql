-- Which AI answers, and the Gemini key (encrypted) the super admin enters on /usage. Additive; safe to run twice.
CREATE TABLE IF NOT EXISTS "AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "geminiKey" TEXT,
    "geminiModel" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);
