"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, Loader2, Lock, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { MathText } from "@/components/math-text";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { generateQuizFromNote, type DraftQuestion } from "@/server/actions/notes";
import { createQuestionSet } from "@/server/actions/preliminary";
import { errorMessage } from "@/lib/user-error";

const COUNTS = [5, 10, 15, 20, 50];
const LETTERS = ["ক", "খ", "গ", "ঘ"];
const bn = (value: number) => String(value).replace(/\d/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);

type Draft = { questions: DraftQuestion[]; topicName: string; subjectId: string | null; topicId: string | null };

/**
 * Note → Preliminary set with AI. The AI only drafts: every question is shown here with its right
 * answer and explanation, unwanted ones can be removed, and the set is saved to Preliminary only
 * when the user approves.
 */
export function NoteQuizDialog({ noteId, subjects, premium, open, onOpenChange }: { noteId: string; subjects: Array<{ id: string; name: string }>; premium: boolean; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [topicName, setTopicName] = useState("");

  async function generate() {
    setBusy(true);
    try {
      const result = await generateQuizFromNote({ noteId, count });
      setDraft(result);
      setTopicName(result.topicName);
      setSubjectId(result.subjectId && subjects.some((subject) => subject.id === result.subjectId) ? result.subjectId : "");
    } catch (error) {
      toast.error(errorMessage(error, "AI প্রশ্ন বানাতে পারল না"));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!draft) return;
    if (!subjectId) { toast.error("কোন subject-এ রাখবে, বেছে নাও"); return; }
    setSaving(true);
    try {
      const id = await createQuestionSet({
        subjectId,
        // The note's topic only if the set stays under the note's own subject.
        topicId: subjectId === draft.subjectId ? draft.topicId : null,
        topicName: topicName.trim() || draft.topicName,
        date: dayjs().tz(APP_TIMEZONE).format("YYYY-MM-DD"),
        questions: draft.questions.map((question) => ({ text: question.text, options: question.options, correctIndex: question.correctIndex, explanation: question.explanation, solution: null })),
      });
      toast.success(`${bn(draft.questions.length)}টা প্রশ্ন Preliminary-তে সেভ হলো`, { action: { label: "খুলে দেখো", onClick: () => router.push(`/preliminary/${id}`) } });
      close();
    } catch (error) {
      toast.error(errorMessage(error, "সেভ করা গেল না"));
    } finally {
      setSaving(false);
    }
  }

  function close() {
    onOpenChange(false);
    setDraft(null);
  }

  const remove = (index: number) => setDraft((current) => current && { ...current, questions: current.questions.filter((_, at) => at !== index) });

  return <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
    <DialogContent className="flex flex-col overflow-hidden p-0 pt-0 pb-0 sm:max-w-2xl sm:rounded-3xl sm:pb-0 sm:pt-0">
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 pb-3 pt-7 sm:pt-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white"><ClipboardCheck className="size-5" /></span>
        <div className="min-w-0 flex-1 pr-8">
          <DialogTitle className="text-[17px] font-bold">Note থেকে Preliminary</DialogTitle>
          <p className="text-xs text-slate-500">{draft ? "সব প্রশ্ন আর উত্তর দেখে নাও, তারপর approve করো" : "AI এই note থেকে MCQ বানাবে — সেভের আগে সব দেখাবে"}</p>
        </div>
      </header>

      {/* Paid: without a plan the dialog only explains and points to Plans (the server refuses too). */}
      {!premium ? <div className="space-y-4 px-5 py-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200"><Lock className="size-6" /></span>
        <div>
          <p className="text-[16px] font-bold text-slate-900">এটা paid feature</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">যেকোনো note থেকে এক চাপে AI দিয়ে MCQ সেট বানাতে একটা plan লাগবে। Plan নিলে এখনই চালু হবে।</p>
        </div>
        <Link href="/billing" onClick={() => onOpenChange(false)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-amber-400 to-orange-500 text-[15px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(249,115,22,0.9)]">Plan দেখো</Link>
      </div> : !draft ? <div className="space-y-4 px-5 py-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">কয়টা প্রশ্ন?</p>
          <div className="grid grid-cols-5 gap-2">
            {COUNTS.map((value) => <button key={value} type="button" onClick={() => setCount(value)} aria-pressed={count === value} className={cn("h-11 rounded-2xl text-[15px] font-bold transition active:scale-95", count === value ? "bg-blue-600 text-white shadow-[0_8px_16px_-10px_rgba(37,99,235,0.9)]" : "bg-slate-100 text-slate-600")}>{bn(value)}</button>)}
          </div>
        </div>
        <button type="button" onClick={() => void generate()} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#3f6ef3] to-[#8b5cf6] text-[15px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(99,102,241,0.9)] disabled:opacity-60">
          {busy ? <><Loader2 className="size-5 animate-spin" /> প্রশ্ন বানানো হচ্ছে…</> : <><Sparkles className="size-5" /> AI দিয়ে প্রশ্ন বানাও</>}
        </button>
        {busy ? <p className="text-center text-xs text-slate-500">{count > 20 ? "৫০টা প্রশ্ন — এক মিনিটের মতো লাগতে পারে।" : "বড় note হলে আধা মিনিটের মতো লাগতে পারে।"}</p> : null}
      </div> : <>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">Subject</span>
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="h-11 w-full rounded-xl bg-slate-100 px-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— বেছে নাও —</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">সেটের নাম</span>
              <input value={topicName} onChange={(event) => setTopicName(event.target.value)} maxLength={160} className="h-11 w-full rounded-xl bg-slate-100 px-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
          </div>

          <ol className="space-y-2.5">
            {draft.questions.map((question, index) => <li key={index} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-[15px] font-semibold leading-relaxed text-slate-900"><span className="mr-1.5 text-slate-400 tabular-nums">{bn(index + 1)}.</span><MathText text={question.text} /></p>
                <button type="button" onClick={() => remove(index)} aria-label={`প্রশ্ন ${index + 1} বাদ দাও`} title="এই প্রশ্নটা বাদ দাও" className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
              </div>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {question.options.map((option, at) => {
                  const right = at === question.correctIndex;
                  return <li key={at} className={cn("flex items-center gap-2 rounded-xl px-2.5 py-2 text-[14px]", right ? "bg-emerald-50 font-semibold text-emerald-900 ring-1 ring-emerald-300" : "bg-slate-50 text-slate-700")}>
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", right ? "bg-emerald-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200")}>{right ? <Check className="size-3.5" strokeWidth={3} /> : LETTERS[at]}</span>
                    <span className="min-w-0"><MathText text={option} /></span>
                  </li>;
                })}
              </ul>
              {question.explanation ? <p className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-[13.5px] leading-relaxed text-sky-950"><span className="font-semibold">ব্যাখ্যা: </span><MathText text={question.explanation} /></p> : null}
            </li>)}
          </ol>
          {!draft.questions.length ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">সব প্রশ্ন বাদ দেওয়া হয়েছে।</p> : null}
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:pb-4">
          <button type="button" onClick={() => setDraft(null)} disabled={saving} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"><RotateCcw className="size-4" /> আবার বানাও</button>
          <button type="button" onClick={() => void approve()} disabled={saving || !draft.questions.length} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 text-[15px] font-bold text-white shadow-[0_10px_20px_-12px_rgba(5,150,105,0.9)] disabled:opacity-50">
            {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" strokeWidth={2.6} />} Approve করে সেভ করো ({bn(draft.questions.length)})
          </button>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
