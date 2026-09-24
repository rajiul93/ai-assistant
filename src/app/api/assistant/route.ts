import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { respond } from "@/server/assistant/respond";

const taskDraftSchema = z.object({
  title: z.string(),
  description: z.string(),
  subjectId: z.string(),
  subjectName: z.string(),
  dueDate: z.string(),
  dueLabel: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  estimatedMinutes: z.number(),
});

const pendingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create_task"), draft: taskDraftSchema }),
  z.object({ kind: z.literal("complete_task"), taskId: z.string(), title: z.string(), subjectName: z.string() }),
  z.object({ kind: z.literal("add_revision"), topicId: z.string(), topicName: z.string(), subjectName: z.string(), revisionDate: z.string(), dateLabel: z.string(), notes: z.string() }),
  z.object({
    kind: z.literal("add_application"),
    draft: z.object({
      title: z.string(),
      organization: z.string(),
      location: z.string(),
      posts: z.array(z.string()),
      sector: z.enum(["GOVERNMENT", "NON_GOVERNMENT"]),
      status: z.enum(["WISHLIST", "APPLIED", "EXAM", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]),
      appliedAt: z.string(),
      deadline: z.string(),
      examDate: z.string(),
      reference: z.string(),
      link: z.string(),
      notes: z.string(),
    }),
  }),
]);

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(20).optional(),
  pending: pendingSchema.nullish(),
  voice: z.boolean().optional(),
  alternatives: z.array(z.string().max(2000)).max(5).optional(),
  lang: z.enum(["bn", "en"]).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ type: "clarify", reply: "আমি কিছু শুনতে পাইনি। আবার বলবেন?" });
  return NextResponse.json(await respond(user.id, parsed.data));
}
