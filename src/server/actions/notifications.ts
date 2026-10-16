"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sharePreview, type ShareType } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
// Loaded for its effect: a failed schema.parse keeps its Bangla message on the live site.
import "@/lib/user-error";
import { personSelect, publicPerson } from "@/server/collaboration/people";

/**
 * Notifications for friend, share and group events, persisted so they survive refresh and sign-in. Chat
 * messages aren't stored here; the bell adds unread chats from the Messages counts.
 */

export async function listNotifications(limit = 30) {
  const me = await requireUser();
  const take = z.number().int().min(1).max(100).parse(limit);
  const rows = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, type: true, readAt: true, createdAt: true,
      actor: { select: personSelect },
      friendRequest: { select: { id: true, status: true } },
      shareRequest: { select: { id: true, status: true, itemType: true, title: true, payload: true, createdItemId: true } },
      group: { select: { id: true, name: true } },
    },
  });
  const friendIds = new Set((await prisma.friendship.findMany({ where: { OR: [{ userAId: me.id }, { userBId: me.id }] }, select: { userAId: true, userBId: true } })).map((row) => (row.userAId === me.id ? row.userBId : row.userAId)));
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    read: Boolean(row.readAt),
    createdAt: row.createdAt,
    actor: row.actor ? publicPerson(row.actor, friendIds.has(row.actor.id)) : null,
    friendRequest: row.friendRequest,
    share: row.shareRequest
      ? { id: row.shareRequest.id, status: row.shareRequest.status, type: row.shareRequest.itemType as ShareType, title: row.shareRequest.title, preview: sharePreview(row.shareRequest.itemType as ShareType, row.shareRequest.payload), createdItemId: row.shareRequest.createdItemId }
      : null,
    group: row.group,
  }));
}

/** Marks some (or all) of my notifications as read. */
export async function markNotificationsRead(ids: string[] | "all") {
  const me = await requireUser();
  const which = ids === "all" ? undefined : z.array(z.string().min(1).max(64)).max(200).parse(ids);
  await prisma.notification.updateMany({ where: { userId: me.id, readAt: null, ...(which ? { id: { in: which } } : {}) }, data: { readAt: new Date() } });
}
