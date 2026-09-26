import { z } from "zod";
import { isAllowedType, MAX_ATTACHMENT_BYTES, sniffType } from "@/lib/attachments";
import { noteWritingRules, sanitizeNoteHtml } from "@/lib/note-html";
import { callAI } from "@/server/assistant/ai";

export const extractRequestSchema = z.object({
  name: z.string().max(200),
  mimeType: z.string().refine(isAllowedType),
  data: z.string().min(1),
});

const extractedSchema = z.object({
  title: z.string().nullish(),
  organization: z.string().nullish(),
  location: z.string().nullish(),
  posts: z.array(z.string()).nullish(),
  sector: z.enum(["GOVERNMENT", "NON_GOVERNMENT"]).nullish(),
  status: z.enum(["WISHLIST", "APPLIED", "EXAM", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]).nullish(),
  appliedAt: z.string().nullish(),
  deadline: z.string().nullish(),
  examDate: z.string().nullish(),
  userId: z.string().nullish(),
  roll: z.string().nullish(),
  password: z.string().nullish(),
  link: z.string().nullish(),
  notesHtml: z.string().nullish(),
});

const responseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", nullable: true, description: "Short name for this application, e.g. post + organization + year" },
    organization: { type: "STRING", nullable: true },
    location: { type: "STRING", nullable: true },
    posts: { type: "ARRAY", nullable: true, items: { type: "STRING" } },
    sector: { type: "STRING", enum: ["GOVERNMENT", "NON_GOVERNMENT"], nullable: true },
    status: { type: "STRING", enum: ["WISHLIST", "APPLIED", "EXAM", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"], nullable: true },
    appliedAt: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    deadline: { type: "STRING", nullable: true, description: "YYYY-MM-DD: the next date the applicant must act by (fee payment or application)" },
    examDate: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    userId: { type: "STRING", nullable: true },
    roll: { type: "STRING", nullable: true },
    password: { type: "STRING", nullable: true },
    link: { type: "STRING", nullable: true },
    notesHtml: { type: "STRING", nullable: true },
  },
};

const prompt = `এটা একটা চাকরির আবেদনের কাগজ (applicant's copy, admit card, circular বা এমন কিছু)। পুরোটা মনোযোগ দিয়ে পড়ো এবং JSON দাও:
- title: আবেদনটার ছোট নাম (পদ + প্রতিষ্ঠান, দরকারে সাল)।
- organization: প্রতিষ্ঠান/মন্ত্রণালয়ের নাম। posts: যে পদ(গুলো)তে আবেদন, ইংরেজি নাম আর বাংলা থাকলে বন্ধনীতে। location থাকলে।
- sector: সরকারি মন্ত্রণালয়/অধিদপ্তর/সরকারি ব্যাংক ইত্যাদি হলে GOVERNMENT, নইলে NON_GOVERNMENT।
- status: আবেদন জমা হয়েছে (fee বাকি থাকলেও) → APPLIED; admit card/পরীক্ষার তারিখ থাকলে EXAM।
- appliedAt: আবেদনের/ডাউনলোডের তারিখ; deadline: সামনে যা করতে হবে তার শেষ সময় (যেমন fee জমার শেষ তারিখ); examDate থাকলে। সব YYYY-MM-DD।
- userId: portal-এর User ID; roll: roll নম্বর; password: কাগজে password লেখা থাকলে (না থাকলে null — কখনো বানাবে না); link: portal/website।
- notesHtml: বাকি সব তথ্য, কিছু বাদ না দিয়ে, গুছিয়ে — বিষয় অনুযায়ী <h3> শিরোনাম (যেমন "আবেদনের তথ্য", "ব্যক্তিগত তথ্য", "ঠিকানা", "শিক্ষাগত যোগ্যতা", "অন্যান্য যোগ্যতা", "ফি জমার নিয়ম"), প্রতিটার নিচে <ul><li><strong>ঘরের নাম:</strong> মান</li></ul>; শিক্ষাগত যোগ্যতায় প্রতিটা পরীক্ষা এক <li>-তে (পরীক্ষা, বোর্ড, রোল, ফল, বিষয়, সাল); SMS/fee-এর নির্দেশনা ধাপে ধাপে <ol>-এ। উপরের আলাদা ঘরগুলোতে যা দিয়েছ সেগুলো notesHtml-এ আবার লিখবে না। ${noteWritingRules}
নাম, email, ID, রোল, মোবাইল ও অন্য সব নম্বর কাগজে যেভাবে আছে অক্ষরে অক্ষরে হুবহু লেখো — বানান "ঠিক" করবে না, ইংরেজি নাম ইংরেজিতে আর বাংলা নাম বাংলায় যেমন ছাপা আছে তেমন। কাগজে যা নেই তা বানাবে না; পড়া না গেলে null।`;

/**
 * Scanned PDFs (like most portal "applicant's copy" downloads) are just one JPEG per page. Sent as
 * a PDF the pages get read at low resolution and names come back misspelled; sent as the original
 * images they are read exactly. Returns the page images, or null for a PDF that is mostly text.
 */
function scannedPdfPages(pdf: Buffer) {
  const pages: Buffer[] = [];
  for (let at = pdf.indexOf(Buffer.from([0xff, 0xd8, 0xff])); at !== -1 && pages.length < 6; at = pdf.indexOf(Buffer.from([0xff, 0xd8, 0xff]), at + 1)) {
    const end = pdf.indexOf(Buffer.from("endstream"), at);
    if (end === -1) break;
    let stop = end;
    while (stop > at + 2 && !(pdf[stop - 2] === 0xff && pdf[stop - 1] === 0xd9)) stop--;
    if (stop > at + 2) pages.push(pdf.subarray(at, stop));
    at = end;
  }
  const imageBytes = pages.reduce((total, page) => total + page.length, 0);
  return pages.length && imageBytes > pdf.length * 0.6 ? pages : null;
}

/**
 * Reads an applicant's copy (PDF/image) with the AI and returns the application form's fields.
 * Returns an error message instead when the file isn't usable or couldn't be read.
 */
export async function extractApplication(input: z.infer<typeof extractRequestSchema>, userId: string) {
  const bytes = Buffer.from(input.data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) return { error: "The file must be 10MB or smaller.", status: 400 } as const;
  const actual = sniffType(bytes.subarray(0, 16));
  if (!actual || (actual === "application/pdf") !== (input.mimeType === "application/pdf")) return { error: "That file isn't a real image or PDF.", status: 400 } as const;

  const pages = actual === "application/pdf" ? scannedPdfPages(bytes) : null;
  const files = pages
    ? pages.map((page, index) => ({ mimeType: "image/jpeg", data: page.toString("base64"), name: `page-${index + 1}.jpg` }))
    : [{ mimeType: actual, data: input.data, name: input.name }];
  const raw = await callAI(prompt, {
    responseSchema,
    files,
    userId,
    feature: "file_assistant",
  });
  let fields: z.infer<typeof extractedSchema> | null = null;
  try { fields = raw ? extractedSchema.parse(JSON.parse(raw)) : null; } catch { fields = null; }
  if (!fields) return { error: "Couldn't read that file right now. Please try again.", status: 502 } as const;
  const day = (value?: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
  const link = fields.link?.trim() ?? "";
  return {
    fields: {
      title: fields.title?.trim() ?? "",
      organization: fields.organization?.trim() ?? "",
      location: fields.location?.trim() ?? "",
      posts: (fields.posts ?? []).map((post) => post.trim()).filter(Boolean).slice(0, 30),
      sector: fields.sector ?? null,
      status: fields.status ?? null,
      appliedAt: day(fields.appliedAt),
      deadline: day(fields.deadline),
      examDate: day(fields.examDate),
      reference: fields.userId?.trim() ?? "",
      roll: fields.roll?.trim() ?? "",
      password: fields.password?.trim() ?? "",
      link: !link ? "" : /^https?:\/\//i.test(link) ? link : `https://${link.replace(/^\/+/, "")}`,
      notes: sanitizeNoteHtml(fields.notesHtml ?? ""),
    },
  } as const;
}
