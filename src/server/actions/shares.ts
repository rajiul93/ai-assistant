"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { payloadSchemas, SHARE_TYPES, sharedItemPath, sharePreview, type SharePayload, type ShareType } from "@/lib/collaboration";
import { sanitizeNoteHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";
import { areFriends, friendIdsOf, personSelect, publicPerson } from "@/server/collaboration/people";
import { emitTo } from "@/server/collaboration/realtime";
import { createFromPayload, snapshotForShare } from "@/server/collaboration/share-copy";
import { userError } from "@/lib/user-error";

/**
 * Sharing a note, task, Preliminary set or Short Question set with a friend: a frozen copy is
 * offered, and accepting creates the friend's own item exactly once (docs/collaboration-plan.md).
 */

const idSchema = z.string().min(1).max(64);
const typeSchema = z.enum(SHARE_TYPES);

const sectionPaths: Record<ShareType, string> = { NOTE: "/notes", TASK: "/tasks", PRELIMINARY_SET: "/preliminary", SHORT_QUESTION_SET: "/short-questions" };

/** Offers one of my items to one or more friends. Each friend gets their own request. */
export async function shareItem(input: unknown) {
  const me = await requireUser();
  const { type, itemId, friendIds } = z.object({ type: typeSchema, itemId: idSchema, friendIds: z.array(idSchema).min(1).max(50) }).parse(input);
  const snapshot = await snapshotForShare(me.id, type, itemId);
  if (!snapshot) throw userError("জিনিসটা পাওয়া যায়নি (বা এতে কোনো প্রশ্ন নেই)।");

  const recipients = [...new Set(friendIds)].filter((id) => id !== me.id);
  const sent: string[] = [];
  const already: string[] = [];
  for (const recipientId of recipients) {
    // Only friends, checked here on the server.
    if (!(await areFriends(me.id, recipientId))) throw userError("শুধু friend-দের সাথে share করা যায়।");
    try {
      await prisma.$transaction(async (tx) => {
        const share = await tx.shareRequest.create({
          data: { senderId: me.id, recipientId, itemType: type, sourceItemId: itemId, title: snapshot.title.slice(0, 300), payload: snapshot.payload as Prisma.InputJsonValue },
        });
        await tx.notification.create({ data: { userId: recipientId, type: "SHARE_REQUEST", actorId: me.id, shareRequestId: share.id } });
      });
      sent.push(recipientId);
    } catch (error) {
      // The partial unique index: this item is already waiting for this friend.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { already.push(recipientId); continue; }
      throw error;
    }
  }
  void emitTo(sent, { type: "notify" });
  revalidatePath("/messages");
  return { sent: sent.length, alreadyPending: already.length };
}

/**
 * Accepts or rejects a share sent to me. The request leaves PENDING only once (a conditional
 * update in the same transaction as the copy), so accepting twice — two clicks, two tabs — still
 * gives one item; a later accept returns the item made the first time.
 */
export async function respondShare(shareId: string, accept: boolean) {
  const me = await requireUser();
  const id = idSchema.parse(shareId);
  const share = await prisma.shareRequest.findFirst({ where: { id, recipientId: me.id }, select: { senderId: true, itemType: true, payload: true, status: true, createdItemId: true } });
  if (!share) throw userError("Share পাওয়া যায়নি।");
  const type = share.itemType as ShareType;
  if (share.status !== "PENDING") {
    if (share.status === "ACCEPTED" && share.createdItemId) return { status: "accepted" as const, path: sharedItemPath(type, share.createdItemId) };
    throw userError(share.status === "CANCELLED" ? "পাঠানো মানুষটি share বাতিল করেছে।" : "এটার উত্তর আগেই দেওয়া হয়েছে।");
  }
  if (accept && !(await areFriends(me.id, share.senderId))) throw userError("আপনারা আর friend নন, তাই নেওয়া যাবে না।");

  const createdItemId = await prisma.$transaction(async (tx) => {
    const moved = await tx.shareRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: accept ? "ACCEPTED" : "REJECTED", respondedAt: new Date() } });
    if (!moved.count) return null;
    let itemId: string | null = null;
    if (accept) {
      itemId = await createFromPayload(tx, me.id, type, share.payload);
      await tx.shareRequest.update({ where: { id }, data: { createdItemId: itemId } });
    }
    await tx.notification.create({ data: { userId: share.senderId, type: accept ? "SHARE_ACCEPTED" : "SHARE_REJECTED", actorId: me.id, shareRequestId: id } });
    await tx.notification.updateMany({ where: { userId: me.id, shareRequestId: id, readAt: null }, data: { readAt: new Date() } });
    return itemId;
  }, { timeout: 20_000 });

  // Someone else (another tab) answered first: report what they did.
  if (!createdItemId && accept) {
    const latest = await prisma.shareRequest.findUnique({ where: { id }, select: { status: true, createdItemId: true } });
    if (latest?.status === "ACCEPTED" && latest.createdItemId) return { status: "accepted" as const, path: sharedItemPath(type, latest.createdItemId) };
  }
  void emitTo([share.senderId, me.id], { type: "notify" });
  revalidatePath("/messages");
  revalidatePath(sectionPaths[type]);
  return accept && createdItemId ? { status: "accepted" as const, path: sharedItemPath(type, createdItemId) } : { status: "rejected" as const, path: null };
}

export type ShareContent = { [K in ShareType]: { type: K; data: SharePayload[K] } }[ShareType];

/**
 * Everything inside a share, so the recipient can look it over before deciding. Only the recipient
 * may see it; note HTML is sanitized again before it leaves the server.
 */
export async function getSharePreview(shareId: string) {
  const me = await requireUser();
  const id = idSchema.parse(shareId);
  const share = await prisma.shareRequest.findFirst({
    where: { id, recipientId: me.id },
    select: { id: true, itemType: true, title: true, payload: true, status: true, createdAt: true, sender: { select: personSelect } },
  });
  if (!share) throw userError("Share পাওয়া যায়নি।");
  const type = share.itemType as ShareType;
  const parsed = payloadSchemas[type].safeParse(share.payload);
  if (!parsed.success) throw userError("এই share-এর ভেতরের জিনিস পড়া গেল না।");
  const data = type === "NOTE" ? { ...(parsed.data as SharePayload["NOTE"]), content: sanitizeNoteHtml((parsed.data as SharePayload["NOTE"]).content) } : parsed.data;
  return {
    id: share.id, title: share.title, status: share.status, createdAt: share.createdAt,
    sender: publicPerson(share.sender, true),
    content: { type, data } as ShareContent,
  };
}

/** Withdraws a share I sent that is still waiting. */
export async function cancelShare(shareId: string) {
  const me = await requireUser();
  const id = idSchema.parse(shareId);
  const share = await prisma.shareRequest.findFirst({ where: { id, senderId: me.id }, select: { recipientId: true } });
  if (!share) throw userError("Share পাওয়া যায়নি।");
  await prisma.$transaction([
    prisma.shareRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED", respondedAt: new Date() } }),
    prisma.notification.deleteMany({ where: { shareRequestId: id, userId: share.recipientId, type: "SHARE_REQUEST" } }),
  ]);
  void emitTo([share.recipientId], { type: "notify" });
  revalidatePath("/messages");
}

/** Shares waiting for my answer, newest first, with a short preview of each. */
export async function listIncomingShares() {
  const me = await requireUser();
  const shares = await prisma.shareRequest.findMany({
    where: { recipientId: me.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, itemType: true, title: true, payload: true, createdAt: true, sender: { select: personSelect } },
  });
  return shares.map((share) => ({
    id: share.id, type: share.itemType as ShareType, title: share.title, createdAt: share.createdAt,
    preview: sharePreview(share.itemType as ShareType, share.payload), sender: publicPerson(share.sender, true),
  }));
}

/** For the share dialog: my friends, and which of them already have this item waiting. */
export async function shareTargets(input: unknown) {
  const me = await requireUser();
  const { type, itemId } = z.object({ type: typeSchema, itemId: idSchema }).parse(input);
  const friendIds = await friendIdsOf(me.id);
  const [friends, pending] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: friendIds }, status: "ACTIVE" }, select: personSelect, orderBy: { name: "asc" } }),
    prisma.shareRequest.findMany({ where: { senderId: me.id, itemType: type, sourceItemId: itemId, status: "PENDING" }, select: { recipientId: true } }),
  ]);
  const waiting = new Set(pending.map((share) => share.recipientId));
  return friends.map((user) => ({ ...publicPerson(user, true), pending: waiting.has(user.id) }));
}
