import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { areFriends } from "@/server/collaboration/people";
import { memberConversation, messagePage } from "@/server/collaboration/conversations";

const cursorSchema = z.object({ before: z.string().min(1).max(64).optional(), after: z.string().min(1).max(64).optional() });

/** A page of one conversation's messages — only for its two members. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/messages/[conversationId]">) {
  const user = await requireUser();
  const { conversationId } = await ctx.params;
  const member = await memberConversation(user.id, conversationId);
  if (!member) return Response.json({ error: "Chat পাওয়া যায়নি।" }, { status: 404 });
  const cursor = cursorSchema.safeParse({ before: request.nextUrl.searchParams.get("before") ?? undefined, after: request.nextUrl.searchParams.get("after") ?? undefined });
  if (!cursor.success) return Response.json({ error: "bad_request" }, { status: 400 });
  const page = await messagePage(conversationId, cursor.data);
  const otherLastReadAt = member.mine === "userALastReadAt" ? member.conversation.userBLastReadAt : member.conversation.userALastReadAt;
  return Response.json({ ...page, otherId: member.otherId, otherLastReadAt, canSend: await areFriends(user.id, member.otherId) }, { headers: { "Cache-Control": "no-store" } });
}
