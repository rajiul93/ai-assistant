-- Preliminary sets, Short Question sets and Confusions can be filed under a topic of the owner's
-- subject → topic tree (optional; nothing existing changes). A deleted topic just unfiles them.
ALTER TABLE "QuestionSet" ADD COLUMN IF NOT EXISTS "topicId" TEXT;
ALTER TABLE "ShortQuestionSet" ADD COLUMN IF NOT EXISTS "topicId" TEXT;
ALTER TABLE "Confusion" ADD COLUMN IF NOT EXISTS "topicId" TEXT;

CREATE INDEX IF NOT EXISTS "QuestionSet_topicId_idx" ON "QuestionSet"("topicId");
CREATE INDEX IF NOT EXISTS "ShortQuestionSet_topicId_idx" ON "ShortQuestionSet"("topicId");
CREATE INDEX IF NOT EXISTS "Confusion_topicId_idx" ON "Confusion"("topicId");

DO $$ BEGIN ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ShortQuestionSet" ADD CONSTRAINT "ShortQuestionSet_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Confusion" ADD CONSTRAINT "Confusion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
