-- Video library: YouTube videos a user saves to watch inside the app (free: 5, plan: no limit).
-- New table only.
CREATE TABLE IF NOT EXISTS "StudyVideo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudyVideo_userId_createdAt_idx" ON "StudyVideo"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudyVideo_subjectId_idx" ON "StudyVideo"("subjectId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudyVideo_userId_videoId_key" ON "StudyVideo"("userId", "videoId");

DO $$ BEGIN ALTER TABLE "StudyVideo" ADD CONSTRAINT "StudyVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "StudyVideo" ADD CONSTRAINT "StudyVideo_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
