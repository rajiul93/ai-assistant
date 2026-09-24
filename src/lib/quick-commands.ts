import { assistantPages, type AssistantPage } from "@/lib/assistant-types";

export type QuickCommand =
  | { kind: "navigate"; page: AssistantPage; href: string }
  | { kind: "refresh" | "back" };

// Speech recognition writes English words in Bengali script too ("ড্যাশবোর্ড", "রিলোড"), so list both.
// Matching is fuzzy, so a slightly slurred "ডেসবোর্ড" or "ড্যাশ বোর্ড" still counts.
const pageKeywords: Array<{ page: AssistantPage; words: string[] }> = [
  { page: "dashboard", words: ["dashboard", "ড্যাশবোর্ড", "home", "হোম", "হোমপেজ"] },
  { page: "tasks", words: ["task", "tasks", "টাস্ক", "todo", "কাজের তালিকা"] },
  { page: "subjects", words: ["subject", "subjects", "সাবজেক্ট", "বিষয়গুলো"] },
  { page: "revisions", words: ["revision", "revisions", "রিভিশন"] },
  { page: "progress", words: ["progress", "প্রগ্রেস", "প্রোগ্রেস", "অগ্রগতি"] },
  { page: "timer", words: ["timer", "টাইমার", "pomodoro", "পোমোডোরো"] },
  { page: "plan", words: ["plan", "প্ল্যান", "প্লান", "পরিকল্পনা", "রুটিন", "routine"] },
  { page: "jobs", words: ["jobs", "job", "জব", "জবস", "চাকরি", "চাকরির", "applications", "অ্যাপ্লিকেশন"] },
];

const refreshWords = ["reload", "refresh", "রিলোড", "রিফ্রেশ", "রিলোডে"];
// Whole words only: Bengali has no regex word boundary, and "প্ল্যান" contains "যান".
const goWords = ["যাও", "যাই", "যান", "যাবো", "চলো", "চল", "খোলো", "খুলো", "খোল", "খুলে", "খুলুন", "ওপেন", "open", "go", "show", "navigate", "দেখাও", "দেখি", "দেখান", "পেজ", "পেইজ", "পাতা", "পাতায়", "page"];
const backWords = ["পিছনে", "পেছনে", "ব্যাক", "back", "previous"];
// Requests to create or change something need the AI, not a page jump.
const actionWords = ["বানাও", "বানিয়ে", "বানা", "তৈরি", "যোগ", "add", "create", "make", "new", "নতুন", "লিখে", "লেখো", "সেভ", "save", "মুছে", "মুছো", "delete", "ডিলিট", "remind", "করে দাও", "কিভাবে", "কীভাবে", "কেন", "কী", "কি", "how", "why", "what"];

function hasWord(text: string, list: string[]) {
  const words = new Set(text.split(" ").flatMap((word) => [word, stem(word)]));
  return list.some((item) => (item.includes(" ") ? text.includes(item) : words.has(item)));
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFC").replace(/[\u200c\u200d]/g, "").replace(/[।,.!?;:"'“”‘’()-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Collapse letters that sound alike in Bengali, so small mishearings still compare as equal. */
function phonetic(word: string) {
  return word
    .replace(/্য/g, "") // য-ফলা: ড্যাশ ≈ ডাশ
    .replace(/র্/g, "") // রেফ: বোর্ড ≈ বোড
    .replace(/[শষ]/g, "স")
    .replace(/ণ/g, "ন")
    .replace(/[ড়ঢ়]/g, "র")
    .replace(/ী/g, "ি")
    .replace(/ূ/g, "ু")
    .replace(/[ঁং]/g, "")
    .replace(/য়/g, "য");
}

/** Drop common Bengali case endings ("ড্যাশবোর্ডে" → "ড্যাশবোর্ড"). */
function stem(word: string) {
  return word.replace(/(গুলোতে|গুলো|গুলি|টাতে|টায়|টা|টি|েতে|তে|য়ে|ের|এর|ে|এ|য়|s)$/u, "");
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function similar(rawWord: string, rawKeyword: string) {
  if (rawWord === rawKeyword) return true;
  const word = phonetic(rawWord);
  const keyword = phonetic(rawKeyword);
  if (word === keyword) return true;
  if (keyword.length < 4) return false; // short words must match exactly
  const distance = editDistance(word, keyword);
  return distance / Math.max(word.length, keyword.length) <= (keyword.length >= 7 ? 0.3 : 0.2);
}

/** Candidate words: every word, its stem, and adjacent pairs joined (for "ড্যাশ বোর্ড"). */
function candidates(text: string) {
  const words = text.split(" ");
  const joined = words.slice(1).map((word, index) => words[index] + word);
  return [...new Set([...words, ...words.map(stem), ...joined, ...joined.map(stem)])].filter(Boolean);
}

function containsKeyword(text: string, keywords: string[]) {
  if (keywords.some((keyword) => keyword.includes(" ") && text.includes(keyword))) return true;
  const words = candidates(text);
  return keywords.some((keyword) => words.some((word) => similar(word, keyword)));
}

function matchOne(input: string): QuickCommand | null {
  const text = normalize(input);
  if (!text || text.length > 60) return null;
  if (containsKeyword(text, refreshWords)) return { kind: "refresh" };
  const wordCount = text.split(" ").length;
  if (hasWord(text, backWords) || text.includes("আগের পাতা") || text.includes("আগের পেজ") || text.includes("go back")) return { kind: "back" };
  // Page jumps are short commands; longer sentences and questions are conversations for the AI.
  if (wordCount > 6 || hasWord(text, actionWords)) return null;
  const match = pageKeywords.find((item) => containsKeyword(text, item.words));
  if (!match) return null;
  // Either a clear "go/open" word, or the user just said the page name ("ড্যাশবোর্ড").
  if (!hasWord(text, goWords) && wordCount > 2) return null;
  return { kind: "navigate", page: match.page, href: assistantPages[match.page] };
}

/** Simple app commands handled instantly on the device, checked against every way the mic heard it. */
export function matchQuickCommand(transcripts: string[]): QuickCommand | null {
  for (const transcript of transcripts) {
    const command = matchOne(transcript);
    if (command) return command;
  }
  return null;
}
