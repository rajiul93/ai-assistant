import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MAX_ATTACHMENT_BYTES, sniffType } from "@/lib/attachments";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";

export const maxDuration = 60;

const requestSchema = z.object({ data: z.string().min(1), purpose: z.enum(["confusion", "clarification"]) });

const prompts = {
  confusion: "এটা পড়ার বই, গাইড, নোট বা প্রশ্নের ছবি — এখানে পড়তে গিয়ে কোথাও confusion হয়েছে।",
  clarification: "এটা ক্লাসের বোর্ড, স্যার/ম্যামের নোট বা খাতার ছবি — একটা confusion কীভাবে clear হলো তার ব্যাখ্যা।",
};

const instructions = `ছবিতে যা লেখা আছে হুবহু লেখো। কোনো অংশ দাগ দেওয়া, গোল করা, হাইলাইট করা বা তীর দিয়ে দেখানো থাকলে শুধু সেই অংশটুকু; না থাকলে পুরো লেখা।
অক্ষরে অক্ষরে নির্ভুল — যুক্তবর্ণ, কার, ফলা, সংখ্যা সব যেমন আছে; বানান ঠিক করবে না, কিছু যোগ করবে না, ব্যাখ্যা বা উত্তর দেবে না। লাইন/অনুচ্ছেদ ভাঙা যেমন আছে রাখো। গণিতের রাশি থাকলে LaTeX-এ $…$ দিয়ে লেখো। ছবিতে কোনো লেখা না থাকলে text ফাঁকা রাখো।`;

const responseSchema = { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] };

/** A photo of a page or a board → its text, word for word (or just the marked part), for a confusion or its clarification. */
export async function POST(request: Request) {
  const user = await requireUser();
  const { blocked } = await checkAi(user);
  if (blocked) return Response.json({ error: blocked === "quota" ? "তোমার AI plan-এর ব্যবহার শেষ।" : "AI ব্যবহার করতে একটা plan লাগবে।" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ছবিটা পাঠানো যায়নি।" }, { status: 400 });
  const bytes = Buffer.from(parsed.data.data, "base64");
  if (!bytes.length || bytes.length > MAX_ATTACHMENT_BYTES) return Response.json({ error: "ছবিটা ১০MB-এর কম হতে হবে।" }, { status: 400 });
  const type = sniffType(bytes);
  if (!type || type === "application/pdf") return Response.json({ error: "শুধু ছবি (JPG, PNG, WebP) পড়া যায়।" }, { status: 400 });
  const raw = await callAI(`${prompts[parsed.data.purpose]}\n${instructions}`, { responseSchema, files: [{ mimeType: type, data: parsed.data.data, name: "photo" }], userId: user.id, feature: "file_assistant", timeoutMs: 55_000 });
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে ছবিটা পড়তে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });
  try {
    const { text } = z.object({ text: z.string() }).parse(JSON.parse(raw));
    return Response.json({ text: text.trim().slice(0, 4000) });
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না। আবার চেষ্টা করো।" }, { status: 502 });
  }
}
