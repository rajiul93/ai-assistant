import { conversationSide, MESSAGE_PAGE } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";

/**
 * Conversation access for the server only (not a server action, so the browser can't call it with
 * someone else's id): the conversation and my side of it, or null if I'm not in it.
 */
export async function memberConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return null;
  const side = conversationSide(conversation, userId);
  return side ? { conversation, ...side } : null;
}

/**
 * One page of messages, oldest first on screen. `before`: older than this message (scrolling up);
 * `after`: newer than this message (catching up after polling or a reconnect); neither: the latest page.
 */
export async function messagePage(conversationId: string, cursor: { before?: string; after?: string }) {
  const select = { id: true, senderId: true, body: true, createdAt: true } as const;
  const pivot = cursor.before ?? cursor.after;
  const at = pivot ? await prisma.message.findFirst({ where: { id: pivot, conversationId }, select: { createdAt: true, id: true } }) : null;
  if (cursor.after && at) {
    const newer = await prisma.message.findMany({
      where: { conversationId, OR: [{ createdAt: { gt: at.createdAt } }, { createdAt: at.createdAt, id: { gt: at.id } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select,
    });
    return { messages: newer, hasOlder: undefined };
  }
  const rows = await prisma.message.findMany({
    where: { conversationId, ...(cursor.before && at ? { OR: [{ createdAt: { lt: at.createdAt } }, { createdAt: at.createdAt, id: { lt: at.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: MESSAGE_PAGE + 1, select,
  });
  return { messages: rows.slice(0, MESSAGE_PAGE).reverse(), hasOlder: rows.length > MESSAGE_PAGE };
}
