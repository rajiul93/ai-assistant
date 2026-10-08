"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ClipboardPaste, ImageIcon, Loader2, Plus, ScanText, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ImageViewer } from "@/components/image-viewer";
import { DictateButton, readFile, ReviewChips } from "@/components/preliminary/question-set-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isAllowedType } from "@/lib/attachments";
import { pageTiles } from "@/lib/page-tiles";
import {
  addShortDoubts,
  mergeShortReadings,
  parseShortText,
  shortReviewCount,
  spokenShortLine,
  type DraftShortQuestion,
  type ExtractedShortQuestion,
  type ReviewedShortQuestion,
} from "@/lib/short-questions";
import { useBestMic } from "@/lib/use-best-mic";
import { cn } from "@/lib/utils";
import { createShortQuestionSet, updateShortQuestionSet } from "@/server/actions/short-questions";

const emptyQuestion = (): ReviewedShortQuestion => ({ text: "", answer: "" });

type Reading = { topic: string | null; questions: ExtractedShortQuestion[] };

async function readPage(body: object): Promise<Reading> {
  const response = await fetch("/api/short-questions/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json().catch(() => ({}))) as Reading & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "পাতাটা পড়া গেল না।");
  return payload;
}

/** A page read twice, independently, so anything the two readings disagree on is shown instead of trusted. */
async function readPageTwice(file: File): Promise<{ topic: string | null; questions: ReviewedShortQuestion[] }> {
  let first: Reading;
  let second: Reading;
  if (file.type === "application/pdf") {
    const body = { files: [{ name: file.name, mimeType: file.type, data: await readFile(file) }] };
    [first, second] = await Promise.all([readPage(body), readPage(body)]);
  } else {
    const [coarse, fine] = await Promise.all([pageTiles(file, { rows: 4, targetWidth: 1300 }), pageTiles(file, { rows: 5, targetWidth: 1700 })]);
    const request = (tiles: typeof coarse) => readPage({ files: tiles.tiles.map((data, index) => ({ name: `${file.name}-${index + 1}.jpg`, mimeType: "image/jpeg", data })), layout: { columns: tiles.columns, rows: tiles.rows } });
    [first, second] = await Promise.all([request(coarse), request(fine)]);
  }
  const merged = mergeShortReadings(first.questions, second.questions);
  const doubts = await fetch("/api/short-questions/spellcheck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions: merged.map(({ text, answer }) => ({ text, answer })) }) })
    .then(async (response) => (response.ok ? ((await response.json()) as { suspicious?: Array<{ question: number; field: number; word: string }> }).suspicious ?? [] : []))
    .catch(() => []);
  return { topic: first.topic ?? second.topic, questions: addShortDoubts(merged, doubts) };
}

/** "topic", "paste", "q2" (question 3) or "a2" (its answer). */
type DictationTarget = "topic" | "paste" | `q${number}` | `a${number}`;
const joinSpoken = (current: string, said: string) => (current.trim() ? `${current.trimEnd()} ${said}` : said);
const withoutDanda = (said: string) => said.trim().replace(/[।.]$/, "");

const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400";

/** Create or edit a short-question set: subject, date, topic and question–answer pairs. */
export function ShortQuestionForm({ subjects, initial }: {
  subjects: Array<{ id: string; name: string }>;
  initial?: { id: string; subjectId: string | null; date: string; topicName: string; questions: DraftShortQuestion[] };
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }));
  const [topicName, setTopicName] = useState(initial?.topicName ?? "");
  const [questions, setQuestions] = useState<ReviewedShortQuestion[]>(initial?.questions.length ? initial.questions : [emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [reading, setReading] = useState<string | null>(null);
  const [pages, setPages] = useState<Array<{ src: string; name: string }>>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [confirmUnchecked, setConfirmUnchecked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Voice typing: one mic for the whole form, pointed at whichever field's mic was tapped.
  const [dictating, setDictating] = useState<DictationTarget | null>(null);
  const [heard, setHeard] = useState("");
  const dictatingRef = useRef<DictationTarget | null>(null);
  const endDictation = () => { dictatingRef.current = null; setDictating(null); setHeard(""); };
  const mic = useBestMic({
    context: () => {
      const target = dictatingRef.current;
      if (target === "topic") return "Topic name of a Bangladesh job-exam question set";
      if (target === "paste") return "Dictating short questions, each followed by its answer starting with উত্তর";
      return target?.startsWith("a") ? "The answer to a short exam question" : "A short exam question";
    },
    onInterim: setHeard,
    onResult: (said) => { const target = dictatingRef.current; endDictation(); if (target) insertSpoken(target, said); },
    onError: (error) => { endDictation(); toast.error(error.message); },
  });
  function dictate(target: DictationTarget) {
    mic.stop();
    if (dictatingRef.current === target) { endDictation(); return; }
    dictatingRef.current = target;
    setDictating(target);
    setHeard("");
    mic.start();
  }

  /** Resolves one flagged field (the user picked, typed or accepted it). */
  const settle = (question: ReviewedShortQuestion, part: "text" | "answer" | "onlyOnce"): ReviewedShortQuestion => {
    if (!question.review) return question;
    const review = { ...question.review };
    delete review[part];
    if (review.words) { review.words = { ...review.words }; delete review.words[part === "text" ? 0 : 1]; if (!Object.keys(review.words).length) delete review.words; }
    return { ...question, review: Object.keys(review).length ? review : undefined };
  };
  const setField = (index: number, part: "text" | "answer", value: string) => setQuestions((list) => list.map((question, position) => (position === index ? settle({ ...question, [part]: value }, part) : question)));
  const accept = (index: number, part: "text" | "answer" | "onlyOnce") => setQuestions((list) => list.map((question, position) => (position === index ? settle(question, part) : question)));
  const unchecked = shortReviewCount(questions);
  const keepFilled = (list: ReviewedShortQuestion[]) => list.filter((question) => question.text.trim() || question.answer.trim());

  function insertSpoken(target: DictationTarget, said: string) {
    if (target === "topic") { setTopicName((value) => joinSpoken(value, withoutDanda(said))); return; }
    if (target === "paste") { setPasteText((value) => (value.trim() ? `${value.trimEnd()}\n${spokenShortLine(said)}` : spokenShortLine(said))); return; }
    const part = target.startsWith("a") ? "answer" : "text";
    const index = Number(target.slice(1));
    setQuestions((list) => list.map((question, position) => (position === index ? settle({ ...question, [part]: joinSpoken(question[part], part === "answer" ? withoutDanda(said) : said.trim()) }, part) : question)));
  }

  async function readImages(files: FileList | null) {
    const list = Array.from(files ?? []).filter((file) => isAllowedType(file.type));
    if (!list.length) { toast.error("ছবি (JPG, PNG, WebP) বা PDF দাও।"); return; }
    setPasteOpen(false);
    const added: ReviewedShortQuestion[] = [];
    let topic: string | null = null;
    try {
      for (const [index, file] of list.entries()) {
        setReading(list.length > 1 ? `পাতা ${index + 1}/${list.length} পড়া হচ্ছে…` : "AI পাতাটা পড়ছে…");
        const result = await readPageTwice(file);
        added.push(...result.questions);
        topic ??= result.topic;
        if (file.type.startsWith("image/")) setPages((value) => [...value, { src: URL.createObjectURL(file), name: file.name }]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "পাতাটা পড়া গেল না।");
    } finally {
      setReading(null);
    }
    if (!added.length) return;
    setQuestions((current) => [...keepFilled(current), ...added]);
    if (topic && !topicName.trim()) setTopicName(topic);
    const flags = shortReviewCount(added);
    const noAnswer = added.filter((question) => !question.answer.trim()).length;
    toast.success(`${added.length}টি প্রশ্ন যোগ হলো${flags ? ` · ${flags} জায়গা মিলিয়ে দেখো` : ""}${noAnswer ? ` · ${noAnswer}টির উত্তর পাতায় নেই — লিখে দাও` : ""}`, { duration: 8000 });
  }

  const problems = questions.map((question) => (!question.text.trim() ? "প্রশ্ন লেখো" : !question.answer.trim() ? "উত্তর লেখো" : null));
  const ready = subjectId && date && topicName.trim() && problems.every((problem) => !problem);

  async function save(force = false) {
    setShowErrors(true);
    if (!ready) { toast.error("লাল চিহ্ন দেওয়া জায়গাগুলো ঠিক করো।"); return; }
    if (unchecked && !force) { setConfirmUnchecked(true); return; }
    setSaving(true);
    try {
      const payload = { subjectId, date, topicName, questions: questions.map(({ text, answer }) => ({ text, answer })) };
      if (initial) { await updateShortQuestionSet(initial.id, payload); toast.success("Set সেভ হলো"); router.push("/short-questions"); }
      else { await createShortQuestionSet(payload); toast.success("Set বানানো হলো — Todo-তে আছে"); router.push("/short-questions?status=todo"); }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the set.");
    } finally {
      setSaving(false);
    }
  }

  const [sorting, setSorting] = useState(false);

  /** The page's own parser first (free, instant); text it can't fully follow goes to AI to sort out. */
  async function addPasted() {
    const local = parseShortText(pasteText);
    let added: ReviewedShortQuestion[] = local.questions;
    let note = local.skipped ? ` · ${local.skipped}টি বোঝা যায়নি (উত্তর নেই)` : "";
    if (local.skipped || !local.questions.length) {
      setSorting(true);
      try {
        const response = await fetch("/api/short-questions/parse-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: pasteText }) });
        const payload = (await response.json().catch(() => ({}))) as { questions?: ExtractedShortQuestion[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "AI লেখাটা সাজাতে পারল না।");
        const sorted = payload.questions ?? [];
        if (sorted.length >= local.questions.length) {
          added = sorted;
          const noAnswer = sorted.filter((question) => !question.answer.trim()).length;
          note = ` · AI সাজিয়েছে${noAnswer ? ` · ${noAnswer}টির উত্তর লেখায় নেই — লিখে দাও` : ""}`;
        }
      } catch (error) {
        if (!local.questions.length) { toast.error(error instanceof Error ? error.message : "কোনো প্রশ্ন চিনতে পারিনি।"); return; }
      } finally {
        setSorting(false);
      }
    }
    if (!added.length) { toast.error("কোনো প্রশ্ন চিনতে পারিনি। নিচের উদাহরণের মতো লিখে দেখো।"); return; }
    setQuestions((list) => [...keepFilled(list), ...added]);
    setPasteOpen(false);
    setPasteText("");
    toast.success(`${added.length}টি প্রশ্ন যোগ হলো${note}`, { duration: 6000 });
  }

  return <div className="mx-auto max-w-3xl space-y-4 pb-24">
    <Link href="/short-questions" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="size-4" /> Short Question</Link>
    <h1 className="text-2xl font-semibold tracking-tight">{initial ? "Set edit করো" : "নতুন short question set"}</h1>

    <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2">
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-600">Subject</span>
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={cn(field, "h-11", showErrors && !subjectId && "border-red-400")}>
          <option value="">বেছে নাও…</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        {!subjects.length ? <p className="text-xs text-amber-700">আগে <Link href="/subjects" className="underline">Subjects</Link> পাতায় একটা subject যোগ করো।</p> : null}
      </label>
      <label className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-600">তারিখ</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={cn(field, "h-11", showErrors && !date && "border-red-400")} />
      </label>
      <label className="space-y-1.5 sm:col-span-2">
        <span className="text-xs font-medium text-zinc-600">Topic-এর নাম</span>
        <div className="relative">
          <input value={topicName} onChange={(event) => setTopicName(event.target.value)} maxLength={160} placeholder="যেমন: বাংলা সাহিত্য — গুরুত্বপূর্ণ তথ্য" className={cn(field, "h-11", mic.supported && "pr-11", showErrors && !topicName.trim() && "border-red-400")} />
          {mic.supported ? <DictateButton active={dictating === "topic"} onClick={() => dictate("topic")} label="Topic" className="absolute right-1.5 top-1.5" /> : null}
        </div>
      </label>
    </section>

    <div className="flex items-center justify-between gap-2">
      <h2 className="font-semibold">প্রশ্ন ({questions.length})</h2>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={Boolean(reading)} className="flex h-9 items-center gap-1.5 rounded-xl bg-zinc-950 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"><ScanText className="size-4" /> ছবি থেকে (AI)</button>
        <button type="button" onClick={() => setPasteOpen(true)} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"><ClipboardPaste className="size-4" /> একসাথে paste করো</button>
      </div>
    </div>
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(event) => { void readImages(event.target.files); event.target.value = ""; }} />

    {reading ? <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status">
      <Loader2 className="size-5 shrink-0 animate-spin" />
      <div><p className="font-medium">{reading}</p><p className="text-xs text-indigo-700">নির্ভুল করতে পাতাটা দুইভাবে পড়ে বানান যাচাই করা হচ্ছে — ১৫–৪০ সেকেন্ড লাগতে পারে।</p></div>
    </div> : null}

    {unchecked ? <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:top-4">
      <AlertTriangle className="size-4 shrink-0" />
      <p className="min-w-0 flex-1"><span className="font-semibold">{unchecked} জায়গা মিলিয়ে দেখো।</span> AI দুইবার পড়ে এগুলোতে আলাদা লেখা পেয়েছে — ছবির সাথে মিলিয়ে ঠিকটা বাছো বা লিখে দাও।</p>
      {pages.length ? <button type="button" onClick={() => setViewing(0)} className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-medium ring-1 ring-amber-300"><ImageIcon className="size-3.5" /> পাতার ছবি</button> : null}
    </div> : pages.length ? <div className="flex justify-end"><button type="button" onClick={() => setViewing(0)} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200"><ImageIcon className="size-3.5" /> পাতার ছবি দেখো</button></div> : null}

    <ol className="space-y-3">
      {questions.map((question, index) => <li key={index} className={cn("rounded-2xl border bg-white p-4", showErrors && problems[index] ? "border-red-300" : question.review ? "border-amber-300" : "border-zinc-200")}>
        {question.review?.onlyOnce ? <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"><AlertTriangle className="size-3.5 shrink-0" /><span className="flex-1">এই প্রশ্নটা AI একবারই পেয়েছে — পুরোটা ছবির সাথে মিলিয়ে নাও।</span><button type="button" onClick={() => accept(index, "onlyOnce")} className="flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-white"><Check className="size-3.5" /> মিলিয়েছি</button></div> : null}
        <div className="flex items-start gap-2">
          <span className="mt-2.5 w-6 shrink-0 text-sm font-semibold text-zinc-400 tabular-nums">{index + 1}.</span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="relative">
              <textarea value={question.text} onChange={(event) => setField(index, "text", event.target.value)} rows={2} placeholder={mic.supported ? "প্রশ্ন লেখো বা 🎤 চেপে বলো" : "প্রশ্ন লেখো"} aria-label={`প্রশ্ন ${index + 1}`} className={cn(field, "min-h-14 resize-y py-2.5 leading-relaxed", mic.supported && "pr-11", question.review?.text && "border-amber-400 ring-2 ring-amber-100")} />
              {mic.supported ? <DictateButton active={dictating === `q${index}`} onClick={() => dictate(`q${index}`)} label={`প্রশ্ন ${index + 1}`} className="absolute right-1.5 top-1.5" /> : null}
            </div>
            {question.review?.text ? <ReviewChips label="প্রশ্ন:" readings={question.review.text} current={question.text} word={question.review.words?.[0]} onPick={(value) => setField(index, "text", value)} onAccept={() => accept(index, "text")} /> : null}
            <div className={cn("relative rounded-xl", question.answer.trim() ? "bg-emerald-50" : "")}>
              <span className="pointer-events-none absolute left-3 top-2.5 text-xs font-semibold text-emerald-700">উত্তর</span>
              <textarea value={question.answer} onChange={(event) => setField(index, "answer", event.target.value)} rows={1} placeholder={mic.supported ? "উত্তর লেখো বা 🎤 চেপে বলো" : "উত্তর লেখো"} aria-label={`প্রশ্ন ${index + 1}-এর উত্তর`} className={cn(field, "min-h-11 resize-y bg-transparent py-2.5 pl-14 leading-relaxed", mic.supported && "pr-11", question.answer.trim() ? "border-emerald-300" : showErrors ? "border-red-400" : "", question.review?.answer && "border-amber-400 ring-2 ring-amber-100")} />
              {mic.supported ? <DictateButton active={dictating === `a${index}`} onClick={() => dictate(`a${index}`)} label={`প্রশ্ন ${index + 1}-এর উত্তর`} className="absolute right-1.5 top-1.5" /> : null}
            </div>
            {question.review?.answer ? <ReviewChips label="উত্তর:" readings={question.review.answer} current={question.answer} word={question.review.words?.[1]} onPick={(value) => setField(index, "answer", value)} onAccept={() => accept(index, "answer")} /> : null}
          </div>
          {questions.length > 1 ? <button type="button" onClick={() => setQuestions((list) => list.filter((_, position) => position !== index))} aria-label={`প্রশ্ন ${index + 1} মুছে ফেলো`} className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button> : null}
        </div>
        {showErrors && problems[index] ? <p className="mt-2 pl-8 text-xs text-red-600">{problems[index]}</p> : null}
      </li>)}
    </ol>

    <button type="button" onClick={() => setQuestions((list) => [...list, emptyQuestion()])} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-white"><Plus className="size-4" /> প্রশ্ন যোগ করো</button>

    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        {dictating ? <p role="status" className="flex min-w-0 items-center gap-2 text-xs font-medium text-red-600"><span className="size-2 shrink-0 animate-pulse rounded-full bg-red-500" /><span className="truncate">{heard && heard !== "…" ? heard : "শুনছি… বলো"}</span></p>
          : <p className="text-xs text-zinc-500">{questions.length}টি প্রশ্ন · {problems.filter((problem) => !problem).length}টি সম্পূর্ণ{unchecked ? <span className="font-medium text-amber-700"> · {unchecked} যাচাই বাকি</span> : null}</p>}
        <button type="button" onClick={() => void save()} disabled={saving} className="h-11 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? "Saving…" : initial ? "সেভ করো" : "Set বানাও"}</button>
      </div>
    </div>

    <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>অনেক প্রশ্ন একসাথে</DialogTitle></DialogHeader>
        <button type="button" onClick={() => fileRef.current?.click()} className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-left transition hover:border-indigo-400">
          <ScanText className="size-8 shrink-0 text-indigo-600" />
          <span><span className="block text-sm font-semibold text-indigo-950">ছবি বা PDF দাও — AI সব প্রশ্ন আর উত্তর বসিয়ে দেবে</span><span className="block text-xs text-indigo-800">বই/গাইড/নোটের পাতার ছবি। পাতায় যে উত্তর লেখা আছে সেটাই বসবে; যেখানে AI নিশ্চিত নয় সেটা দেখিয়ে দেবে।</span></span>
        </button>
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-xs leading-relaxed text-zinc-500">অথবা লিখে দাও যেকোনোভাবে — পরের লাইনে “উত্তর: …”, বা “১. প্রশ্ন: উত্তর ২. প্রশ্ন: উত্তর” এক লাইনেই; না বুঝলে AI সাজিয়ে দেবে।{mic.supported ? " 🎤 চেপে বলেও লেখা যায় — প্রশ্ন বলো, তারপর আবার 🎤 চেপে “উত্তর হলো …”।" : ""}</p>
          {mic.supported ? <DictateButton active={dictating === "paste"} onClick={() => dictate("paste")} label="প্রশ্নগুলো" className="ring-1 ring-zinc-200" /> : null}
        </div>
        {dictating === "paste" ? <p role="status" className="mb-2 text-xs font-medium text-red-600">{heard && heard !== "…" ? heard : "শুনছি… বলো"}</p> : null}
        <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={12} autoFocus placeholder={"১. বাংলা একাডেমি কবে প্রতিষ্ঠিত হয়?\nউত্তর: ৩ ডিসেম্বর ১৯৫৫\n\n২. ‘অগ্নিবীণা’ কাব্যের রচয়িতা কে?\nউত্তর: কাজী নজরুল ইসলাম"} className={cn(field, "py-2.5 font-mono text-[13px] leading-relaxed")} />
        <button type="button" onClick={() => void addPasted()} disabled={!pasteText.trim() || sorting} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{sorting ? <><Loader2 className="size-4 animate-spin" /> AI লেখাটা সাজাচ্ছে…</> : "প্রশ্নগুলো যোগ করো"}</button>
      </DialogContent>
    </Dialog>

    {viewing !== null && pages[viewing] ? <ImageViewer images={pages} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} /> : null}

    <AlertDialog open={confirmUnchecked} onOpenChange={setConfirmUnchecked}>
      <AlertDialogContent>
        <AlertDialogTitle>{unchecked} জায়গা এখনো মিলিয়ে দেখা হয়নি</AlertDialogTitle>
        <AlertDialogDescription>হলুদ দাগ দেওয়া জায়গায় AI দুইবার আলাদা লেখা পড়েছে — বানান ভুল থাকতে পারে। তবু সেভ করবে?</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>মিলিয়ে দেখি</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setConfirmUnchecked(false); void save(true); }}>তবু সেভ করো</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
