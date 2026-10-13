import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { displayName } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { groupMember, groupMessagePage } from "@/server/collaboration/groups";

const cursorSchema = z.object({ before: z.string().min(1).max(64).optional(), after: z.string().min(1).max(64).optional() });

/**
 * A page of one group's messages — only for its current members. Sender names come along, since
 * past senders may have left the group and aren't in its member list any more.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/groups/[groupId]">) {
  const user = await requireUser();
  const { groupId } = await ctx.params;
  if (!(await groupMember(user.id, groupId))) return Response.json({ error: "গ্রুপ পাওয়া যায়নি।" }, { status: 404 });
  const cursor = cursorSchema.safeParse({ before: request.nextUrl.searchParams.get("before") ?? undefined, after: request.nextUrl.searchParams.get("after") ?? undefined });
  if (!cursor.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const page = await groupMessagePage(groupId, cursor.data);
  const senderIds = [...new Set(page.messages.map((message) => message.senderId).filter((id): id is string => Boolean(id)))];
  const senders = await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true, email: true } });
  const names = Object.fromEntries(senders.map((sender) => [sender.id, displayName(sender, false)]));
  return Response.json({ ...page, names }, { headers: { "Cache-Control": "no-store" } });
}
