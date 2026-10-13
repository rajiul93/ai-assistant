import type { Prisma } from "@prisma/client";
import { MESSAGE_PAGE } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";

/**
 * Group chat access for the server only (not a server action, so the browser can't call these with
 * someone else's id). A member row is the whole permission: leaving or removal deletes it.
 */

export async function groupMember(userId: string, groupId: string) {
  return prisma.chatGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { role: true, joinedAt: true, lastReadAt: true } });
}

export async function groupMemberIds(groupId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  return (await db.chatGroupMember.findMany({ where: { groupId }, select: { userId: true } })).map((row) => row.userId);
}

/**
 * Locks the group row until the transaction ends, so two admins adding people at once can't pass
 * the size limit, and two admins leaving at once can't both skip handing over the role.
 */
export async function lockGroup(tx: Prisma.TransactionClient, groupId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "ChatGroup" WHERE id = ${groupId} FOR UPDATE`;
  return rows.length > 0;
}

const messageSelect = { id: true, senderId: true, kind: true, body: true, createdAt: true } as const;

/** One page of a group's messages, same cursors as the 1:1 chat (`conversations.ts` messagePage). */
export async function groupMessagePage(groupId: string, cursor: { before?: string; after?: string }) {
  const pivot = cursor.before ?? cursor.after;
  const at = pivot ? await prisma.groupMessage.findFirst({ where: { id: pivot, groupId }, select: { createdAt: true, id: true } }) : null;
  if (cursor.after && at) {
    const newer = await prisma.groupMessage.findMany({
      where: { groupId, OR: [{ createdAt: { gt: at.createdAt } }, { createdAt: at.createdAt, id: { gt: at.id } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select: messageSelect,
    });
    return { messages: newer, hasOlder: undefined };
  }
  const rows = await prisma.groupMessage.findMany({
    where: { groupId, ...(cursor.before && at ? { OR: [{ createdAt: { lt: at.createdAt } }, { createdAt: at.createdAt, id: { lt: at.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: MESSAGE_PAGE + 1, select: messageSelect,
  });
  return { messages: rows.slice(0, MESSAGE_PAGE).reverse(), hasOlder: rows.length > MESSAGE_PAGE };
}

/**
 * Unread group messages per group: other people's text messages after my last read, or after I
 * joined (a new member isn't shown the whole history as unread).
 */
export async function groupUnreadCounts(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ groupId: string; count: bigint }>>`
    SELECT gm."groupId", COUNT(*)::bigint AS count
    FROM "GroupMessage" gm
    JOIN "ChatGroupMember" m ON m."groupId" = gm."groupId" AND m."userId" = ${userId}
    WHERE gm.kind = 'TEXT' AND gm."senderId" IS NOT NULL AND gm."senderId" <> ${userId}
      AND gm."createdAt" > COALESCE(m."lastReadAt", m."joinedAt")
    GROUP BY gm."groupId"`;
  return new Map(rows.map((row) => [row.groupId, Number(row.count)]));
}
