"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { displayName, GROUP_MAX, GROUP_MIN, GROUP_NAME_MAX, MESSAGE_MAX, membersToAdd, nextGroupAdmin } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { groupMember, groupMemberIds, groupUnreadCounts, lockGroup } from "@/server/collaboration/groups";
import { friendIdsOf, personSelect, publicPerson } from "@/server/collaboration/people";
import { emitTo, type GroupMessageEvent } from "@/server/collaboration/realtime";

/**
 * Group chat among friends (docs/profile-and-group-chat-plan.md §2). Only the group admin renames,
 * adds (from the admin's own friends) and removes; anyone can leave. Leaving or removal deletes the
 * member row, so the history is gone for them. Postgres is the source of truth; socket.io only
 * pushes, and polling covers when it can't.
 */

const idSchema = z.string().min(1).max(64);
const idsSchema = z.array(idSchema).max(GROUP_MAX);
const nameSchema = z.string().trim().min(1, "গ্রুপের একটা নাম দিন").max(GROUP_NAME_MAX, `নাম সর্বোচ্চ ${GROUP_NAME_MAX} অক্ষর`);
type Tx = Prisma.TransactionClient;

/** A name for system lines ("রহিম যোগ হয়েছেন"), frozen into the text when it's written. */
const nameFor = (user: { name: string | null; email: string }) => displayName(user, false);

/** Everyone being added must be my friend right now and an active account. */
async function assertAddable(tx: Tx, me: string, ids: string[]) {
  const friends = new Set(await friendIdsOf(me, tx));
  if (ids.some((id) => !friends.has(id))) throw new Error("শুধু নিজের friend-দের গ্রুপে যোগ করা যায়।");
  const users = await tx.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, name: true, email: true } });
  if (users.length !== ids.length) throw new Error("কয়েকজনকে যোগ করা যাচ্ছে না।");
  return users;
}

async function systemLine(tx: Tx, groupId: string, body: string) {
  const message = await tx.groupMessage.create({ data: { groupId, kind: "SYSTEM", body }, select: { id: true, senderId: true, kind: true, body: true, createdAt: true } });
  await tx.chatGroup.update({ where: { id: groupId }, data: { lastMessageAt: message.createdAt } });
  return message;
}

const asEvent = (message: { id: string; senderId: string | null; kind: "TEXT" | "SYSTEM"; body: string; createdAt: Date }): GroupMessageEvent =>
  ({ ...message, createdAt: message.createdAt.toISOString() });

/** Inside a transaction that has locked the group: my membership, or an error. */
async function requireMember(tx: Tx, groupId: string, userId: string, admin = false) {
  const member = await tx.chatGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { role: true } });
  if (!member) throw new Error("গ্রুপ পাওয়া যায়নি।");
  if (admin && member.role !== "ADMIN") throw new Error("শুধু গ্রুপ admin এটা করতে পারেন।");
  return member;
}

export async function createGroup(input: unknown) {
  const me = await requireUser();
  const { name, memberIds } = z.object({ name: nameSchema, memberIds: idsSchema }).parse(input);
  const adding = membersToAdd(memberIds, me.id, [me.id]);
  if (!adding) throw new Error(`একটা গ্রুপে সর্বোচ্চ ${GROUP_MAX} জন।`);
  if (adding.length + 1 < GROUP_MIN) throw new Error(`অন্তত ${GROUP_MIN - 1} জন friend বেছে নিন।`);

  const now = new Date();
  const group = await prisma.$transaction(async (tx) => {
    await assertAddable(tx, me.id, adding);
    const created = await tx.chatGroup.create({
      data: {
        name,
        createdById: me.id,
        members: { create: [{ userId: me.id, role: "ADMIN", lastReadAt: now }, ...adding.map((userId) => ({ userId }))] },
      },
      select: { id: true },
    });
    await systemLine(tx, created.id, `${nameFor(me)} গ্রুপটি বানিয়েছেন`);
    await tx.notification.createMany({ data: adding.map((userId) => ({ userId, type: "GROUP_ADDED" as const, actorId: me.id, groupId: created.id })) });
    return created;
  });
  void emitTo(adding, { type: "notify" });
  void emitTo([me.id, ...adding], { type: "group_changed", groupId: group.id });
  return group.id;
}

export async function renameGroup(input: unknown) {
  const me = await requireUser();
  const { groupId, name } = z.object({ groupId: idSchema, name: nameSchema }).parse(input);
  const { line, members } = await prisma.$transaction(async (tx) => {
    if (!(await lockGroup(tx, groupId))) throw new Error("গ্রুপ পাওয়া যায়নি।");
    await requireMember(tx, groupId, me.id, true);
    await tx.chatGroup.update({ where: { id: groupId }, data: { name } });
    return { line: await systemLine(tx, groupId, `${nameFor(me)} গ্রুপের নাম বদলে “${name}” রেখেছেন`), members: await groupMemberIds(groupId, tx) };
  });
  void emitTo(members, { type: "group_message", groupId, message: asEvent(line) });
  void emitTo(members, { type: "group_changed", groupId });
}

export async function addGroupMembers(input: unknown) {
  const me = await requireUser();
  const { groupId, memberIds } = z.object({ groupId: idSchema, memberIds: idsSchema.min(1, "কাউকে বেছে নিন") }).parse(input);
  const { line, members, added } = await prisma.$transaction(async (tx) => {
    if (!(await lockGroup(tx, groupId))) throw new Error("গ্রুপ পাওয়া যায়নি।");
    await requireMember(tx, groupId, me.id, true);
    const adding = membersToAdd(memberIds, me.id, await groupMemberIds(groupId, tx));
    if (!adding) throw new Error(`একটা গ্রুপে সর্বোচ্চ ${GROUP_MAX} জন।`);
    if (!adding.length) throw new Error("যাদের বেছেছেন তারা আগে থেকেই গ্রুপে আছেন।");
    const users = await assertAddable(tx, me.id, adding);
    await tx.chatGroupMember.createMany({ data: adding.map((userId) => ({ groupId, userId })) });
    await tx.notification.createMany({ data: adding.map((userId) => ({ userId, type: "GROUP_ADDED" as const, actorId: me.id, groupId })) });
    const line = await systemLine(tx, groupId, `${nameFor(me)} যোগ করেছেন: ${users.map(nameFor).join(", ")}`);
    return { line, members: await groupMemberIds(groupId, tx), added: adding };
  });
  void emitTo(added, { type: "notify" });
  void emitTo(members, { type: "group_message", groupId, message: asEvent(line) });
  void emitTo(members, { type: "group_changed", groupId });
}

export async function removeGroupMember(input: unknown) {
  const me = await requireUser();
  const { groupId, userId } = z.object({ groupId: idSchema, userId: idSchema }).parse(input);
  if (userId === me.id) throw new Error("নিজেকে বাদ দিতে “গ্রুপ ছেড়ে দিন” চাপুন।");
  const { line, members } = await prisma.$transaction(async (tx) => {
    if (!(await lockGroup(tx, groupId))) throw new Error("গ্রুপ পাওয়া যায়নি।");
    await requireMember(tx, groupId, me.id, true);
    const removed = await tx.chatGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { user: { select: { name: true, email: true } } } });
    if (!removed) throw new Error("তিনি আর এই গ্রুপে নেই।");
    await tx.chatGroupMember.delete({ where: { groupId_userId: { groupId, userId } } });
    return { line: await systemLine(tx, groupId, `${nameFor(me)} বাদ দিয়েছেন: ${nameFor(removed.user)}`), members: await groupMemberIds(groupId, tx) };
  });
  void emitTo(members, { type: "group_message", groupId, message: asEvent(line) });
  // The removed member's open chat closes on this.
  void emitTo([...members, userId], { type: "group_changed", groupId });
}

/** Leave a group. The admin's role passes to the earliest member; the last one out deletes it. */
export async function leaveGroup(groupId: string) {
  const me = await requireUser();
  const id = idSchema.parse(groupId);
  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockGroup(tx, id))) throw new Error("গ্রুপ পাওয়া যায়নি।");
    const mine = await requireMember(tx, id, me.id);
    await tx.chatGroupMember.delete({ where: { groupId_userId: { groupId: id, userId: me.id } } });
    const rest = await tx.chatGroupMember.findMany({ where: { groupId: id }, select: { userId: true, role: true, joinedAt: true, user: { select: { name: true, email: true } } } });
    if (!rest.length) {
      await tx.chatGroup.delete({ where: { id } });
      return null;
    }
    let text = `${nameFor(me)} গ্রুপ ছেড়ে গেছেন`;
    if (mine.role === "ADMIN" && !rest.some((member) => member.role === "ADMIN")) {
      const heir = nextGroupAdmin(rest);
      const next = rest.find((member) => member.userId === heir)!;
      await tx.chatGroupMember.update({ where: { groupId_userId: { groupId: id, userId: next.userId } }, data: { role: "ADMIN" } });
      text += ` · এখন admin: ${nameFor(next.user)}`;
    }
    return { line: await systemLine(tx, id, text), members: rest.map((member) => member.userId) };
  });
  if (result) {
    void emitTo(result.members, { type: "group_message", groupId: id, message: asEvent(result.line) });
    void emitTo(result.members, { type: "group_changed", groupId: id });
  }
  void emitTo([me.id], { type: "group_changed", groupId: id });
}

/** Sends a plain-text message. The server checks membership every time. */
export async function sendGroupMessage(input: unknown) {
  const me = await requireUser();
  const { groupId, body } = z.object({ groupId: idSchema, body: z.string().trim().min(1, "কিছু লেখো").max(MESSAGE_MAX, `সর্বোচ্চ ${MESSAGE_MAX} অক্ষর`) }).parse(input);
  if (!(await groupMember(me.id, groupId))) throw new Error("আপনি আর এই গ্রুপে নেই।");
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.groupMessage.create({ data: { groupId, senderId: me.id, body }, select: { id: true, senderId: true, kind: true, body: true, createdAt: true } });
    await tx.chatGroup.update({ where: { id: groupId }, data: { lastMessageAt: created.createdAt } });
    // Sending means I've read everything up to now.
    await tx.chatGroupMember.updateMany({ where: { groupId, userId: me.id }, data: { lastReadAt: created.createdAt } });
    return created;
  });
  const event = asEvent(message);
  void emitTo(await groupMemberIds(groupId), { type: "group_message", groupId, message: event });
  return event;
}

export async function markGroupRead(groupId: string) {
  const me = await requireUser();
  await prisma.chatGroupMember.updateMany({ where: { groupId: idSchema.parse(groupId), userId: me.id }, data: { lastReadAt: new Date() } });
}

/** My groups for the chat list: last message, unread count, member count. */
export async function listGroups() {
  const me = await requireUser();
  const [groups, unread] = await Promise.all([
    prisma.chatGroup.findMany({
      where: { members: { some: { userId: me.id } } },
      select: {
        id: true, name: true, lastMessageAt: true, createdAt: true,
        _count: { select: { members: true } },
        messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { body: true, kind: true, senderId: true, createdAt: true, sender: { select: { name: true, email: true } } } },
      },
    }),
    groupUnreadCounts(me.id),
  ]);
  return groups.map((group) => {
    const last = group.messages[0];
    return {
      id: group.id,
      name: group.name,
      memberCount: group._count.members,
      unread: unread.get(group.id) ?? 0,
      lastMessage: last ? {
        body: last.body.slice(0, 120),
        mine: last.senderId === me.id,
        senderName: last.kind === "TEXT" && last.sender && last.senderId !== me.id ? nameFor(last.sender).split(" ")[0] : null,
        createdAt: last.createdAt,
      } : null,
      activityAt: group.lastMessageAt ?? group.createdAt,
    };
  });
}

/** The group's name, members and my role — only for members. */
export async function groupDetails(groupId: string) {
  const me = await requireUser();
  const id = idSchema.parse(groupId);
  const group = await prisma.chatGroup.findFirst({
    where: { id, members: { some: { userId: me.id } } },
    select: { id: true, name: true, members: { orderBy: [{ joinedAt: "asc" }, { userId: "asc" }], select: { role: true, joinedAt: true, user: { select: personSelect } } } },
  });
  if (!group) return null;
  const friends = new Set(await friendIdsOf(me.id));
  const myRole = group.members.find((member) => member.user.id === me.id)?.role ?? "MEMBER";
  return {
    id: group.id,
    name: group.name,
    isAdmin: myRole === "ADMIN",
    members: group.members.map((member) => ({ ...publicPerson(member.user, friends.has(member.user.id)), role: member.role, me: member.user.id === me.id })),
  };
}
