import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedType, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, MAX_TOTAL_ATTACHMENT_BYTES, sniffType } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";
import { respond } from "@/server/assistant/respond";
import { checkAi } from "@/server/ai-access";

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
  attachments: z.array(z.object({
    name: z.string().max(255),
    mimeType: z.string().refine(isAllowedType, "Only images and PDFs are supported"),
    data: z.string().max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 + 4).regex(/^[A-Za-z0-9+/]+=*$/),
  })).max(MAX_ATTACHMENTS).optional(),
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

// Drawing an image can take up to about a minute.
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fileProblem = parsed.error.issues.some((issue) => issue.path[0] === "attachments");
    return NextResponse.json({ type: "clarify", reply: fileProblem ? `শুধু ছবি (JPG, PNG, WebP) বা PDF, একসাথে সর্বোচ্চ ${MAX_ATTACHMENTS}টি দেওয়া যাবে। / Only images or PDFs, up to ${MAX_ATTACHMENTS} at a time.` : "আমি কিছু শুনতে পাইনি। আবার বলবেন?" });
  }
  const attachments = parsed.data.attachments ?? [];
  const totalBytes = attachments.reduce((total, file) => total + Math.floor((file.data.length * 3) / 4), 0);
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES * 1.1) {
    return NextResponse.json({ type: "clarify", source: "fallback", reply: parsed.data.lang === "en" ? "These files are too large together — send fewer at a time." : "সব ফাইল মিলিয়ে অনেক বড় — একসাথে কয়েকটা কম পাঠাও।" });
  }
  for (const attachment of attachments) {
    const problem = checkAttachment(attachment.data, attachment.mimeType);
    if (problem) {
      const reply = parsed.data.lang === "en"
        ? problem === "size" ? "That file is larger than 10MB. Please share a smaller one." : "That file isn't a real image or PDF, so I can't read it."
        : problem === "size" ? "ফাইলটা ১০MB-এর বেশি বড়। একটু ছোট ফাইল দাও।" : "ফাইলটা আসল ছবি বা PDF না, তাই পড়তে পারছি না।";
      return NextResponse.json({ type: "clarify", source: "fallback", reply });
    }
  }
  const { blocked } = await checkAi(user);
  if (blocked) {
    const en = parsed.data.lang === "en";
    const reply = blocked === "paused"
      ? en ? "An admin has paused your AI for now. Contact the admin if you need it." : "Admin তোমার AI সাময়িকভাবে বন্ধ রেখেছে। দরকার হলে admin-এর সাথে যোগাযোগ করো।"
      : blocked === "expired"
      ? en ? "Your plan has run out. Choose a plan below to keep using the AI." : "তোমার plan-এর মেয়াদ শেষ। AI ব্যবহার চালিয়ে যেতে নিচ থেকে একটা plan বেছে নাও।"
      : blocked === "quota"
        ? en ? "Your plan's usage is used up. Buy another package — any days you have left carry over." : "তোমার plan-এর ব্যবহার শেষ। আরেকটা package কেনো — বাকি দিনের সাথে যোগ হবে।"
        : en ? "To use the AI, choose a plan below." : "AI ব্যবহার করতে নিচ থেকে একটা plan বেছে নাও।";
    // Offer plans in the chat — except when paused, which buying a plan wouldn't fix.
    return NextResponse.json({ type: "clarify", source: "fallback", reply, aiLocked: blocked !== "paused" });
  }
  // Newline-delimited JSON: {"type":"delta","text"} while the answer is being written (so the page
  // can show and speak it sentence by sentence), then one {"type":"final","reply"}.
  const request_ = parsed.data;
  const encoder = new TextEncoder();
  // Stopped when the user interrupts (the page aborts the request): the model stops writing too.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (line: object) => {
        if (abort.signal.aborted) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`)); } catch { abort.abort(); }
      };
      try {
        const reply = await respond(user.id, request_, { onReplyDelta: (text) => write({ type: "delta", text }), signal: abort.signal });
        write({ type: "final", reply });
      } catch (error) {
        console.warn("[assistant] failed:", error);
        write({ type: "final", reply: { type: "clarify", source: "fallback", reply: request_.lang === "en" ? "Something went wrong. Please try again." : "কিছু একটা গোলমাল হয়েছে, আবার বলো।" } });
      }
      try { controller.close(); } catch { /* the page already went away */ }
    },
    cancel() { abort.abort(); },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
