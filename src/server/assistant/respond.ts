import { z } from "zod";
import { APP_TIMEZONE, dayjs, now } from "@/lib/dayjs";
import { assistantPages, type AssistantPage, type AssistantReply, type AssistantRequest, type ChatMessage, type ApplicationDraft, type PendingAction, type TaskDraft } from "@/lib/assistant-types";
import { getFlatTopics, getOpenTasks, getPendingTasks, getProgressCounts, getSubjects, getTasksToRevise } from "@/server/queries";
import { htmlToPlainText, noteWritingRules, sanitizeNoteHtml } from "@/lib/note-html";
import { prisma } from "@/lib/prisma";
import { callAI, generateImage, isAIConfigured } from "@/server/assistant/ai";
import { createReplyStreamer } from "@/server/assistant/reply-stream";

type StudyContext = {
  counts: Awaited<ReturnType<typeof getProgressCounts>>;
  tasks: Awaited<ReturnType<typeof getPendingTasks>>;
  toRevise: Awaited<ReturnType<typeof getTasksToRevise>>;
  subjects: Awaited<ReturnType<typeof getSubjects>>;
  openTasks: Awaited<ReturnType<typeof getOpenTasks>>;
  topics: Awaited<ReturnType<typeof getFlatTopics>>;
  notes: Array<{ id: string; title: string }>;
};

type Lang = "bn" | "en" | undefined;
const actions = ["navigate", "create_task", "complete_task", "start_timer", "revise_task", "add_application", "create_note", "answer", "clarify", "ignore", "read_note", "create_image"] as const;
const applicationStatuses = ["WISHLIST", "APPLIED", "EXAM", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"] as const;

const pageKeys = Object.keys(assistantPages) as [AssistantPage, ...AssistantPage[]];

const intentSchema = z.object({
  action: z.enum(actions),
  reply: z.string().default(""),
  page: z.enum(pageKeys).nullish(),
  task: z.object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    subject: z.string().nullish(),
    dueDate: z.string().nullish(),
    dueTime: z.string().nullish(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).nullish(),
    estimatedMinutes: z.number().nullish(),
  }).nullish(),
  /** complete_task: the task title as it appears in the open-task list. */
  taskTitle: z.string().nullish(),
  timer: z.object({ minutes: z.number().nullish(), subject: z.string().nullish(), topic: z.string().nullish() }).nullish(),
  note: z.object({ title: z.string().nullish(), content: z.string().nullish() }).nullish(),
  /** create_image: a detailed English description of the picture to draw. */
  imagePrompt: z.string().nullish(),
  /** read_note: which saved note, and what the user wants from it. */
  noteLookup: z.object({
    title: z.string().nullish(),
    search: z.array(z.string()).nullish(),
    question: z.string().nullish(),
    readAloud: z.boolean().nullish(),
  }).nullish(),
  application: z.object({
    title: z.string().nullish(),
    organization: z.string().nullish(),
    location: z.string().nullish(),
    posts: z.array(z.string()).nullish(),
    sector: z.enum(["GOVERNMENT", "NON_GOVERNMENT"]).nullish(),
    status: z.enum(applicationStatuses).nullish(),
    appliedAt: z.string().nullish(),
    deadline: z.string().nullish(),
    examDate: z.string().nullish(),
    reference: z.string().nullish(),
    link: z.string().nullish(),
    notes: z.string().nullish(),
  }).nullish(),
});
type Intent = z.infer<typeof intentSchema>;

// Structured-output schema for the AI; mirrors intentSchema above.
const intentResponseSchema = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: actions },
    reply: { type: "STRING" },
    page: { type: "STRING", enum: pageKeys, nullable: true },
    task: {
      type: "OBJECT",
      nullable: true,
      properties: {
        title: { type: "STRING", nullable: true },
        description: { type: "STRING", nullable: true },
        subject: { type: "STRING", nullable: true },
        dueDate: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
        dueTime: { type: "STRING", nullable: true, description: "HH:mm, 24-hour" },
        priority: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"], nullable: true },
        estimatedMinutes: { type: "INTEGER", nullable: true },
      },
    },
    taskTitle: { type: "STRING", nullable: true },
    timer: {
      type: "OBJECT",
      nullable: true,
      properties: {
        minutes: { type: "INTEGER", nullable: true },
        subject: { type: "STRING", nullable: true },
        topic: { type: "STRING", nullable: true },
      },
    },
    note: {
      type: "OBJECT",
      nullable: true,
      properties: {
        title: { type: "STRING", nullable: true },
        content: { type: "STRING", nullable: true, description: "Simple HTML: h2, h3, p, strong, em, ul/ol+li, blockquote, code" },
      },
    },
    imagePrompt: { type: "STRING", nullable: true, description: "create_image only: detailed English description of the picture" },
    noteLookup: {
      type: "OBJECT",
      nullable: true,
      properties: {
        title: { type: "STRING", nullable: true, description: "Exact title from the user's notes list, if one matches" },
        search: { type: "ARRAY", nullable: true, items: { type: "STRING" }, description: "Words to find the note by, in Bangla and English spellings" },
        question: { type: "STRING", nullable: true, description: "A specific question to answer from the note; null to give the whole note" },
        readAloud: { type: "BOOLEAN", nullable: true },
      },
    },
    application: {
      type: "OBJECT",
      nullable: true,
      properties: {
        title: { type: "STRING", nullable: true },
        organization: { type: "STRING", nullable: true },
        location: { type: "STRING", nullable: true },
        posts: { type: "ARRAY", nullable: true, items: { type: "STRING" } },
        sector: { type: "STRING", enum: ["GOVERNMENT", "NON_GOVERNMENT"], nullable: true },
        status: { type: "STRING", enum: applicationStatuses, nullable: true },
        appliedAt: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
        deadline: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
        examDate: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
        reference: { type: "STRING", nullable: true },
        link: { type: "STRING", nullable: true },
        notes: { type: "STRING", nullable: true },
      },
    },
  },
  required: ["action", "reply"],
};

// Older turns only need their gist; the latest assistant reply stays whole so "save that answer" still works.
const HISTORY_CHARS = 300;

function formatHistory(history: ChatMessage[]) {
  const lastAssistant = history.findLastIndex((item) => item.role === "assistant");
  return history.map((item, index) => {
    const text = index === lastAssistant || item.text.length <= HISTORY_CHARS ? item.text : `${item.text.slice(0, HISTORY_CHARS)}…`;
    return `${item.role === "user" ? "ব্যবহারকারী" : "সহকারী"}: ${text}`;
  }).join("\n") || "এটি প্রথম কথা।";
}

/** Lists in the prompt are capped: the AI names an item and the server matches it against the full list. */
function capped<T>(items: T[], limit: number, format: (item: T) => string, separator: string) {
  const shown = items.slice(0, limit).map(format).join(separator);
  return items.length > limit ? `${shown}${separator}… (আরও ${items.length - limit}টি)` : shown;
}

function upcomingDays() {
  const today = now();
  return Array.from({ length: 8 }, (_, index) => {
    const day = today.add(index, "day");
    return `${day.format("YYYY-MM-DD dddd")}${index === 0 ? " (আজ)" : index === 1 ? " (কাল)" : ""}`;
  }).join("\n");
}

const persona = `তুমি ব্যবহারকারীর পড়াশোনার সঙ্গী — একজন কাছের বন্ধু আর যত্নশীল শিক্ষকের মতো। "তুমি" বলে সম্বোধন করবে, মানুষের মতো স্বাভাবিক কথ্য বাংলায় কথা বলবে (দরকারে ইংরেজি শব্দ চলবে), উষ্ণ ও উৎসাহ দেওয়া tone-এ। রোবটের মতো আনুষ্ঠানিক বা বইয়ের ভাষা নয়; যেমন "আরে, চিন্তা কোরো না", "চলো একসাথে দেখি"। ভুল তথ্য বানাবে না; নিশ্চিত না হলে সৎভাবে বলবে।`;

function languageRule(lang?: "bn" | "en") {
  return lang === "en"
    ? "ব্যবহারকারী English বেছে নিয়েছে: reply এবং task-এর title/description স্বাভাবিক, বন্ধুসুলভ English-এ দাও (Bengali-তে বললেও)।"
    : "reply স্বাভাবিক কথ্য বাংলায় দাও।";
}

function styleRule(voice?: boolean) {
  return voice
    ? "এই উত্তর মুখে পড়ে শোনানো হবে: ১–৩টি ছোট বাক্যে, কথা বলার ভঙ্গিতে বলো। কোনো list, markdown, emoji বা symbol নয়। Code চাইলে code-টা Markdown code block-এ দাও (সেটা পড়া হবে না, chat-এ দেখাবে) আর মুখে শুধু এক লাইনে বলো কী করেছ।"
    : `উত্তর Markdown-এ ChatGPT-এর মতো গুছিয়ে দাও। সাধারণ প্রশ্নে সংক্ষিপ্ত ও কাজের উত্তর। দরকারে ## শিরোনাম, bullet/numbered list, **bold**, টেবিল ব্যবহার করো।
Coding/programming প্রশ্নে: প্রথমে এক-দুই লাইনে মূল কথা, তারপর সম্পূর্ণ, চালানোর মতো code — সবসময় ভাষার নামসহ fenced code block-এ (\`\`\`js, \`\`\`python, \`\`\`tsx …), তারপর দরকার হলে ধাপে ধাপে ব্যাখ্যা (কেন এভাবে, গুরুত্বপূর্ণ লাইন), শেষে দরকারে উদাহরণ output বা পরের ধাপ। Error/bug দেখালে কারণ আর ঠিক করা code দুটোই দাও। Code-এর ভেতরের comment আর variable ইংরেজিতে; ব্যাখ্যা ব্যবহারকারীর ভাষায়।`;
}

function intentPrompt(request: AssistantRequest, history: ChatMessage[], context: StudyContext) {
  return `${persona}

তুমি একটি বাংলা study-planner app-এর ভেতরে আছো। ব্যবহারকারীর সর্বশেষ কথা পড়ে ঠিক করবে কী করতে হবে। ব্যবহারকারী বাংলা, Banglish, ইংরেজি বা mixed ভাষায় বলতে পারে; voice transcription-এ বানান ভুল থাকতে পারে, অর্থ বুঝে নেবে।

action বেছে নাও:
- create_task: ব্যবহারকারী কোনো task/কাজ/to-do বানাতে, যোগ করতে, মনে করিয়ে দিতে বা save করতে চায়; অথবা নিচের "অপেক্ষমাণ draft" বদলাতে চায় (যেমন "priority high করো", "কাল না, পরশু")। draft বদলালে পুরো আপডেট হওয়া task ফেরত দাও, শুধু বদলানো অংশ নয়।
  - task.title: ছোট, স্পষ্ট নাম। task.description: শুধু task-এর আসল বিষয়বস্তু (কী পড়বে/করবে)। description-এ কখনো priority, subject, তারিখ, সময় লিখবে না (ওগুলোর আলাদা field আছে), আর কোনো প্রশ্ন বা confirmation-এর কথা ("ঠিক আছে কি না বলো", "সেভ করবো?") লিখবে না। বাড়তি বিস্তারিত না থাকলে description null।
  - "আগের/শেষ উত্তরটা task-এ যোগ করো" বললে কথোপকথনে সহকারীর দেওয়া শেষ তথ্যমূলক উত্তর (প্রশ্নের উত্তর/ব্যাখ্যা) description-এ বসাও। সহকারীর confirmation বা প্রশ্ন ("…সেভ করবো?", "…হ্যাঁ বা না বলো") কখনো description-এ বসাবে না।
  - অপেক্ষমাণ draft থাকলে "ঠিক আছে", "সেভ করো", "ওটা save করো", "এভাবেই রাখো" মানে শুধু সেটাই confirm করা — তখন draft-টা হুবহু আগের মতো ফেরত দাও, কিছু যোগ করবে না।
  - task.subject: ব্যবহারকারী subject বললে নিচের তালিকা থেকে সবচেয়ে মিল থাকা নাম; না বললে null।
  - task.dueDate: "আজ", "কাল", "পরশু", "সোমবার", "next week" ইত্যাদি নিচের তারিখ-তালিকা দেখে YYYY-MM-DD-তে বদলাও। সময় বললে dueTime (HH:mm)। না বললে null।
  - task.priority: "জরুরি/important/high" → HIGH, "কম জরুরি/low" → LOW, না বললে null। task.estimatedMinutes: বললে মিনিটে।
  - title বোঝা না গেলে action=clarify দিয়ে জিজ্ঞেস করো কোন task বানাতে চায়।
  - কখনো বলবে না যে task save হয়ে গেছে; save হবে শুধু ব্যবহারকারী confirm করলে।
- complete_task: কোনো task শেষ/done/complete হয়েছে বলে চিহ্নিত করতে চায় ("physics chapter 3 done করো", "mark X done")। taskTitle-এ নিচের "অসমাপ্ত tasks" তালিকা থেকে সবচেয়ে মিলে যাওয়া title হুবহু লেখো। কোনোটাই না মিললে বা একাধিক সমান মিললে clarify করে জিজ্ঞেস করো কোনটা।
- start_timer: পড়ার timer/pomodoro চালু করতে চায় ("২৫ মিনিটের timer চালাও math-এর জন্য")। timer.minutes বললে মিনিটে (১ ঘণ্টা = 60), না বললে null। timer.subject/timer.topic বললে নিচের তালিকা থেকে নাম, না বললে null।
- revise_task: ব্যবহারকারী জানায় সে কোনো শেষ হওয়া task আবার revise/রিভিশন/পুনরায় পড়েছে ("physics chapter 3 revise করলাম", "I revised Newton's laws")। revision আলাদা কিছু না — task-এরই একটা গণনা। taskTitle-এ নিচের "Revision তালিকা" থেকে সবচেয়ে মিলে যাওয়া title হুবহু লেখো; না মিললে বা একাধিক সমান মিললে clarify।
- add_application: ব্যবহারকারী কোনো চাকরিতে apply করেছে/করবে বলে জানায় ("আজ বাংলাদেশ ব্যাংকের Officer পদে apply করেছি", "I applied to BRAC Bank for MTO")। application.title = circular/job-এর নাম (না বললে organization + পদ থেকে ছোট একটা নাম বানাও); organization = প্রতিষ্ঠান; posts = যে যে পদে apply করেছে তার তালিকা (একটা circular-এ একাধিক পদ হতে পারে); location বললে; sector = সরকারি/government/ব্যাংক-বীমা-মন্ত্রণালয়-অধিদপ্তর-কর্পোরেশন-BCS ইত্যাদি হলে GOVERNMENT, প্রাইভেট/company/NGO/multinational হলে NON_GOVERNMENT (নিশ্চিত না হলে প্রতিষ্ঠানের নাম দেখে বিচার করো); status = "apply করবো/করতে চাই" হলে WISHLIST, "apply করেছি" হলে APPLIED; appliedAt = apply করার তারিখ (না বললে এবং "করেছি" বললে আজ); deadline, examDate বললে YYYY-MM-DD; reference = user ID/roll/tracking number বললে; link বললে। organization বোঝা না গেলে clarify।
- create_note: ব্যবহারকারী Notes-এ কিছু লিখে রাখতে/note বানাতে চায় ("photosynthesis নিয়ে একটা note লেখো", "শেষ উত্তরটা notes-এ রাখো", "এটা note করে রাখো: …")। note.title ছোট শিরোনাম; note.content = note-এর লেখা। ${noteWritingRules} "আগের/শেষ উত্তরটা" বললে কথোপকথনে সহকারীর শেষ তথ্যমূলক উত্তরটা গুছিয়ে content-এ বসাও (confirmation বা প্রশ্ন নয়)। ব্যবহারকারী নিজে লেখা বলে দিলে সেটাই হুবহু গুছিয়ে রাখো। task বানানোর কথা বললে create_task, note-এর কথা বললে create_note।
- read_note: ব্যবহারকারী তার নিজের সেভ করা note-এর লেখা পড়তে/শুনতে/জানতে চায়, বা note-এ থাকা তথ্য চায় ("আমার physics note পড়ে শোনাও", "ড্রিম ট্যুরিজম নিয়ে note-এ যা আছে দাও", "note-এ X-এর তারিখ কী লিখেছিলাম")। noteLookup.title = নিচের "Notes" তালিকার সবচেয়ে মিলে যাওয়া title হুবহু, না মিললে null; noteLookup.search = note খোঁজার মূল শব্দ, বাংলা আর ইংরেজি দুই বানানেই (যেমন ["ড্রিম ট্যুরিজম", "dream tourism"]); নির্দিষ্ট প্রশ্ন থাকলে noteLookup.question, পুরো note চাইলে null; "পড়ে শোনাও/শুনাও/read aloud" বললে readAloud true। reply খালি রাখো — note-এর লেখা server দেবে, বানিয়ে লিখবে না।
- create_image: ব্যবহারকারী ছবি/image/picture/illustration/logo/diagram আঁকতে বা বানাতে চায় ("একটা বিড়ালের ছবি বানাও", "draw a logo for my app")। imagePrompt = যা আঁকতে হবে তার বিস্তারিত ইংরেজি বর্ণনা (বিষয়, style, রং, পটভূমি; ছবিতে লেখা থাকলে সেই লেখা হুবহু)। reply-তে এক লাইনে বলো কী আঁকছ।
- navigate: শুধু কোনো পাতা খুলতে/দেখতে চাইলে। page: dashboard, tasks, new_task (নতুন task-এর ফাঁকা form), subjects, revisions, progress, timer, plan, jobs (job application-এর তালিকা), notes (Notes পাতা)।
- answer: প্রশ্ন, আলাপ, পরামর্শ, মন খারাপ, সাধারণ জ্ঞান — যা কোনো app action নয়। reply-তে সরাসরি পুরো উত্তরটা দাও। পড়াশোনা নিয়ে প্রশ্নে নিচের study data ব্যবহার করে ব্যক্তিগত পরামর্শ দাও।
- clarify: উদ্দেশ্য অস্পষ্ট, বা এমন কিছু চাইছে যা app-এ নেই (যেমন notes পাতা নেই)। reply-তে বিনয়ের সঙ্গে জানাও কী করা যায় এবং প্রশ্ন করো।
${request.voice ? "- ignore: mic সবসময় খোলা থাকে, তাই আশেপাশের আওয়াজও আসে। কথাটা স্পষ্টতই সহকারীকে বলা না হলে — TV/ভিডিও/গানের সংলাপ, অন্য কারো সঙ্গে কথা, অর্থহীন টুকরো শব্দ — ignore দাও, reply খালি। সামান্য সন্দেহ থাকলেও ignore নয়; তখন answer বা clarify।\n" : ""}অনুমান করে ভুল কাজ করবে না। ${languageRule(request.lang)} ${styleRule(request.voice)}

সামনের তারিখগুলো (${APP_TIMEZONE}):
${upcomingDays()}

ব্যবহারকারীর subjects: ${context.subjects.map((subject) => subject.name).join(", ") || "কোনো subject নেই"}

Topics (subject › topic): ${capped(context.topics, 80, (topic) => `${topic.subject.name} › ${topic.parent ? `${topic.parent.name} › ` : ""}${topic.name}`, "; ") || "কোনো topic নেই"}

Revision তালিকা (শেষ হওয়া task, কতবার revise হয়েছে): ${capped(context.toRevise, 40, (task) => `“${task.title}” (${task.timesRevised}×)`, ", ") || "নেই"}

Notes (শিরোনাম, নতুনটা আগে): ${capped(context.notes, 40, (note) => `“${note.title}”`, ", ") || "কোনো note নেই"}

অসমাপ্ত tasks: ${capped(context.openTasks, 40, (task) => `“${task.title}”${task.subject ? ` (${task.subject.name})` : ""}`, ", ") || "নেই"}

Study data: ${JSON.stringify(studyData(context))}

অপেক্ষমাণ draft (confirm হয়নি): ${describePending(request.pending)}

আগের কথোপকথন:
${formatHistory(history)}

${request.attachment ? `সংযুক্ত ফাইল: “${request.attachment.name}” (${request.attachment.mimeType === "application/pdf" ? "PDF" : "ছবি"}) — এই message-এর সাথে দেওয়া আছে। ফাইলটা মনোযোগ দিয়ে পড়ো (হাতের লেখা/বাংলা/ইংরেজি সব) এবং ব্যবহারকারী যা চায় সেটাই ফাইলের তথ্য দিয়ে করো:
- "text বের করো / লেখাগুলো দাও" → answer, reply-তে ফাইলের লেখা হুবহু ও গুছিয়ে (অনুবাদ চাইলে অনুবাদ)।
- প্রশ্ন বা "বুঝিয়ে দাও / সারাংশ দাও" → answer, ফাইলের তথ্যের ভিত্তিতে।
- চাকরির circular/বিজ্ঞপ্তি থেকে apply-এর তথ্য রাখতে চাইলে → add_application (প্রতিষ্ঠান, পদগুলো, শেষ তারিখ, পরীক্ষার তারিখ, link ফাইল থেকে নাও; apply না করে থাকলে status WISHLIST)।
- note বানাতে চাইলে → create_note (ফাইলের বিষয়বস্তু গুছিয়ে)।
- task বানাতে চাইলে → create_task (ফাইলের তথ্য থেকে)।
- শুধু ফাইল দিয়ে কিছু না বললে → answer: ফাইলে কী আছে ছোট করে বলো আর এটা দিয়ে কী কী করা যায় (text বের করা, note, task, job application) প্রস্তাব দাও।
ফাইলে যা নেই তা বানিয়ে লিখবে না; পড়া না গেলে সেটা বলবে।

` : ""}ব্যবহারকারীর সর্বশেষ কথা${request.voice ? " (mic থেকে, ভুল শোনা থাকতে পারে)" : ""}:
${request.message}${request.alternatives?.length ? `\n\nmic অন্যভাবেও শুনেছে (একই কথা, সবচেয়ে অর্থবহটা ধরো): ${request.alternatives.map((item) => `“${item}”`).join(", ")}` : ""}`;
}

function describePending(pending: PendingAction | null | undefined) {
  if (!pending) return "নেই";
  if (pending.kind === "create_task") {
    const { draft } = pending;
    return `নতুন task — ${JSON.stringify({ title: draft.title, description: draft.description, subject: draft.subjectName, due: draft.dueLabel, priority: draft.priority, estimatedMinutes: draft.estimatedMinutes })}`;
  }
  if (pending.kind === "complete_task") return `task শেষ করা — “${pending.title}”`;
  if (pending.kind === "add_application") return `job application যোগ — ${JSON.stringify(pending.draft)}`;
  if (pending.kind === "create_note") return `note সেভ — title “${pending.title}”, লেখা: ${pending.preview.slice(0, 1500)}`;
  return `task revise হিসেবে গোনা — “${pending.title}”`;
}

/** Lowercased words for loose matching of spoken names against saved ones. */
function words(text: string) {
  return text.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

/**
 * Best match for a spoken name among saved items: exact, then containment, then word overlap.
 * Returns null when nothing fits or when two items fit equally well (the user must choose).
 */
function bestMatch<T>(wanted: string | null | undefined, items: T[], nameOf: (item: T) => string) {
  const target = wanted?.trim().toLowerCase();
  if (!target) return { match: null, ambiguous: [] as T[] };
  const exact = items.filter((item) => nameOf(item).toLowerCase() === target);
  if (exact.length === 1) return { match: exact[0], ambiguous: [] as T[] };
  const wantedWords = words(target);
  const scored = items
    .map((item) => {
      const name = nameOf(item).toLowerCase();
      const nameWords = words(name);
      const overlap = wantedWords.filter((word) => nameWords.includes(word)).length / Math.max(wantedWords.length, nameWords.length, 1);
      return { item, score: name.includes(target) || target.includes(name) ? 0.9 + overlap / 10 : overlap };
    })
    .filter((entry) => entry.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { match: null, ambiguous: [] as T[] };
  const tied = scored.filter((entry) => entry.score === scored[0].score);
  return tied.length === 1 ? { match: scored[0].item, ambiguous: [] as T[] } : { match: null, ambiguous: tied.slice(0, 3).map((entry) => entry.item) };
}

function findSubject(name: string | null | undefined, subjects: StudyContext["subjects"]) {
  const wanted = name?.trim().toLowerCase();
  if (!wanted) return null;
  return subjects.find((subject) => subject.name.toLowerCase() === wanted)
    ?? subjects.find((subject) => subject.name.toLowerCase().includes(wanted) || wanted.includes(subject.name.toLowerCase()))
    ?? null;
}

/**
 * Keep only real task content in a description: drop sentences that are the assistant's own
 * questions/confirmations or that restate fields stored separately (priority, subject, due date).
 */
function cleanDescription(text: string | null | undefined, title: string) {
  const meta = /(\?|？|ঠিক আছে কি না|কি না বল|সেভ কর|save|confirm|হ্যাঁ|“না”|বদলাতে চাও|বদলাতে চান|priority|প্রায়োরিটি|অগ্রাধিকার|subject|সাবজেক্ট|due|শেষ তারিখ)/i;
  const kept = (text ?? "")
    .split(/(?<=[।.!?？\n])\s*/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !meta.test(sentence));
  const cleaned = kept.join(" ").trim();
  return cleaned.toLowerCase() === title.toLowerCase() ? "" : cleaned.slice(0, 2000);
}

function buildDraft(task: NonNullable<Intent["task"]>, subjects: StudyContext["subjects"]) {
  const title = task.title?.trim().slice(0, 160);
  if (!title) return null;
  const subject = findSubject(task.subject, subjects);
  let dueDate = "";
  let dueLabel = "";
  if (task.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
    const time = task.dueTime && /^\d{1,2}:\d{2}$/.test(task.dueTime) ? task.dueTime : null;
    const due = dayjs.tz(`${task.dueDate} ${time ?? "23:59"}`, "YYYY-MM-DD HH:mm", APP_TIMEZONE);
    if (due.isValid()) {
      dueDate = due.toISOString();
      dueLabel = due.format(time ? "D MMM YYYY, h:mm A" : "D MMM YYYY");
    }
  }
  const minutes = Math.round(task.estimatedMinutes ?? 30);
  const draft: TaskDraft = {
    title,
    description: cleanDescription(task.description, title),
    subjectId: subject?.id ?? "",
    subjectName: subject?.name ?? "",
    dueDate,
    dueLabel,
    priority: task.priority ?? "MEDIUM",
    estimatedMinutes: Math.min(Math.max(minutes, 1), 24 * 60),
  };
  const missingSubject = task.subject?.trim() && !subject ? task.subject.trim() : null;
  return { draft, missingSubject };
}

const priorityLabels = { LOW: "কম", MEDIUM: "মাঝারি", HIGH: "বেশি" } as const;

function confirmationText(draft: TaskDraft, missingSubject: string | null, lang?: "bn" | "en") {
  if (lang === "en") {
    const details = [draft.subjectName && `subject ${draft.subjectName}`, draft.dueLabel && `due ${draft.dueLabel}`, `${draft.priority.toLowerCase()} priority`].filter(Boolean).join(", ");
    const note = missingSubject ? ` I couldn't find a subject called “${missingSubject}”, so I left it without one.` : "";
    return `I'll create “${draft.title}” — ${details}.${note} Shall I save it? Say “yes” or “no”, or tell me what to change.`;
  }
  const details = [draft.subjectName && `subject ${draft.subjectName}`, draft.dueLabel && `শেষ তারিখ ${draft.dueLabel}`, `priority ${priorityLabels[draft.priority]}`].filter(Boolean).join(", ");
  const note = missingSubject ? ` “${missingSubject}” নামে কোনো subject পাইনি, তাই subject ছাড়া রাখছি।` : "";
  return `“${draft.title}” task বানাতে চাই — ${details}।${note} সেভ করবো? “হ্যাঁ” বা “না” বলুন, অথবা কী বদলাতে চান বলুন।`;
}

function completeText(title: string, lang: Lang) {
  return lang === "en" ? `Mark “${title}” as done? Say “yes” or “no”.` : `“${title}” শেষ হয়েছে বলে চিহ্নিত করবো? “হ্যাঁ” বা “না” বলো।`;
}

function reviseText(title: string, timesRevised: number, lang: Lang) {
  return lang === "en" ? `Count one more revision of “${title}” (${timesRevised} → ${timesRevised + 1})? Say “yes” or “no”.` : `“${title}” আরেকবার revise হিসেবে গুনবো (${timesRevised} → ${timesRevised + 1})? “হ্যাঁ” বা “না” বলো।`;
}

function timerText(minutes: number | null, label: string, lang: Lang) {
  if (lang === "en") return `Done — ${minutes ? `a ${minutes}-minute ` : "the "}timer is running${label ? ` for ${label}` : ""}. Focus up; I'll tell you when time's up.`;
  return `ঠিক আছে! ${label ? `${label}-এর জন্য ` : ""}${minutes ? `${minutes} মিনিটের ` : ""}timer চালু করলাম। মন দিয়ে পড়ো${minutes ? ", সময় শেষ হলে জানাবো" : ""}।`;
}

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

function buildApplication(application: NonNullable<Intent["application"]>): ApplicationDraft | null {
  const organization = application.organization?.trim().slice(0, 160);
  if (!organization) return null;
  const posts = [...new Set((application.posts ?? []).map((post) => post.trim()).filter(Boolean))].slice(0, 30);
  const title = (application.title?.trim() || `${organization}${posts.length ? ` — ${posts[0]}` : ""}`).slice(0, 200);
  const day = (value: string | null | undefined) => (value && dayPattern.test(value) && dayjs(value).isValid() ? value : "");
  const link = application.link?.trim() ?? "";
  return {
    title,
    organization,
    location: application.location?.trim().slice(0, 160) ?? "",
    posts,
    sector: application.sector ?? "GOVERNMENT",
    status: application.status ?? "APPLIED",
    appliedAt: day(application.appliedAt),
    deadline: day(application.deadline),
    examDate: day(application.examDate),
    reference: application.reference?.trim().slice(0, 120) ?? "",
    link: /^https?:\/\//.test(link) ? link.slice(0, 500) : "",
    notes: application.notes?.trim().slice(0, 2000) ?? "",
  };
}

function applicationText(draft: ApplicationDraft, lang: Lang) {
  const posts = draft.posts.join(", ");
  if (lang === "en") return `Add “${draft.title}” at ${draft.organization}${posts ? ` (${posts})` : ""} to your job list as ${draft.sector === "GOVERNMENT" ? "government" : "non-government"}? Say “yes”, or tell me what to change.`;
  return `“${draft.title}” (${draft.organization}${posts ? `, পদ: ${posts}` : ""}) তোমার Jobs তালিকায় ${draft.sector === "GOVERNMENT" ? "সরকারি" : "বেসরকারি"} হিসেবে যোগ করবো? “হ্যাঁ” বলো, অথবা কী বদলাতে হবে বলো।`;
}

function listChoices(names: string[], lang: Lang) {
  const list = names.map((name) => `“${name}”`).join(lang === "en" ? " or " : " নাকি ");
  return lang === "en" ? `Did you mean ${list}?` : `তুমি কি ${list} বোঝাচ্ছো?`;
}

function studyData(context: StudyContext) {
  return {
    counts: context.counts,
    pendingTasks: context.tasks.map((task) => ({ title: task.title, priority: task.priority, dueDate: task.dueDate, status: task.status, subject: task.subject?.name })),
    toRevise: context.toRevise.slice(0, 10).map((task) => ({ title: task.title, timesRevised: task.timesRevised, lastRevisedAt: task.lastRevisedAt })),
  };
}

async function drawImage(userId: string, intent: Intent, request: AssistantRequest): Promise<AssistantReply> {
  const lang = request.lang;
  const prompt = intent.imagePrompt?.trim() || request.message;
  const image = await generateImage(prompt, { userId });
  if (image === "unavailable") {
    return { type: "clarify", reply: lang === "en" ? "Image generation isn't turned on yet — an admin needs to enable an image model in OpenAI." : "ছবি বানানোর সুবিধা এখনো চালু নেই — admin-কে OpenAI-তে image model চালু করতে হবে।" };
  }
  if (!image) return { type: "clarify", reply: lang === "en" ? "I couldn't draw that right now. Please try again in a moment." : "এই মুহূর্তে ছবিটা বানাতে পারলাম না। একটু পরে আবার চেষ্টা করো।" };
  return { type: "image", image, reply: intent.reply.trim() || (lang === "en" ? "Here's your image." : "এই যে তোমার ছবি।") };
}

/** Longest note text sent to the AI to answer a question about it. */
const NOTE_QUESTION_CHARS = 20_000;

/**
 * The user's own note, found by title or by words in it, read back in full or used to answer a question.
 * The text comes straight from the database, so nothing in it is made up.
 */
async function readNote(userId: string, lookup: Intent["noteLookup"], notes: StudyContext["notes"], request: AssistantRequest): Promise<AssistantReply> {
  const lang = request.lang;
  const { match, ambiguous } = bestMatch(lookup?.title, notes, (note) => note.title);
  if (ambiguous.length) return { type: "clarify", reply: listChoices(ambiguous.map((note) => note.title), lang) };

  const search = (lookup?.search ?? []).map((word) => word.trim()).filter((word) => word.length >= 2).slice(0, 6);
  const note = match
    ? await prisma.note.findFirst({ where: { id: match.id, userId }, select: { title: true, plainText: true } })
    : search.length
      ? await prisma.note.findFirst({
        where: { userId, OR: search.flatMap((word) => [{ title: { contains: word, mode: "insensitive" as const } }, { plainText: { contains: word, mode: "insensitive" as const } }]) },
        orderBy: { updatedAt: "desc" },
        select: { title: true, plainText: true },
      })
      // "Read my note" with nothing more to go on: the one worked on last.
      : await prisma.note.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { title: true, plainText: true } });

  if (!note) {
    const recent = notes.slice(0, 5).map((item) => `“${item.title}”`).join(", ");
    return {
      type: "clarify",
      reply: lang === "en"
        ? `I couldn't find that in your notes.${recent ? ` Your recent notes: ${recent}. Which one?` : " You don't have any notes yet."}`
        : `তোমার notes-এ এটা খুঁজে পেলাম না।${recent ? ` সাম্প্রতিক notes: ${recent}। কোনটা?` : " এখনো কোনো note নেই।"}`,
    };
  }
  const text = note.plainText.trim();
  const speak = Boolean(lookup?.readAloud || request.voice);
  if (!text) return { type: "answer", speak, reply: lang === "en" ? `“${note.title}” is empty.` : `“${note.title}” note-টা এখনো ফাঁকা।` };

  if (lookup?.question?.trim()) {
    const prompt = `${persona}\n\nব্যবহারকারীর নিজের note “${note.title}”:\n"""\n${text.slice(0, NOTE_QUESTION_CHARS)}\n"""\n\nপ্রশ্ন: ${lookup.question}\n\nশুধু এই note-এর তথ্য দিয়ে উত্তর দাও; note-এ না থাকলে সেটা স্পষ্ট বলো, বানাবে না। ${languageRule(lang)} ${styleRule(request.voice)}`;
    const reply = await callAI(prompt, { userId, feature: "answer" });
    if (reply) return { type: "answer", speak, reply };
  }
  return { type: "answer", speak, reply: lang === "en" ? `From your note “${note.title}”:\n\n${text}` : `তোমার “${note.title}” note-এ লেখা আছে:\n\n${text}` };
}

async function answer(userId: string, message: string, history: ChatMessage[], context: StudyContext, voice?: boolean, lang?: "bn" | "en", attachment?: AssistantRequest["attachment"]) {
  const files = attachment ? [{ mimeType: attachment.mimeType, data: attachment.data, name: attachment.name }] : undefined;
  const basePrompt = `তুমি একজন স্বাভাবিক, বুদ্ধিমান বাংলা সহকারী। এটি একটি open-book conversation: ব্যবহারকারী পড়াশোনা ছাড়াও যেকোনো সাধারণ বা random প্রশ্ন করতে পারে। সাধারণ জ্ঞান, সাম্প্রতিক তথ্য, খবর, ব্যক্তি, জায়গা, প্রযুক্তি বা অন্য কোনো তথ্যের জন্য প্রয়োজন হলে তথ্য যাচাই করে উত্তর দাও। তুমি নিশ্চিত না হলে স্পষ্টভাবে বলবে, বানিয়ে বলবে না। ব্যবহারকারী বাংলায়, Banglish বা ইংরেজিতে লিখলেও সহজ স্বাভাবিক বাংলায় উত্তর দেবে; technical term দরকার হলে সহজ ব্যাখ্যা দেবে। কথার tone প্রসঙ্গ অনুযায়ী স্বাভাবিক, সহানুভূতিশীল, serious বা হালকা মজার হবে। আগের কথার ধারাবাহিকতা রাখবে।

আগের কথোপকথন:\n${formatHistory(history)}\n\nব্যবহারকারীর বর্তমান প্রশ্ন:\n${message}\n\nঅ্যাপের ব্যক্তিগত study data (শুধু app-related প্রশ্নে ব্যবহার করবে):\n${JSON.stringify(studyData(context))}\n\n${persona}\n${languageRule(lang)} ${styleRule(voice)}`;
  return await callAI(`${basePrompt}\n\nপ্রয়োজন হলে web search ব্যবহার করে current তথ্য যাচাই করো।`, { search: true, files, userId, feature: "answer_search" })
    ?? await callAI(`${basePrompt}\n\nWeb search এই মুহূর্তে unavailable হতে পারে। তোমার সাধারণ জ্ঞান ব্যবহার করে উত্তর দাও, তবে current তথ্য নিশ্চিত না হলে সেটা স্পষ্ট করে বলো।`, { files, userId, feature: "answer" });
}

const navigationRules: Array<{ pattern: RegExp; page: AssistantPage; reply: string }> = [
  { pattern: /(subject|subjects|সাবজেক্ট|বিষয়)/i, page: "subjects", reply: "চলো, subjects দেখি।" },
  { pattern: /(revision|রিভিশন|পুনরাবৃত্তি)/i, page: "revisions", reply: "চলো, revision-এর পাতায় যাই।" },
  { pattern: /(progress|প্রগ্রেস|অগ্রগতি|কতদূর)/i, page: "progress", reply: "তোমার progress দেখাচ্ছি।" },
  { pattern: /(timer|টাইমার|সময় ধর)/i, page: "timer", reply: "ঠিক আছে, timer খুলছি।" },
  { pattern: /(plan|প্ল্যান|পরিকল্পনা|রুটিন)/i, page: "plan", reply: "চলো, study plan দেখি।" },
  { pattern: /(dashboard|ড্যাশবোর্ড|হোম|মূল পাত)/i, page: "dashboard", reply: "চলো, dashboard-এ ফিরি।" },
];

/** Keyword rules used when the AI is not configured or not responding. */
function fallbackReply(message: string, context: StudyContext, lang?: "bn" | "en"): AssistantReply {
  const text = message.toLowerCase();
  const navigation = /(খোলো|খুলে|নিয়ে চলো|চলো|পাতায়|page|দেখাও|যাও|যাই|যেতে|দেখতে|চাই)/i.test(text);
  const wantsTask = /(task|টাস্ক|কাজ|কাজের তালিকা)/i.test(text);
  if (wantsTask && /(add|নতুন|যোগ|তৈরি|লিখ|বান|করতে চাই|করবো|করব|শুরু)/i.test(text)) return { type: "navigate", source: "fallback", href: assistantPages.new_task, reply: "ঠিক আছে, নতুন task-এর form খুলছি।" };
  if (wantsTask && navigation) return { type: "navigate", source: "fallback", href: assistantPages.tasks, reply: "চলো, task page-এ যাই।" };
  const rule = navigation ? navigationRules.find((item) => item.pattern.test(text)) : undefined;
  if (rule) return { type: "navigate", source: "fallback", href: assistantPages[rule.page], reply: rule.reply };

  if (/(পড়া|study|task|টাস্ক|কাজ|revision|রিভিশন|progress|প্রগ্রেস|বাকি|উচিত)/i.test(text)) {
    const firstTask = context.tasks[0]?.title;
    const reply = /(পড়া|study|উচিত)/i.test(text)
      ? firstTask ? `চলো, এখন “${firstTask}” দিয়েই শুরু করি। আগে ২৫ মিনিট মন দিয়ে এটা পড়ো, তারপর তারপর revision তালিকার ${context.toRevise.length}টি task থেকে একটি revise করো।` : "চলো ছোট করে শুরু করি: একটি subject যোগ করো, একটি task বানাও, তারপর ২৫ মিনিট পড়ো।"
      : `তোমার ${context.counts.completedTasks}টি task শেষ হয়েছে এবং ${context.counts.pendingTasks}টি বাকি। মোট ${context.counts.timesRevised} বার revise করেছ, আর ${context.counts.tasksToRevise}টি task revision তালিকায় আছে।`;
    return { type: "answer", source: "fallback", reply };
  }
  if (lang === "en") {
    return { type: "clarify", source: "fallback", reply: "The AI isn't responding right now, so I can only open pages for you — try “open tasks”. Please try again in a moment." };
  }
  return {
    type: "clarify",
    source: "fallback",
    reply: isAIConfigured()
      ? "AI service এই মুহূর্তে সাড়া দিচ্ছে না। এখন শুধু পাতা খোলা আর progress বলতে পারি; একটু পরে আবার চেষ্টা করুন।"
      : "AI এখনো চালু করা হয়নি, তাই আমি শুধু পাতা খোলা আর progress বলতে পারি। যেমন বলুন: “task পাতা খোলো”।",
  };
}

/** `onReplyDelta` receives the answer's text as the model writes it (answers and questions back only). */
export type RespondHooks = { onReplyDelta?: (text: string) => void };

export async function respond(userId: string, request: AssistantRequest, hooks: RespondHooks = {}): Promise<AssistantReply> {
  const reply = await decide(userId, request, hooks);
  reply.source ??= "ai";
  console.info(`[assistant] "${request.message.slice(0, 60)}" → ${reply.type}${reply.type === "confirm" ? `:${reply.action.kind}` : ""} [${reply.source}]`);
  return reply;
}

async function decide(userId: string, request: AssistantRequest, hooks: RespondHooks): Promise<AssistantReply> {
  const history = (request.history ?? []).slice(-10);
  const [counts, tasks, toRevise, subjects, openTasks, topics, notes] = await Promise.all([
    getProgressCounts(userId),
    getPendingTasks(userId),
    getTasksToRevise(userId, 100),
    getSubjects(userId),
    getOpenTasks(userId),
    getFlatTopics(userId),
    prisma.note.findMany({ where: { userId }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);
  const context: StudyContext = { counts, tasks, toRevise, subjects, openTasks, topics, notes };
  const lang = request.lang;

  const streamer = hooks.onReplyDelta ? createReplyStreamer(hooks.onReplyDelta) : null;
  const raw = await callAI(intentPrompt(request, history, context), {
    responseSchema: intentResponseSchema,
    onDelta: streamer ? (piece) => streamer.feed(piece) : undefined,
    files: request.attachment ? [{ mimeType: request.attachment.mimeType, data: request.attachment.data, name: request.attachment.name }] : undefined,
    userId,
    feature: request.attachment ? "file_assistant" : "assistant",
  });
  let intent: Intent | null = null;
  try { intent = raw ? intentSchema.parse(JSON.parse(raw)) : null; } catch { intent = null; }
  if (!intent) {
    console.info("[assistant] AI unavailable, using keyword fallback");
    return fallbackReply(request.message, context, request.lang);
  }

  // Background talk the mic picked up: no reply, nothing spoken, nothing more spent on it.
  if (intent.action === "ignore" && request.voice) return { type: "ignore", reply: "" };
  if (intent.action === "create_image") return await drawImage(userId, intent, request);
  if (intent.action === "read_note") return await readNote(userId, intent.noteLookup, context.notes, request);
  if (intent.action === "navigate" && intent.page) {
    return { type: "navigate", href: assistantPages[intent.page], reply: intent.reply || (request.lang === "en" ? "Sure, opening it." : "ঠিক আছে, খুলছি।") };
  }
  if (intent.action === "create_task") {
    const built = intent.task ? buildDraft(intent.task, subjects) : null;
    if (!built) return { type: "clarify", reply: intent.reply || (request.lang === "en" ? "Which task should I create? What's it called?" : "কোন task বানাবো? task-এর নামটা বলবে?") };
    return { type: "confirm", action: { kind: "create_task", draft: built.draft }, reply: confirmationText(built.draft, built.missingSubject, request.lang) };
  }
  if (intent.action === "complete_task") {
    const { match, ambiguous } = bestMatch(intent.taskTitle, openTasks, (task) => task.title);
    if (ambiguous.length) return { type: "clarify", reply: listChoices(ambiguous.map((task) => task.title), lang) };
    if (!match) return { type: "clarify", reply: intent.reply || (lang === "en" ? "I couldn't find that task among your unfinished ones. Which one did you finish?" : "অসমাপ্ত task-গুলোর মধ্যে এটা খুঁজে পেলাম না। কোনটা শেষ করেছ?") };
    return { type: "confirm", action: { kind: "complete_task", taskId: match.id, title: match.title, subjectName: match.subject?.name ?? "" }, reply: completeText(match.title, lang) };
  }
  if (intent.action === "start_timer") {
    const subject = findSubject(intent.timer?.subject, subjects);
    const topic = bestMatch(intent.timer?.topic, subject ? topics.filter((item) => item.subjectId === subject.id) : topics, (item) => item.name).match;
    const minutes = intent.timer?.minutes ? Math.min(Math.max(Math.round(intent.timer.minutes), 1), 300) : null;
    const subjectName = subject?.name ?? topic?.subject.name ?? "";
    return {
      type: "start_timer",
      timer: { minutes, subjectId: subject?.id ?? topic?.subjectId ?? "", subjectName, topicId: topic?.id ?? "", topicName: topic?.name ?? "" },
      reply: timerText(minutes, topic?.name ?? subjectName, lang),
    };
  }
  if (intent.action === "create_note") {
    const content = sanitizeNoteHtml(intent.note?.content ?? "");
    const preview = htmlToPlainText(content);
    if (!preview) return { type: "clarify", reply: intent.reply || (lang === "en" ? "What should the note say?" : "Note-এ কী লিখবো?") };
    const title = (intent.note?.title?.trim() || preview.split("\n")[0]).slice(0, 200);
    const ask = lang === "en" ? `Save this as a note called “${title}”? Say “yes”, or tell me what to change.` : `“${title}” নামে note হিসেবে সেভ করবো? “হ্যাঁ” বলো, অথবা কী বদলাতে হবে বলো।`;
    return { type: "confirm", action: { kind: "create_note", title, content, preview: preview.slice(0, 600) }, reply: ask };
  }
  if (intent.action === "add_application") {
    const draft = intent.application ? buildApplication(intent.application) : null;
    if (!draft) return { type: "clarify", reply: intent.reply || (lang === "en" ? "Which organization did you apply to, and for which post?" : "কোন প্রতিষ্ঠানে, কোন পদে apply করেছ?") };
    return { type: "confirm", action: { kind: "add_application", draft }, reply: applicationText(draft, lang) };
  }
  if (intent.action === "revise_task") {
    const { match, ambiguous } = bestMatch(intent.taskTitle, toRevise, (task) => task.title);
    if (ambiguous.length) return { type: "clarify", reply: listChoices(ambiguous.map((task) => task.title), lang) };
    if (!match) return { type: "clarify", reply: intent.reply || (lang === "en" ? "I couldn't find that among your finished tasks. Which task did you revise?" : "শেষ হওয়া task-গুলোর মধ্যে এটা পেলাম না। কোন task revise করেছ?") };
    return { type: "confirm", action: { kind: "revise_task", taskId: match.id, title: match.title, timesRevised: match.timesRevised }, reply: reviseText(match.title, match.timesRevised, lang) };
  }
  if (intent.action === "clarify") {
    return { type: "clarify", reply: intent.reply || (request.lang === "en" ? "I didn't quite get that — could you say it another way?" : "কথাটা পুরোপুরি বুঝিনি। একটু অন্যভাবে বলবে?") };
  }
  // Normally the intent call already contains the answer; only ask again (with web search) if it came back empty.
  if (intent.reply.trim()) return { type: "answer", reply: intent.reply.trim() };
  const reply = await answer(userId, request.message, history, context, request.voice, request.lang, request.attachment);
  return reply ? { type: "answer", reply } : fallbackReply(request.message, context, request.lang);
}
