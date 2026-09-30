"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ClipboardPaste, ImageIcon, Loader2, Plus, ScanText, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ImageViewer } from "@/components/image-viewer";
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
import { addDoubts, mergeReadings, OPTION_LETTERS, parseMcqText, reviewCount, type DraftQuestion, type ExtractedQuestion, type ReviewedQuestion } from "@/lib/preliminary";
import { cn } from "@/lib/utils";
import { createQuestionSet, updateQuestionSet } from "@/server/actions/preliminary";

const emptyQuestion = (): ReviewedQuestion => ({ text: "", options: ["", "", "", ""], correctIndex: -1 });

type Reading = { topic: string | null; questions: ExtractedQuestion[] };

async function readFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/** One AI reading of a page; throws with the server's message on failure. */
async function readPage(body: object): Promise<Reading> {
  const response = await fetch("/api/preliminary/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = (await response.json().catch(() => ({}))) as Reading & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "পাতাটা পড়া গেল না।");
  return payload;
}

/**
 * A page read twice, independently — once in larger pieces, once in smaller, more enlarged ones —
 * so that anything the two readings disagree on can be shown to the user instead of trusted.
 */
async function readPageTwice(file: File): Promise<{ topic: string | null; questions: ReviewedQuestion[] }> {
  let first: Reading;
  let second: Reading;
  if (file.type === "application/pdf") {
    const data = await readFile(file);
    const body = { files: [{ name: file.name, mimeType: file.type, data }] };
    [first, second] = await Promise.all([readPage(body), readPage(body)]);
  } else {
    const [coarse, fine] = await Promise.all([pageTiles(file, { rows: 4, targetWidth: 1300 }), pageTiles(file, { rows: 5, targetWidth: 1700 })]);
    const request = (tiles: typeof coarse) => readPage({ files: tiles.tiles.map((data, index) => ({ name: `${file.name}-${index + 1}.jpg`, mimeType: "image/jpeg", data })), layout: { columns: tiles.columns, rows: tiles.rows } });
    [first, second] = await Promise.all([request(coarse), request(fine)]);
  }
  const merged = mergeReadings(first.questions, second.questions);
  // A last look at the words themselves: both readings can make the same mistake.
  const doubts = await fetch("/api/preliminary/spellcheck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions: merged.map(({ text, options }) => ({ text, options })) }) })
    .then(async (response) => (response.ok ? ((await response.json()) as { suspicious?: Array<{ question: number; field: number; word: string }> }).suspicious ?? [] : []))
    .catch(() => []);
  return { topic: first.topic ?? second.topic, questions: addDoubts(merged, doubts) };
}

/** A field the two readings disagreed on: both readings to pick from, or keep what is typed now. */
function ReviewChips({ label, readings, current, word, onPick, onAccept }: { label: string; readings: string[]; current: string; word?: string; onPick: (value: string) => void; onAccept: () => void }) {
  return <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
    <AlertTriangle className="size-3.5 shrink-0" />
    <span className="font-medium">{label}</span>
    {word ? <span>বানান সন্দেহজনক: <span className="font-semibold">“{word}”</span> — ছবির সাথে মিলিয়ে দেখো</span> : null}
    {readings.length > 1 ? readings.map((reading, index) => <button key={index} type="button" onClick={() => onPick(reading)} className={cn("rounded-md px-2 py-1 text-[13px] ring-1 transition", reading === current ? "bg-white font-semibold ring-amber-500" : "bg-white/60 ring-amber-200 hover:ring-amber-400")}>{reading}</button>) : null}
    <button type="button" onClick={onAccept} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-white"><Check className="size-3.5" /> ঠিক আছে</button>
  </div>;
}
const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400";

/** Create or edit a question set: subject, date, topic and MCQs (four options, one right answer). */
export function QuestionSetForm({ subjects, initial }: {
  subjects: Array<{ id: string; name: string }>;
  initial?: { id: string; subjectId: string | null; date: string; topicName: string; questions: DraftQuestion[] };
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }));
  const [topicName, setTopicName] = useState(initial?.topicName ?? "");
  const [questions, setQuestions] = useState<ReviewedQuestion[]>(initial?.questions.length ? initial.questions : [emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [reading, setReading] = useState<string | null>(null);
  // The pages the AI read, so the user can check its reading against them.
  const [pages, setPages] = useState<Array<{ src: string; name: string }>>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [confirmUnchecked, setConfirmUnchecked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (index: number, patch: Partial<ReviewedQuestion>) => setQuestions((list) => list.map((question, position) => (position === index ? { ...question, ...patch } : question)));
  /** Resolves one flagged field (the user picked, typed or accepted it). */
  const settle = (question: ReviewedQuestion, part: "text" | "onlyOnce" | number): ReviewedQuestion => {
    if (!question.review) return question;
    const review = { ...question.review };
    if (review.words) { review.words = { ...review.words }; delete review.words[part === "text" ? 0 : part === "onlyOnce" ? -1 : part + 1]; if (!Object.keys(review.words).length) delete review.words; }
    if (part === "text") delete review.text;
    else if (part === "onlyOnce") delete review.onlyOnce;
    else if (review.options) { review.options = review.options.map((value, position) => (position === part ? undefined : value)); if (!review.options.some(Boolean)) delete review.options; }
    return { ...question, review: Object.keys(review).length ? review : undefined };
  };
  const setText = (index: number, text: string) => setQuestions((list) => list.map((question, position) => (position === index ? settle({ ...question, text }, "text") : question)));
  const setOption = (index: number, option: number, value: string) => setQuestions((list) => list.map((question, position) => {
    if (position !== index) return question;
    const options = [...question.options] as DraftQuestion["options"];
    options[option] = value;
    return settle({ ...question, options }, option);
  }));
  const accept = (index: number, part: "text" | "onlyOnce" | number) => setQuestions((list) => list.map((question, position) => (position === index ? settle(question, part) : question)));
  const unchecked = reviewCount(questions);

  async function readImages(files: FileList | null) {
    const list = Array.from(files ?? []).filter((file) => isAllowedType(file.type));
    if (!list.length) { toast.error("ছবি (JPG, PNG, WebP) বা PDF দাও।"); return; }
    setPasteOpen(false);
    const added: ReviewedQuestion[] = [];
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
    setQuestions((current) => [...current.filter((question) => question.text.trim() || question.options.some((option) => option.trim())), ...added]);
    if (topic && !topicName.trim()) setTopicName(topic);
    const flags = reviewCount(added);
    const noAnswer = added.filter((question) => question.correctIndex < 0).length;
    toast.success(`${added.length}টি প্রশ্ন যোগ হলো${flags ? ` · ${flags} জায়গা মিলিয়ে দেখো` : ""}${noAnswer ? ` · ${noAnswer}টির উত্তর বেছে নাও` : ""}`, { duration: 8000 });
  }

  const problems = questions.map((question) => (!question.text.trim() ? "প্রশ্ন লেখো" : question.options.some((option) => !option.trim()) ? "৪টা option-ই লেখো" : question.correctIndex < 0 ? "সঠিক উত্তর বেছে নাও" : null));
  const ready = subjectId && date && topicName.trim() && problems.every((problem) => !problem);

  async function save(force = false) {
    setShowErrors(true);
    if (!ready) { toast.error("লাল চিহ্ন দেওয়া জায়গাগুলো ঠিক করো।"); return; }
    if (unchecked && !force) { setConfirmUnchecked(true); return; }
    setSaving(true);
    try {
      const payload = { subjectId, date, topicName, questions: questions.map(({ text, options, correctIndex }) => ({ text, options, correctIndex })) };
      if (initial) { await updateQuestionSet(initial.id, payload); toast.success("Set সেভ হলো"); router.push("/preliminary"); }
      else { await createQuestionSet(payload); toast.success("Set বানানো হলো — Todo-তে আছে"); router.push("/preliminary?status=todo"); }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the set.");
    } finally {
      setSaving(false);
    }
  }

  function addPasted() {
    const { questions: parsed, skipped } = parseMcqText(pasteText);
    if (!parsed.length) { toast.error("কোনো প্রশ্ন চিনতে পারিনি। নিচের উদাহরণের মতো লিখে দেখো।"); return; }
    // An untouched first card is replaced rather than left empty.
    setQuestions((list) => [...list.filter((question) => question.text.trim() || question.options.some((option) => option.trim())), ...parsed]);
    setPasteOpen(false);
    setPasteText("");
    toast.success(`${parsed.length}টি প্রশ্ন যোগ হলো${skipped ? ` · ${skipped}টি বোঝা যায়নি (উত্তর বা ৪টা option নেই)` : ""}`);
  }

  return <div className="mx-auto max-w-3xl space-y-4 pb-24">
    <Link href="/preliminary" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="size-4" /> Preliminary</Link>
    <h1 className="text-2xl font-semibold tracking-tight">{initial ? "Set edit করো" : "নতুন question set"}</h1>

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
        <input value={topicName} onChange={(event) => setTopicName(event.target.value)} maxLength={160} placeholder="যেমন: সন্ধি বিচ্ছেদ" className={cn(field, "h-11", showErrors && !topicName.trim() && "border-red-400")} />
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
          <div className="min-w-0 flex-1">
            <textarea value={question.text} onChange={(event) => setText(index, event.target.value)} rows={2} placeholder="প্রশ্ন লেখো" aria-label={`প্রশ্ন ${index + 1}`} className={cn(field, "min-h-16 resize-y py-2.5 leading-relaxed", question.review?.text && "border-amber-400 ring-2 ring-amber-100")} />
            {question.review?.text ? <ReviewChips label="প্রশ্ন:" readings={question.review.text} current={question.text} word={question.review.words?.[0]} onPick={(value) => setText(index, value)} onAccept={() => accept(index, "text")} /> : null}
          </div>
          {questions.length > 1 ? <button type="button" onClick={() => setQuestions((list) => list.filter((_, position) => position !== index))} aria-label={`প্রশ্ন ${index + 1} মুছে ফেলো`} className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button> : null}
        </div>
        <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-2">
          {question.options.map((option, optionIndex) => {
            const correct = question.correctIndex === optionIndex;
            return <div key={optionIndex} className={cn("flex items-center gap-2 rounded-xl border px-2 transition", correct ? "border-emerald-400 bg-emerald-50" : "border-zinc-200", question.review?.options?.[optionIndex] && "border-amber-400 ring-2 ring-amber-100")}>
              <button type="button" onClick={() => update(index, { correctIndex: optionIndex })} aria-label={`${OPTION_LETTERS[optionIndex]} সঠিক উত্তর`} aria-pressed={correct} title="সঠিক উত্তর হিসেবে চিহ্নিত করো" className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition", correct ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-emerald-100")}>
                {correct ? <Check className="size-3.5" strokeWidth={3} /> : OPTION_LETTERS[optionIndex]}
              </button>
              <input value={option} onChange={(event) => setOption(index, optionIndex, event.target.value)} placeholder={`Option ${OPTION_LETTERS[optionIndex]}`} aria-label={`প্রশ্ন ${index + 1}, option ${OPTION_LETTERS[optionIndex]}`} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </div>;
          })}
        </div>
        {question.review?.options?.map((readings, optionIndex) => (readings ? <div key={optionIndex} className="pl-8"><ReviewChips label={`Option ${OPTION_LETTERS[optionIndex]}:`} readings={readings} current={question.options[optionIndex]} word={question.review?.words?.[optionIndex + 1]} onPick={(value) => setOption(index, optionIndex, value)} onAccept={() => accept(index, optionIndex)} /></div> : null))}
        {/* The right answer, picked explicitly (tapping an option's letter above does the same). */}
        <div role="radiogroup" aria-label={`প্রশ্ন ${index + 1}-এর সঠিক উত্তর`} className={cn("mt-3 ml-8 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2", question.correctIndex >= 0 ? "bg-emerald-50" : showErrors ? "bg-red-50" : "bg-zinc-50")}>
          <span className={cn("text-sm font-semibold", question.correctIndex >= 0 ? "text-emerald-800" : showErrors ? "text-red-700" : "text-zinc-700")}>সঠিক উত্তর:</span>
          {OPTION_LETTERS.map((letter, optionIndex) => {
            const on = question.correctIndex === optionIndex;
            return <button key={letter} type="button" role="radio" aria-checked={on} onClick={() => update(index, { correctIndex: optionIndex })} className={cn("flex h-9 min-w-11 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-semibold ring-1 transition", on ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-zinc-700 ring-zinc-200 hover:ring-emerald-400")}>
              {on ? <Check className="size-3.5" strokeWidth={3} /> : null}{letter}
            </button>;
          })}
          {question.correctIndex >= 0 && question.options[question.correctIndex]?.trim() ? <span className="min-w-0 truncate text-xs text-emerald-800">= {question.options[question.correctIndex]}</span> : null}
        </div>
        {showErrors && problems[index] ? <p className="mt-2 pl-8 text-xs text-red-600">{problems[index]}</p> : null}
      </li>)}
    </ol>

    <button type="button" onClick={() => setQuestions((list) => [...list, emptyQuestion()])} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:bg-white"><Plus className="size-4" /> প্রশ্ন যোগ করো</button>

    {/* Save stays in reach while scrolling through many questions. */}
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">{questions.length}টি প্রশ্ন · {problems.filter((problem) => !problem).length}টি সম্পূর্ণ{unchecked ? <span className="font-medium text-amber-700"> · {unchecked} যাচাই বাকি</span> : null}</p>
        <button type="button" onClick={() => void save()} disabled={saving} className="h-11 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? "Saving…" : initial ? "সেভ করো" : "Set বানাও"}</button>
      </div>
    </div>

    <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>অনেক প্রশ্ন একসাথে</DialogTitle></DialogHeader>
        <button type="button" onClick={() => fileRef.current?.click()} className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-left transition hover:border-indigo-400">
          <ScanText className="size-8 shrink-0 text-indigo-600" />
          <span><span className="block text-sm font-semibold text-indigo-950">ছবি বা PDF দাও — AI সব প্রশ্ন বানিয়ে দেবে</span><span className="block text-xs text-indigo-800">বই/গাইডের পাতার ছবি। প্রশ্ন, ৪টা option আর পাতায় চিহ্নিত উত্তর নিজে বসবে; যেখানে AI নিশ্চিত নয় সেটা দেখিয়ে দেবে।</span></span>
        </button>
        <p className="mb-2 text-xs leading-relaxed text-zinc-500">অথবা লিখে দাও: প্রতিটি প্রশ্নের পর ক) খ) গ) ঘ) option, তারপর “Correct Answer: খ” বা “উত্তর: খ”।</p>
        <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={12} autoFocus placeholder={"‘পরমেশ’ শব্দটির সঠিক সন্ধি বিচ্ছেদ কোনটি?\nক) পরম + এশ\nখ) পরম + ঈশ\nগ) পরম + ইশ\nঘ) পরম + ঈশা\nCorrect Answer: খ\n\nপরের প্রশ্ন…"} className={cn(field, "py-2.5 font-mono text-[13px] leading-relaxed")} />
        <button type="button" onClick={addPasted} disabled={!pasteText.trim()} className="mt-3 h-11 w-full rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">প্রশ্নগুলো যোগ করো</button>
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
