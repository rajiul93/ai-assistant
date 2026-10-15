-- At most two signed-in devices per user, and one study timer shared by them. New tables only.
CREATE TABLE IF NOT EXISTS "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActiveTimer" (
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "accumulatedMs" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL DEFAULT '',
    "taskId" TEXT NOT NULL DEFAULT '',
    "subjectId" TEXT NOT NULL DEFAULT '',
    "topicId" TEXT NOT NULL DEFAULT '',
    "targetMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActiveTimer_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "UserDevice_userId_idx" ON "UserDevice"("userId");

DO $$ BEGIN ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ActiveTimer" ADD CONSTRAINT "ActiveTimer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
