import { prisma } from "@/lib/prisma";
import { groupUnreadCounts } from "@/server/collaboration/groups";

/**
 * The small numbers the shell shows on every page (bell, Messages badge, dashboard requests card),
 * in one cheap round of queries. Polled by the browser as a fallback to socket.io pushes.
 */
export async function liveCounts(userId: string) {
  const [notificationsUnread, pendingFriendRequests, pendingShares, directUnread, groupUnread] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.friendRequest.count({ where: { toId: userId, status: "PENDING" } }),
    prisma.shareRequest.count({ where: { recipientId: userId, status: "PENDING" } }),
    unreadMessageCount(userId),
    groupUnreadCounts(userId),
  ]);
  // The Messages badge counts 1:1 and group chats together.
  const messagesUnread = directUnread + [...groupUnread.values()].reduce((sum, count) => sum + count, 0);
  return { notificationsUnread, messagesUnread, pendingRequests: pendingFriendRequests + pendingShares };
}

/** Messages from others after my last-read time, over all my conversations. */
export async function unreadMessageCount(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Message" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE m."senderId" <> ${userId}
      AND ((c."userAId" = ${userId} AND (c."userALastReadAt" IS NULL OR m."createdAt" > c."userALastReadAt"))
        OR (c."userBId" = ${userId} AND (c."userBLastReadAt" IS NULL OR m."createdAt" > c."userBLastReadAt")))`;
  return Number(rows[0]?.count ?? 0);
}
