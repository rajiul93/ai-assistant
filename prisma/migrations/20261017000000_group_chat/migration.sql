-- Group chat (docs/profile-and-group-chat-plan.md §2). New enums and tables, plus one new
-- notification type; the 1:1 chat tables are untouched.
DO $$ BEGIN CREATE TYPE "GroupRole" AS ENUM ('ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GroupMessageKind" AS ENUM ('TEXT', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROUP_ADDED';

CREATE TABLE IF NOT EXISTS "ChatGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatGroup_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "ChatGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ChatGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);
CREATE TABLE IF NOT EXISTS "GroupMessage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT,
    "kind" "GroupMessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatGroupMember_userId_idx" ON "ChatGroupMember"("userId");
CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");

DO $$ BEGIN ALTER TABLE "ChatGroupMember" ADD CONSTRAINT "ChatGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ChatGroupMember" ADD CONSTRAINT "ChatGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- GROUP_ADDED notifications point at the group.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
DO $$ BEGIN ALTER TABLE "Notification" ADD CONSTRAINT "Notification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
