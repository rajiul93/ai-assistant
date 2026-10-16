"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizeEmail, orderPair } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { areFriends, friendIdsOf, personSelect, publicPerson } from "@/server/collaboration/people";
import { emitTo } from "@/server/collaboration/realtime";
import { userError } from "@/lib/user-error";

/**
 * Friends: found by exact email, asked with a request, accepted or rejected. Friendship is what
 * allows sharing and chat (docs/collaboration-plan.md, D1/D6/D7).
 */

const REQUESTS_PER_DAY = 30;
const idSchema = z.string().min(1).max(64);

function revalidate() {
  revalidatePath("/messages");
  revalidatePath("/dashboard");
}

/**
 * Looks a user up by their exact email (no partial search, so nobody can list users). Returns only
 * what may be shown before friendship, and how they relate to the caller.
 */
export async function findUserByEmail(email: string) {
  const me = await requireUser();
  const address = normalizeEmail(z.string().email("ঠিক email লেখো").parse(email.trim()));
  const user = await prisma.user.findFirst({ where: { email: { equals: address, mode: "insensitive" } }, select: personSelect });
  if (!user || user.status === "BLOCKED") return { found: false as const };
  if (user.id === me.id) return { found: true as const, self: true as const };
  const friend = await areFriends(me.id, user.id);
  const pending = friend ? null : await prisma.friendRequest.findFirst({
    where: { status: "PENDING", OR: [{ fromId: me.id, toId: user.id }, { fromId: user.id, toId: me.id }] },
    select: { id: true, fromId: true },
  });
  return {
    found: true as const,
    self: false as const,
    person: publicPerson(user, friend),
    relation: friend ? "friend" as const : pending ? (pending.fromId === me.id ? "sent" as const : "received" as const) : "none" as const,
    requestId: pending?.id ?? null,
  };
}

/** Creates the friendship (and its conversation-free history) inside a transaction. */
async function befriend(tx: Prisma.TransactionClient, a: string, b: string) {
  const [userAId, userBId] = orderPair(a, b);
  await tx.friendship.upsert({ where: { userAId_userBId: { userAId, userBId } }, create: { userAId, userBId }, update: {} });
}

/**
 * Sends a friend request. If the other person already asked me, that request is accepted instead
 * (D6). Refuses self, blocked accounts, existing friends, a request already waiting, and floods.
 */
export async function sendFriendRequest(userId: string) {
  const me = await requireUser();
  const toId = idSchema.parse(userId);
  if (toId === me.id) throw userError("নিজেকে friend request পাঠানো যায় না।");
  const target = await prisma.user.findUnique({ where: { id: toId }, select: { status: true } });
  if (!target || target.status === "BLOCKED") throw userError("এই user-কে পাওয়া যায়নি।");
  if (await areFriends(me.id, toId)) throw userError("আপনারা আগেই friend।");

  const theirs = await prisma.friendRequest.findFirst({ where: { fromId: toId, toId: me.id, status: "PENDING" }, select: { id: true } });
  if (theirs) return respondFriendRequest(theirs.id, true);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await prisma.friendRequest.count({ where: { fromId: me.id, createdAt: { gte: since } } })) >= REQUESTS_PER_DAY) {
    throw userError("আজ অনেক request পাঠানো হয়েছে — কাল আবার চেষ্টা করো।");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const request = await tx.friendRequest.create({ data: { fromId: me.id, toId } });
      await tx.notification.create({ data: { userId: toId, type: "FRIEND_REQUEST", actorId: me.id, friendRequestId: request.id } });
    });
  } catch (error) {
    // The partial unique index: a request between us is already waiting (perhaps sent a moment ago).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw userError("Request আগেই পাঠানো আছে।");
    throw error;
  }
  void emitTo([toId], { type: "notify" });
  revalidate();
  return { status: "sent" as const };
}

/**
 * Accepts or rejects a request sent to me. The status moves out of PENDING only once (a
 * conditional update), so a double click or two tabs can't befriend twice or notify twice.
 */
export async function respondFriendRequest(requestId: string, accept: boolean) {
  const me = await requireUser();
  const id = idSchema.parse(requestId);
  const request = await prisma.friendRequest.findFirst({ where: { id, toId: me.id }, select: { fromId: true, status: true } });
  if (!request) throw userError("Request পাওয়া যায়নি।");
  if (request.status !== "PENDING") return { status: request.status === "ACCEPTED" ? "accepted" as const : "closed" as const };

  const changed = await prisma.$transaction(async (tx) => {
    const moved = await tx.friendRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: accept ? "ACCEPTED" : "REJECTED", respondedAt: new Date() } });
    if (!moved.count) return false;
    if (accept) await befriend(tx, me.id, request.fromId);
    await tx.notification.create({ data: { userId: request.fromId, type: accept ? "FRIEND_ACCEPTED" : "FRIEND_REJECTED", actorId: me.id, friendRequestId: id } });
    // My own "you have a request" notification is done with.
    await tx.notification.updateMany({ where: { userId: me.id, friendRequestId: id, readAt: null }, data: { readAt: new Date() } });
    return true;
  });
  if (changed) void emitTo([request.fromId, me.id], { type: accept ? "friends" : "notify" });
  revalidate();
  return { status: accept ? "accepted" as const : "rejected" as const };
}

/** Withdraws a request I sent that is still waiting. */
export async function cancelFriendRequest(requestId: string) {
  const me = await requireUser();
  const id = idSchema.parse(requestId);
  const request = await prisma.friendRequest.findFirst({ where: { id, fromId: me.id }, select: { toId: true } });
  if (!request) throw userError("Request পাওয়া যায়নি।");
  await prisma.$transaction([
    prisma.friendRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED", respondedAt: new Date() } }),
    // The other person no longer has anything to answer.
    prisma.notification.deleteMany({ where: { friendRequestId: id, userId: request.toId, type: "FRIEND_REQUEST" } }),
  ]);
  void emitTo([request.toId], { type: "notify" });
  revalidate();
}

/**
 * Ends a friendship. Shares still waiting between the two are cancelled; the chat history stays
 * readable but nothing new can be sent (D6).
 */
export async function removeFriend(friendId: string) {
  const me = await requireUser();
  const otherId = idSchema.parse(friendId);
  if (otherId === me.id) throw userError("ভুল request।");
  const [userAId, userBId] = orderPair(me.id, otherId);
  await prisma.$transaction([
    prisma.friendship.deleteMany({ where: { userAId, userBId } }),
    prisma.shareRequest.updateMany({
      where: { status: "PENDING", OR: [{ senderId: me.id, recipientId: otherId }, { senderId: otherId, recipientId: me.id }] },
      data: { status: "CANCELLED", respondedAt: new Date() },
    }),
  ]);
  void emitTo([me.id, otherId], { type: "friends" });
  revalidate();
}

/** My friends (with email), and requests waiting in both directions. */
export async function listFriendsOverview() {
  const me = await requireUser();
  const [friendIds, incoming, outgoing] = await Promise.all([
    friendIdsOf(me.id),
    prisma.friendRequest.findMany({ where: { toId: me.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, from: { select: personSelect } } }),
    prisma.friendRequest.findMany({ where: { fromId: me.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, to: { select: personSelect } } }),
  ]);
  const friends = await prisma.user.findMany({ where: { id: { in: friendIds } }, select: personSelect, orderBy: { name: "asc" } });
  return {
    friends: friends.map((user) => publicPerson(user, true)),
    incoming: incoming.map((request) => ({ id: request.id, createdAt: request.createdAt, person: publicPerson(request.from, false) })),
    outgoing: outgoing.map((request) => ({ id: request.id, createdAt: request.createdAt, person: publicPerson(request.to, false) })),
  };
}
