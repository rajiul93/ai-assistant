import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiBlockedMessage } from "@/lib/ai-limits";
import { sniffType } from "@/lib/attachments";
import { checkAi } from "@/server/ai-access";
import { callAI } from "@/server/assistant/ai";
import { hasPremium } from "@/server/premium";

export const maxDuration = 60;

// A shrunk page photo (the page aims at ~1.8MB); base64 stays under Vercel's ~4.5MB body.
const requestSchema = z.object({ data: z.string().min(1).max(3_200_000), batch: z.string().min(1).max(40) });

const responseSchema = { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] };

const PROMPT = `এটা বই, গাইড বা ক্লাসের শিটের একটা পাতার ছবি। পাতার সব লেখা হুবহু, উপর থেকে নিচে ক্রম ঠিক রেখে লেখো:
- অক্ষরে অক্ষরে নির্ভুল — যুক্তবর্ণ, কার, ফলা, সংখ্যা, সাল, নাম যেমন আছে; কিছু বাদ দেবে না, কিছু যোগ করবে না, ব্যাখ্যা দেবে না।
- শিরোনাম আলাদা লাইনে; তালিকা থাকলে প্রতিটা আলাদা লাইনে "• " দিয়ে।
- টেবিল থাকলে প্রতিটা সারি এক লাইনে, ঘরগুলো " | " দিয়ে আলাদা; প্রথম সারি শিরোনাম।
- গণিতের রাশি LaTeX-এ $…$ দিয়ে।
- কোনো অংশ পড়া না গেলে সেখানে [অস্পষ্ট] লেখো, অনুমান করবে না।
- ছবিতে কোনো লেখা না থাকলে text ফাঁকা রাখো।`;

/**
 * One reference photo for "AI দিয়ে লিখুন" → its full text, word for word. Each photo is read on its
 * own at a size where Bangla stays sharp (five in one request were too blurry and too much at
 * once); the note is then updated from the texts. The photos of one request share `batch`, so
 * they count as one scan. Paid.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await hasPremium(user))) return Response.json({ error: "AI দিয়ে note লেখা paid feature — একটা plan নিলে পাবে।" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "ছবিটা পাঠানো যায়নি — একটু ছোট ছবি দাও।" }, { status: 400 });
  const { blocked } = await checkAi(user, "scan", `note-photos:${parsed.data.batch}`);
  if (blocked) return Response.json({ error: aiBlockedMessage(blocked) }, { status: 403 });
  const type = sniffType(Buffer.from(parsed.data.data, "base64"));
  if (!type || type === "application/pdf") return Response.json({ error: "শুধু ছবি (JPG, PNG, WebP) পড়া যায়।" }, { status: 400 });
  const raw = await callAI(PROMPT, { responseSchema, files: [{ mimeType: type, data: parsed.data.data, name: "page" }], userId: user.id, feature: "file_assistant", timeoutMs: 55_000 });
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে ছবিটা পড়তে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });
  try {
    const { text } = z.object({ text: z.string() }).parse(JSON.parse(raw));
    return Response.json({ text: text.trim().slice(0, 20_000) });
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না। আবার চেষ্টা করো।" }, { status: 502 });
  }
}
