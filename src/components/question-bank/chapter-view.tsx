"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, CheckSquare, ChevronDown, FileText, ListChecks, Loader2, Lock, MessageSquareText, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { MathText, RichHtml } from "@/components/math-text";
import { QuillEditor, type QuillHandle } from "@/components/notes/quill-editor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  deleteBankItems, listChapterTargets, moveBankItems, saveBankArticle, saveBankShortQuestion, saveChapterQuestion, sendChapterToPreliminary, sendChapterToShortQuestions, setBankItemsFree,
  type BankItemKind, type getBankChapter,
} from "@/server/actions/question-bank-general";
import { adminButton, ConfirmDelete, FreePill, iconButton, MoveDialog, useBankRun } from "./bank-admin";
import { BankQuestionList, QuestionEditor } from "./bank-question-list";
import { ChapterPaste } from "./chapter-paste";
import { ChapterUpload } from "./chapter-upload";
import { errorMessage } from "@/lib/user-error";

type Chapter = NonNullable<Awaited<ReturnType<typeof getBankChapter>>>;
type Tab = "article" | "mcq" | "short";
type Article = Chapter["articles"][number];
type Short = Chapter["shorts"][number];

const TABS: Array<{ id: Tab; label: string; short: string; icon: typeof FileText }> = [
  { id: "article", label: "Article", short: "Article", icon: FileText },
  { id: "mcq", label: "MCQ", short: "MCQ", icon: ListChecks },
  { id: "short", label: "Short Question", short: "Short", icon: MessageSquareText },
];

/** "N টি paid — plan নিলে খুলবে", shown instead of the locked items themselves. */
function LockedNote({ count, noun }: { count: number; noun: string }) {
  if (!count) return null;
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
    <Lock className="size-4 shrink-0" />
    <span className="flex-1">আরও {count}টি {noun} Paid — একটা চালু plan থাকলে খুলে যাবে।</span>
    <Link href="/billing" className="font-semibold underline underline-offset-2">Plan দেখো</Link>
  </div>;
}

/** Sends the chapter's open MCQs / short questions to my own Preliminary or Short Question. */
function SendChapter({ chapterId, kind, count, planned }: { chapterId: string; kind: "mcq" | "short"; count: number; planned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const target = kind === "mcq" ? "Preliminary" : "Short Question";
  if (!count) return null;
  if (!planned) {
    return <Link href="/billing" className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-3.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"><Lock className="size-4" /> {target}-এ নিতে plan লাগবে</Link>;
  }
  if (sent) {
    return <Link href={sent} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"><Check className="size-4" /> {target}-এ গেছে — দেখো</Link>;
  }
  async function send() {
    setBusy(true);
    try {
      const result = kind === "mcq" ? await sendChapterToPreliminary(chapterId) : await sendChapterToShortQuestions(chapterId);
      const href = kind === "mcq" ? `/preliminary/${result.id}` : `/short-questions/${result.id}`;
      setSent(href);
      toast.success(`${result.count}টি প্রশ্ন ${target}-এর Todo-তে গেল${result.partial ? " (Paid-গুলো বাদে)" : ""}`, { action: { label: "দেখো", onClick: () => router.push(href) } });
    } catch (error) {
      toast.error(errorMessage(error, "পাঠানো গেল না।"));
    } finally {
      setBusy(false);
    }
  }
  return <button type="button" onClick={() => void send()} disabled={busy} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
    {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {count}টি {target}-এ পাঠাও
  </button>;
}

/**
 * "বেছে পাঠাও": my picked MCQs as one Preliminary set, so a long chapter can go in parts (a big set
 * is hard to sit as an exam). Quick picks skip what I've already taken.
 */
function PickBar({ chapterId, questions, picked, setPicked, onClose }: {
  chapterId: string; questions: Chapter["questions"]; picked: Set<string>; setPicked: (next: Set<string>) => void; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const fresh = questions.filter((question) => !question.taken);
  const pickFirst = (list: typeof questions, count: number) => setPicked(new Set(list.slice(0, count).map((question) => question.id)));
  async function send() {
    setBusy(true);
    try {
      const ids = questions.filter((question) => picked.has(question.id)).map((question) => question.id);
      const result = await sendChapterToPreliminary(chapterId, ids);
      const href = `/preliminary/${result.id}`;
      toast.success(`${result.count}টি প্রশ্ন Preliminary-এর Todo-তে গেল${result.partial ? " (Paid-গুলো বাদে)" : ""}`, { action: { label: "দেখো", onClick: () => router.push(href) } });
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "পাঠানো গেল না।"));
    } finally {
      setBusy(false);
    }
  }
  const chip = "h-8 rounded-full px-3 text-xs font-semibold ring-1 ring-blue-200 text-blue-800 hover:bg-white disabled:opacity-40";
  return <>
    <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/80 p-3">
      <p className="text-[12.5px] text-blue-900">যে প্রশ্নগুলো নিতে চাও সেগুলোতে টিক দাও। একসাথে বেশি নিলে exam দেওয়া কঠিন — অল্প অল্প করে নাও।</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={!fresh.length} onClick={() => setPicked(new Set(fresh.map((question) => question.id)))} className={chip}>নেওয়া হয়নি এমন সব ({fresh.length})</button>
        {fresh.length > 20 ? <button type="button" onClick={() => pickFirst(fresh, 20)} className={chip}>নেওয়া হয়নি এমন প্রথম ২০টি</button> : null}
        {fresh.length > 50 ? <button type="button" onClick={() => pickFirst(fresh, 50)} className={chip}>প্রথম ৫০টি</button> : null}
        <button type="button" onClick={() => setPicked(new Set(questions.map((question) => question.id)))} className={chip}>সব ({questions.length})</button>
        {picked.size ? <button type="button" onClick={() => setPicked(new Set())} className={chip}>বাছাই মুছো</button> : null}
      </div>
    </div>
    <div data-dock-avoid className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-64">
      <div className="container mx-auto flex items-center justify-between gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="flex h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"><X className="size-4" /> বাতিল</button>
        <button type="button" onClick={() => void send()} disabled={busy || !picked.size} className="flex h-11 items-center gap-1.5 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {picked.size ? `${picked.size}টি Preliminary-এ পাঠাও` : "প্রশ্ন বাছো"}
        </button>
      </div>
    </div>
  </>;
}

/** The rule for taking sets from the bank (bank-access `assertCanTakeFromBank`). */
function SlotNote() {
  return <p className="text-xs text-zinc-500">একসাথে ২টা set নেওয়া যায় — test-এ 60% পেলে বা মুছে দিলে পরেরটা</p>;
}

/** Staff: write or edit an article in the same editor as notes. */
function ArticleDialog({ chapterId, article, onClose }: { chapterId: string; article: Article | "new" | null; onClose: () => void }) {
  const editing = article && article !== "new" ? article : null;
  const [title, setTitle] = useState(editing?.title ?? "");
  const [free, setFree] = useState(editing?.free ?? true);
  const html = useRef(editing?.content ?? "");
  const editor = useRef<QuillHandle>(null);
  const { busy, run } = useBankRun();
  return <Dialog open={Boolean(article)} onOpenChange={(open) => !open && !busy && onClose()}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader><DialogTitle>{editing ? "Article বদলাও" : "নতুন Article"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="শিরোনাম" aria-label="শিরোনাম" maxLength={200} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base font-medium outline-none focus:border-zinc-400" />
        <div className="task-editor"><QuillEditor handleRef={editor} initialHtml={editing?.content ?? ""} placeholder="লেখা শুরু করো…" onChange={(value) => { html.current = value; }} /></div>
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm">
          <input type="checkbox" checked={free} onChange={(event) => setFree(event.target.checked)} className="size-4 accent-emerald-600" />
          <span><span className="font-medium">Free</span> — plan ছাড়াই সবাই পড়তে পারবে</span>
        </label>
        <button type="button" disabled={busy || !title.trim()} onClick={() => run(() => saveBankArticle({ id: editing?.id ?? null, chapterId, title: title.trim(), content: editor.current?.getHtml() ?? html.current, free }), "সেভ হলো", onClose)}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} সেভ
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}

/** Staff: add or edit a short question. */
function ShortDialog({ chapterId, short, onClose }: { chapterId: string; short: Short | "new" | null; onClose: () => void }) {
  const editing = short && short !== "new" ? short : null;
  const [question, setQuestion] = useState(editing?.question ?? "");
  const [answer, setAnswer] = useState(editing?.answer ?? "");
  const [free, setFree] = useState(editing?.free ?? false);
  const { busy, run } = useBankRun();
  const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-zinc-400";
  return <Dialog open={Boolean(short)} onOpenChange={(open) => !open && !busy && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Short Question বদলাও" : "নতুন Short Question"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <label className="block space-y-1"><span className="text-xs font-medium text-zinc-600">প্রশ্ন</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} className={field} /></label>
        <label className="block space-y-1"><span className="text-xs font-medium text-zinc-600">উত্তর</span><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} className={field} /></label>
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm">
          <input type="checkbox" checked={free} onChange={(event) => setFree(event.target.checked)} className="size-4 accent-emerald-600" />
          <span><span className="font-medium">Free</span> — plan ছাড়াই সবাই দেখতে পারবে</span>
        </label>
        <button type="button" disabled={busy || !question.trim() || !answer.trim()} onClick={() => run(() => saveBankShortQuestion({ id: editing?.id ?? null, chapterId, question, answer, free }), "সেভ হলো", onClose)}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} সেভ
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}

/** Staff: a new chapter MCQ, with the same editor the bank uses for editing. */
function McqDialog({ chapterId, open, onClose }: { chapterId: string; open: boolean; onClose: () => void }) {
  const [free, setFree] = useState(false);
  const router = useRouter();
  return <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader><DialogTitle>নতুন MCQ</DialogTitle></DialogHeader>
      <label className="mb-3 flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-sm">
        <input type="checkbox" checked={free} onChange={(event) => setFree(event.target.checked)} className="size-4 accent-emerald-600" />
        <span><span className="font-medium">Free</span> — plan ছাড়াই সবাই দেখতে পারবে</span>
      </label>
      <QuestionEditor initial={{ id: "", text: "", options: ["", "", "", ""], correctIndex: -1, solution: null, explanation: null }} aiFilled={false} onCancel={onClose}
        onSave={async (draft) => {
          try {
            await saveChapterQuestion({ ...draft, id: null, chapterId, free });
            toast.success("MCQ যোগ হলো");
            onClose();
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error, "সেভ করা গেল না।"));
          }
        }} />
    </DialogContent>
  </Dialog>;
}

/** Item-level staff controls shared by articles and short questions: Free/Paid, edit, move, delete. */
function ItemTools({ kind, item, onEdit, onMove, onDelete }: { kind: BankItemKind; item: { id: string; free: boolean }; onEdit: () => void; onMove: () => void; onDelete: () => void }) {
  const { busy, run } = useBankRun();
  return <span className="flex shrink-0 items-center gap-0.5">
    <FreePill free={item.free} busy={busy} onToggle={() => run(() => setBankItemsFree({ kind, ids: [item.id], free: !item.free }), item.free ? "Paid করা হলো" : "Free করা হলো")} />
    <button type="button" onClick={onEdit} aria-label="বদলাও" title="বদলাও" className={iconButton}><Pencil className="size-3.5" /></button>
    <button type="button" onClick={onMove} aria-label="অন্য chapter-এ সরাও" title="অন্য chapter-এ সরাও" className={iconButton}><ArrowRightLeft className="size-3.5" /></button>
    <button type="button" onClick={onDelete} aria-label="মুছো" title="মুছো" className={`${iconButton} hover:bg-red-50 hover:text-red-600`}><Trash2 className="size-3.5" /></button>
  </span>;
}

/**
 * One General chapter (docs/question-bank-v2-plan.md): Article / MCQ / Short Question tabs. Locked
 * (paid) items arrive without their content and are counted, not shown. Staff add, upload, price,
 * move and delete here.
 */
export function ChapterView({ chapter, initialTab }: { chapter: Chapter; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const [shownAnswers, setShownAnswers] = useState<Set<string>>(new Set());
  const [articleDialog, setArticleDialog] = useState<Article | "new" | null>(null);
  const [shortDialog, setShortDialog] = useState<Short | "new" | null>(null);
  const [mcqDialog, setMcqDialog] = useState(false);
  const [moving, setMoving] = useState<{ kind: BankItemKind; id: string } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: BankItemKind; id: string; title: string } | null>(null);
  const [targets, setTargets] = useState<Array<{ id: string; label: string }> | null>(null);
  const { busy, run } = useBankRun();
  const { canEdit } = chapter;
  // My own picking for "বেছে পাঠাও" (MCQ tab).
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const stopPicking = () => { setPicking(false); setPicked(new Set()); };

  const openQuestions = chapter.questions.filter((question) => !question.locked);
  const openShorts = chapter.shorts.filter((short) => !short.locked);
  const counts: Record<Tab, number> = { article: chapter.articles.length, mcq: chapter.questions.length, short: chapter.shorts.length };

  function pickTab(next: Tab) {
    setTab(next);
    // Kept in the URL so a refresh or a shared link opens the same tab, without a server round trip.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  function openMove(kind: BankItemKind, id: string) {
    setMoving({ kind, id });
    if (!targets) listChapterTargets().then((list) => setTargets(list.filter((target) => target.id !== chapter.id))).catch(() => { toast.error("Chapter-এর তালিকা আনা গেল না।"); setMoving(null); });
  }

  /** Staff: everything in this tab Free or Paid at once. */
  function setAll(kind: BankItemKind, free: boolean) {
    const ids = kind === "article" ? chapter.articles.map((item) => item.id) : kind === "mcq" ? chapter.questions.map((item) => item.id) : chapter.shorts.map((item) => item.id);
    if (ids.length) run(() => setBankItemsFree({ kind, ids, free }), free ? "সব Free করা হলো" : "সব Paid করা হলো");
  }

  const adminBar = (kind: BankItemKind, add: () => void, upload?: "mcq" | "short") => canEdit ? <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50/80 p-3">
    <span className="mr-auto text-xs font-semibold text-violet-900">Admin</span>
    <button type="button" onClick={add} className={adminButton}><Plus className="size-4" /> যোগ করো</button>
    {upload ? <><ChapterPaste chapterId={chapter.id} kind={upload} /><ChapterUpload chapterId={chapter.id} kind={upload} /></> : null}
    {counts[kind] ? <>
      <button type="button" disabled={busy} onClick={() => setAll(kind, true)} className={adminButton}>সব Free</button>
      <button type="button" disabled={busy} onClick={() => setAll(kind, false)} className={adminButton}>সব Paid</button>
    </> : null}
  </div> : null;

  const empty = (text: string) => <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">{text}</p>;

  return <div className={cn("space-y-4", picking && tab === "mcq" && "pb-20")}>
    <div role="tablist" aria-label="Chapter-এর ভেতরে" className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100 p-1">
      {TABS.map(({ id, label, short, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => pickTab(id)}
        className={cn("flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition", tab === id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:text-zinc-900")}>
        <Icon className="size-4 shrink-0" /><span className="truncate"><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span></span><span className="text-xs text-zinc-400 tabular-nums">{counts[id]}</span>
      </button>)}
    </div>

    {tab === "article" ? <section className="space-y-3">
      {adminBar("article", () => setArticleDialog("new"))}
      {chapter.articles.length ? <ul className="space-y-2">
        {chapter.articles.map((article) => {
          const open = openArticle === article.id;
          return <li key={article.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="flex flex-wrap items-center gap-x-2 sm:flex-nowrap sm:pr-2">
              <button type="button" onClick={() => setOpenArticle(open ? null : article.id)} aria-expanded={open} className="flex min-w-0 basis-full items-center gap-3 px-4 py-3.5 text-left sm:basis-0 sm:flex-1">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", article.locked ? "bg-amber-50 text-amber-800" : "bg-indigo-50 text-indigo-700")}>{article.locked ? <Lock className="size-4" /> : <FileText className="size-4" />}</span>
                <span className="min-w-0 flex-1 font-semibold leading-snug">{article.title}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-zinc-400 transition", open && "rotate-180")} />
              </button>
              {canEdit ? <span className="ml-auto px-2 pb-2 sm:p-0"><ItemTools kind="article" item={article} onEdit={() => setArticleDialog(article)} onMove={() => openMove("article", article.id)} onDelete={() => setDeleting({ kind: "article", id: article.id, title: article.title })} /></span> : null}
            </div>
            {open ? <div className="border-t border-zinc-100 px-4 py-3">
              {article.locked
                ? <p className="flex flex-wrap items-center gap-2 text-sm text-amber-900"><Lock className="size-4" /> এই article পড়তে একটা চালু plan লাগবে। <Link href="/billing" className="font-semibold underline underline-offset-2">Plan দেখো</Link></p>
                : article.content.trim() ? <RichHtml html={article.content} /> : <p className="text-sm text-zinc-500">এখনো কিছু লেখা হয়নি।</p>}
            </div> : null}
          </li>;
        })}
      </ul> : empty("এই chapter-এ এখনো কোনো article নেই।")}
    </section> : null}

    {tab === "mcq" ? <section className="space-y-3">
      {adminBar("mcq", () => setMcqDialog(true), "mcq")}
      {picking ? null : <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1"><SlotNote />
        {chapter.premium && openQuestions.length > 1 ? <button type="button" onClick={() => setPicking(true)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-sm font-semibold text-white hover:bg-blue-700"><CheckSquare className="size-4" /> বেছে পাঠাও</button> : null}
        <SendChapter chapterId={chapter.id} kind="mcq" count={openQuestions.length} planned={chapter.premium} />
      </div>}
      {picking ? <PickBar chapterId={chapter.id} questions={openQuestions} picked={picked} setPicked={setPicked} onClose={stopPicking} /> : null}
      <LockedNote count={chapter.questions.length - openQuestions.length} noun="MCQ" />
      {openQuestions.length
        ? <BankQuestionList key={openQuestions.map((question) => `${question.id}${question.free}`).join()} questions={openQuestions} canEdit={canEdit} chapterItems={canEdit} moveToChapter={canEdit}
          taken={Object.fromEntries(openQuestions.map((question) => [question.id, question.taken]))}
          userPick={picking ? { picked, onToggle: (id) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }) } : undefined} />
        : chapter.questions.length ? null : empty("এই chapter-এ এখনো কোনো MCQ নেই।")}
    </section> : null}

    {tab === "short" ? <section className="space-y-3">
      {adminBar("short", () => setShortDialog("new"), "short")}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1"><SlotNote /><SendChapter chapterId={chapter.id} kind="short" count={openShorts.length} planned={chapter.premium} /></div>
      <LockedNote count={chapter.shorts.length - openShorts.length} noun="Short Question" />
      {openShorts.length ? <ol className="space-y-3">
        {openShorts.map((short, index) => {
          const shown = shownAnswers.has(short.id);
          return <li key={short.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
              <p className="min-w-0 basis-full font-medium leading-relaxed sm:basis-0 sm:flex-1"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={short.question} book /></p>
              {canEdit ? <span className="ml-auto"><ItemTools kind="short" item={short} onEdit={() => setShortDialog(short)} onMove={() => openMove("short", short.id)} onDelete={() => setDeleting({ kind: "short", id: short.id, title: short.question.slice(0, 60) })} /></span> : null}
            </div>
            <button type="button" onClick={() => setShownAnswers((current) => { const next = new Set(current); if (next.has(short.id)) next.delete(short.id); else next.add(short.id); return next; })} aria-expanded={shown}
              className={cn("mt-3 flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition", shown ? "bg-zinc-950 text-white ring-zinc-950" : "text-zinc-700 ring-zinc-200 hover:bg-zinc-50")}>
              উত্তর {shown ? "লুকাও" : "দেখো"}
            </button>
            {shown ? <div className="mt-2 whitespace-pre-line rounded-xl bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-950"><MathText text={short.answer} book /></div> : null}
          </li>;
        })}
      </ol> : chapter.shorts.length ? null : empty("এই chapter-এ এখনো কোনো Short Question নেই।")}
    </section> : null}

    {canEdit ? <>
      <ArticleDialog key={`article-${articleDialog === "new" ? "new" : articleDialog?.id ?? "none"}`} chapterId={chapter.id} article={articleDialog} onClose={() => setArticleDialog(null)} />
      <ShortDialog key={`short-${shortDialog === "new" ? "new" : shortDialog?.id ?? "none"}`} chapterId={chapter.id} short={shortDialog} onClose={() => setShortDialog(null)} />
      <McqDialog key={`mcq-${mcqDialog}`} chapterId={chapter.id} open={mcqDialog} onClose={() => setMcqDialog(false)} />
      <MoveDialog open={Boolean(moving)} onOpenChange={(open) => !open && setMoving(null)} title="কোন chapter-এ যাবে?" loading={!targets} busy={busy} targets={targets ?? []}
        onSubmit={(chapterId) => moving && run(() => moveBankItems({ kind: moving.kind, ids: [moving.id], chapterId }), (result) => (result.moved ? "সরানো হলো" : "ওই chapter-এ এটা আগেই আছে — সরানো হয়নি"), () => setMoving(null))} />
      <ConfirmDelete open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)} busy={busy} title="মুছে ফেলবে?" description={deleting ? `"${deleting.title}" ব্যাংক থেকে মুছে যাবে, ফেরানো যাবে না।` : ""}
        onConfirm={() => deleting && run(() => deleteBankItems({ kind: deleting.kind, ids: [deleting.id] }), "মুছে ফেলা হলো", () => setDeleting(null))} />
    </> : null}
  </div>;
}
