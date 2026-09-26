import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedType, MAX_ATTACHMENT_BYTES, sniffType } from "@/lib/attachments";
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
  z.object({ kind: z.literal("revise_task"), taskId: z.string(), title: z.string(), timesRevised: z.number() }),
  z.object({ kind: z.literal("create_note"), title: z.string().max(200), content: z.string().max(400_000), preview: z.string().max(4000) }),
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
  attachment: z.object({
    name: z.string().max(255),
    mimeType: z.string().refine(isAllowedType, "Only images and PDFs are supported"),
    data: z.string().max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 + 4).regex(/^[A-Za-z0-9+/]+=*$/),
  }).nullish(),
});

/** The file must really be an image/PDF of the declared kind, not just named like one. */
function checkAttachment(data: string, declared: string) {
  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) return "size";
  const actual = sniffType(bytes.subarray(0, 16));
  if (!actual) return "type";
  const family = (type: string) => (type === "application/pdf" ? "pdf" : "image");
  return family(actual) === family(declared) ? null : "type";
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fileProblem = parsed.error.issues.some((issue) => issue.path[0] === "attachment");
    return NextResponse.json({ type: "clarify", reply: fileProblem ? "শুধু ছবি (JPG, PNG, WebP) বা PDF, ১০MB পর্যন্ত দেওয়া যাবে। / Only images or PDFs up to 10MB are supported." : "আমি কিছু শুনতে পাইনি। আবার বলবেন?" });
  }
  const { attachment } = parsed.data;
  if (attachment) {
    const problem = checkAttachment(attachment.data, attachment.mimeType);
    if (problem) {
      const reply = parsed.data.lang === "en"
        ? problem === "size" ? "That file is larger than 10MB. Please share a smaller one." : "That file isn't a real image or PDF, so I can't read it."
        : problem === "size" ? "ফাইলটা ১০MB-এর বেশি বড়। একটু ছোট ফাইল দাও।" : "ফাইলটা আসল ছবি বা PDF না, তাই পড়তে পারছি না।";
      return NextResponse.json({ type: "clarify", source: "fallback", reply });
    }
  }
  return NextResponse.json(await respond(user.id, parsed.data));
}
