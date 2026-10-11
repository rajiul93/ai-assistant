import type { Prisma, PrismaClient } from "@prisma/client";
import { displayName, initialOf, orderPair } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Whether two users are friends right now (the rule for sharing and chatting). */
export async function areFriends(userId: string, otherId: string, db: Db = prisma) {
  if (userId === otherId) return false;
  const [userAId, userBId] = orderPair(userId, otherId);
  return Boolean(await db.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } }, select: { userAId: true } }));
}

export async function friendIdsOf(userId: string, db: Db = prisma) {
  const rows = await db.friendship.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] }, select: { userAId: true, userBId: true } });
  return rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId));
}

export const personSelect = { id: true, name: true, email: true, image: true, status: true } as const;
type PersonRow = { id: string; name: string | null; email: string; image: string | null };

/**
 * What another user's screen may show about someone: friends see the email, others only the name
 * (or a masked email). Never pass a raw User row to the client.
 */
export function publicPerson(user: PersonRow, isFriend: boolean) {
  const name = displayName(user, isFriend);
  return { id: user.id, name, initial: initialOf(name), image: user.image, email: isFriend ? user.email : null };
}
export type PublicPerson = ReturnType<typeof publicPerson>;
