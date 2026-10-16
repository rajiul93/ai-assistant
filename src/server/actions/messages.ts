"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MESSAGE_MAX, orderPair } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { memberConversation } from "@/server/collaboration/conversations";
import { areFriends, friendIdsOf, personSelect, publicPerson } from "@/server/collaboration/people";
import { emitTo } from "@/server/collaboration/realtime";
import { userError } from "@/lib/user-error";

/**
 * One-to-one chat between friends. Postgres keeps every message; socket.io only delivers them at
 * once (and polling covers when it can't). Chats stay readable after unfriending, but only friends
 * can send (docs/collaboration-plan.md D6).
 */

const idSchema = z.string().min(1).max(64);

/** The conversation with a friend, created the first time. Only friends can start one. */
export async function openConversation(friendId: string) {
  const me = await requireUser();
  const otherId = idSchema.parse(friendId);
  const [userAId, userBId] = orderPair(me.id, otherId);
  const existing = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } }, select: { id: true } });
  if (existing) return existing.id;
  if (!(await areFriends(me.id, otherId))) throw userError("শুধু friend-দের সাথে chat করা যায়।");
  const created = await prisma.conversation.upsert({ where: { userAId_userBId: { userAId, userBId } }, create: { userAId, userBId }, update: {}, select: { id: true } });
  return created.id;
}

/** Sends a plain-text message. The server checks membership and friendship every time. */
export async function sendMessage(input: unknown) {
  const me = await requireUser();
  const { conversationId, body } = z.object({ conversationId: idSchema, body: z.string().trim().min(1, "কিছু লেখো").max(MESSAGE_MAX, `সর্বোচ্চ ${MESSAGE_MAX} অক্ষর`) }).parse(input);
  const member = await memberConversation(me.id, conversationId);
  if (!member) throw userError("Chat পাওয়া যায়নি।");
  if (!(await areFriends(me.id, member.otherId))) throw userError("আপনারা আর friend নন — নতুন message পাঠানো যাবে না।");

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({ data: { conversationId, senderId: me.id, body }, select: { id: true, senderId: true, body: true, createdAt: true } });
    // Sending means I've read everything up to now.
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt, [member.mine]: now } });
    return created;
  });
  const payload = { ...message, createdAt: message.createdAt.toISOString() };
  void emitTo([member.otherId, me.id], { type: "message", conversationId, message: payload });
  return payload;
}

/** Marks the conversation read up to now, and tells the other side (for "seen"). */
export async function markConversationRead(conversationId: string) {
  const me = await requireUser();
  const member = await memberConversation(me.id, idSchema.parse(conversationId));
  if (!member) throw userError("Chat পাওয়া যায়নি।");
  await prisma.conversation.update({ where: { id: member.conversation.id }, data: { [member.mine]: new Date() } });
  void emitTo([me.id, member.otherId], { type: "read", conversationId: member.conversation.id });
}

/**
 * My chat list: every friend (a chat can start with any of them) plus any older conversation with
 * someone no longer a friend, newest activity first, each with its unread count.
 */
export async function listConversations() {
  const me = await requireUser();
  const friendIds = await friendIdsOf(me.id);
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
    select: {
      id: true, userAId: true, userBId: true, userALastReadAt: true, userBLastReadAt: true, lastMessageAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true } },
    },
  });
  const otherIds = [...new Set([...friendIds, ...conversations.map((c) => (c.userAId === me.id ? c.userBId : c.userAId))])];
  const people = new Map((await prisma.user.findMany({ where: { id: { in: otherIds } }, select: personSelect })).map((user) => [user.id, user]));
  const friends = new Set(friendIds);

  const unread = await Promise.all(conversations.map(async (c) => {
    const lastRead = c.userAId === me.id ? c.userALastReadAt : c.userBLastReadAt;
    return prisma.message.count({ where: { conversationId: c.id, senderId: { not: me.id }, ...(lastRead ? { createdAt: { gt: lastRead } } : {}) } });
  }));
  const byOther = new Map(conversations.map((c, index) => [c.userAId === me.id ? c.userBId : c.userAId, { conversation: c, unread: unread[index] }]));

  return otherIds
    .filter((id) => people.has(id))
    .map((id) => {
      const entry = byOther.get(id);
      const last = entry?.conversation.messages[0];
      return {
        person: publicPerson(people.get(id)!, friends.has(id)),
        isFriend: friends.has(id),
        conversationId: entry?.conversation.id ?? null,
        unread: entry?.unread ?? 0,
        lastMessage: last ? { body: last.body.slice(0, 120), mine: last.senderId === me.id, createdAt: last.createdAt } : null,
      };
    })
    .sort((a, b) => (b.lastMessage?.createdAt.getTime() ?? 0) - (a.lastMessage?.createdAt.getTime() ?? 0) || a.person.name.localeCompare(b.person.name));
}
