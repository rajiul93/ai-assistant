"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ClipboardCheck, FileText, Lock, Plus, Search, Sparkles, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { QuillEditor, type QuillHandle } from "@/components/notes/quill-editor";
import { NoteLinks, type SubjectOption, type TopicOption } from "@/components/notes/note-links";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import { ShareButton } from "@/components/collaboration/share-button";
import { cn } from "@/lib/utils";
import { NoteQuizDialog } from "@/components/notes/note-quiz-dialog";
import { createNote, deleteNote, generateNoteContent, getNote, listNotes, updateNote } from "@/server/actions/notes";
import { useAssistantStore } from "@/store/assistant";
import { MathText } from "@/components/math-text";

type NoteSummary = Awaited<ReturnType<typeof listNotes>>[number];
type SaveState = "saved" | "saving" | "unsaved" | "error";

function updatedLabel(date: Date) {
  const value = dayjs(date).tz(APP_TIMEZONE);
  return value.isSame(dayjs().tz(APP_TIMEZONE), "day") ? value.format("h:mm A") : value.format("D MMM YYYY");
}

/** Editor for one note: title + Quill body, autosaved 0.8s after typing stops, plus AI writing. */
function NoteEditor({ noteId, subjects, topics, premium, onSaved, onDeleted, onBack }: { noteId: string; subjects: SubjectOption[]; topics: TopicOption[]; premium: boolean; onSaved: () => void; onDeleted: () => void; onBack: () => void }) {
  const noteQuery = useQuery({ queryKey: ["note", noteId], queryFn: () => getNote(noteId), staleTime: 0 });
  const lang = useAssistantStore((state) => state.lang);
  const editorRef = useRef<QuillHandle>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [writing, setWriting] = useState(false);
  // After an AI rewrite: the note as it was before, so it can be put back.
  const [beforeAi, setBeforeAi] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const latest = useRef({ title: "", content: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const note = noteQuery.data;
  const shownTitle = title ?? note?.title ?? "";

  async function save() {
    setSaveState("saving");
    try {
      await updateNote(noteId, latest.current);
      setSaveState("saved");
      onSaved();
    } catch {
      setSaveState("error");
    }
  }

  function scheduleSave(patch: Partial<typeof latest.current>) {
    latest.current = { ...latest.current, ...patch };
    setSaveState("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 800);
  }

  // Seed the save payload once the note loads; flush a pending save when switching notes.
  // Only the first load: refetches (after linking a task, say) must not undo unsaved typing.
  const seeded = useRef(false);
  useEffect(() => {
    if (note && !seeded.current) { seeded.current = true; latest.current = { title: note.title, content: note.content }; }
  }, [note]);
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); void updateNote(noteId, latest.current).then(onSaved).catch(() => {}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- flush only on unmount / note switch
  }, [noteId]);

  async function writeWithAi() {
    const text = instruction.trim();
    if (!text) return;
    setWriting(true);
    try {
      const before = editorRef.current?.getHtml() ?? "";
      const html = await generateNoteContent({ instruction: text, title: shownTitle, currentHtml: before, lang });
      // The AI returns the whole note with the change made: it replaces the note (no second copy).
      editorRef.current?.setHtml(html);
      setBeforeAi(before);
      setInstruction("");
      setAiOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI couldn't write this");
    } finally {
      setWriting(false);
    }
  }

  if (noteQuery.isPending) return <div className="space-y-3 p-6"><div className="h-9 w-2/3 animate-pulse rounded-lg bg-slate-100" /><div className="h-64 animate-pulse rounded-xl bg-slate-100" /></div>;
  if (!note) return <p className="p-6 text-sm text-slate-500">নোটটা খোলা গেল না।</p>;

  const saveLabel = { saved: "সেভ হয়েছে", saving: "সেভ হচ্ছে…", unsaved: "সেভ বাকি", error: "সেভ হয়নি — পরের লেখায় আবার চেষ্টা" }[saveState];

  return <div className="flex h-full min-h-0 flex-col">
    {/* Phones: this is the top bar of a full-screen editor (with room for the notch). */}
    <div className="flex items-center gap-1 border-b border-slate-100 px-1.5 pb-1 pt-[calc(0.25rem+env(safe-area-inset-top))] lg:gap-2 lg:px-4 lg:py-2.5">
      <button type="button" onClick={onBack} className="flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="নোটের তালিকায় ফিরুন"><ChevronLeft className="size-6" /></button>
      <p className={cn("truncate text-xs", saveState === "error" ? "text-red-600" : "text-slate-400")} aria-live="polite">{saveLabel}</p>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => setAiOpen(!aiOpen)} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition lg:h-8", aiOpen ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100")}>
          {premium ? <Sparkles className="size-4" /> : <Lock className="size-4" />} AI<span className="hidden lg:inline"> দিয়ে লিখুন</span>
        </button>
        {/* Note → MCQ set: AI drafts, the dialog shows every answer, saved only on approve. */}
        <button type="button" onClick={() => setQuizOpen(true)} title="এই note থেকে AI দিয়ে Preliminary প্রশ্ন বানাও" className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 lg:h-8">
          {premium ? <ClipboardCheck className="size-4" /> : <Lock className="size-4" />}<span className="hidden lg:inline">Preliminary বানাও</span>
        </button>
        <ShareButton type="NOTE" itemId={noteId} title={shownTitle} label={false} className="size-10 justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:size-8" />
        <button type="button" onClick={() => setConfirmDelete(true)} className="flex size-10 items-center justify-center rounded-full text-slate-500 hover:bg-red-50 hover:text-red-700 lg:size-8" aria-label="নোট মুছুন"><Trash2 className="size-4" /></button>
      </div>
    </div>

    {/* Writing with AI is paid: without a plan the bar explains and points to Plans (the server refuses too). */}
    {aiOpen && !premium ? <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/80 px-3 py-2.5">
      <Lock className="size-4 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 text-[13.5px] font-medium text-amber-900">AI দিয়ে note লেখা আর উন্নত করা paid feature — plan নিলে চালু হবে।</p>
      <Link href="/billing" className="flex h-9 shrink-0 items-center rounded-full bg-linear-to-r from-amber-400 to-orange-500 px-4 text-[13px] font-bold text-white">Plan দেখো</Link>
    </div> : null}
    {aiOpen && premium ? <form className="flex gap-2 border-b border-blue-100 bg-blue-50/60 px-3 py-2.5" onSubmit={(event) => { event.preventDefault(); void writeWithAi(); }}>
      <input
        autoFocus
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder={lang === "en" ? "e.g. Explain Newton's 3 laws with examples" : "যেমন: Newton-এর ৩টি সূত্র উদাহরণসহ লেখো"}
        className="h-10 min-w-0 flex-1 rounded-full border border-blue-200 bg-white px-3.5 text-sm outline-none focus:border-blue-400"
      />
      <button type="submit" disabled={writing || !instruction.trim()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
        <Sparkles className="size-4" /> {writing ? "লিখছে…" : "লেখো"}
      </button>
    </form> : null}

    {/* The note now shows the AI's version (already saved); undo puts the old one back. */}
    {beforeAi !== null ? <div className="assistant-in flex flex-wrap items-center gap-2 border-b border-violet-100 bg-violet-50/80 px-3 py-2.5">
      <Sparkles className="size-4 shrink-0 text-violet-600" />
      <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-violet-900">AI note-টা আপডেট করেছে — দেখে নাও</p>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={() => { editorRef.current?.setHtml(beforeAi); setBeforeAi(null); toast.success("আগের note ফেরত এসেছে"); }} className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"><Undo2 className="size-4" /> আগেরটায় ফেরাও</button>
        <button type="button" onClick={() => setBeforeAi(null)} className="flex h-9 items-center gap-1.5 rounded-full bg-violet-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-violet-700 active:scale-95"><Check className="size-4" /> ঠিক আছে, রাখো</button>
      </div>
    </div> : null}

    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-3 lg:px-6 lg:pb-6 lg:pt-4">
      <input
        value={shownTitle}
        onChange={(event) => { setTitle(event.target.value); scheduleSave({ title: event.target.value }); }}
        placeholder="শিরোনাম"
        maxLength={200}
        className="mb-1.5 w-full bg-transparent text-xl font-bold tracking-tight outline-none placeholder:text-slate-300 lg:text-2xl"
      />
      <NoteLinks
        key={`${note.subjectId}:${note.topicId}`}
        noteId={note.id}
        subjectId={note.subjectId}
        topicId={note.topicId}
        tasks={note.tasks.map((link) => link.task)}
        subjects={subjects}
        topics={topics}
      />
      <QuillEditor
        key={note.id}
        handleRef={editorRef}
        initialHtml={note.content}
        placeholder={lang === "en" ? "Start writing your note…" : "এখানে note লেখা শুরু করো…"}
        onChange={(html) => scheduleSave({ content: html })}
      />
    </div>

    <NoteQuizDialog noteId={noteId} subjects={subjects} premium={premium} open={quizOpen} onOpenChange={setQuizOpen} />

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <div className="space-y-1">
          <AlertDialogTitle>নোটটা মুছে ফেলবেন?</AlertDialogTitle>
          <AlertDialogDescription>“{shownTitle || "শিরোনাম নেই"}” পুরোপুরি মুছে যাবে।</AlertDialogDescription>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখুন</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            clearTimeout(timer.current);
            timer.current = undefined;
            void deleteNote(noteId).then(() => { toast.success("নোট মুছে ফেলা হলো"); onDeleted(); }).catch((error: Error) => toast.error(error.message));
          }} className="bg-red-600 hover:bg-red-700">মুছে ফেলুন</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

const desktopQuery = "(min-width: 1024px)";
/** Desktop shows list + editor side by side; phones show one at a time. */
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => { const media = window.matchMedia(desktopQuery); media.addEventListener("change", onChange); return () => media.removeEventListener("change", onChange); },
    () => window.matchMedia(desktopQuery).matches,
    () => false,
  );
}

function setUrl(id: string | null, replace: boolean) {
  const url = id ? `/notes?id=${encodeURIComponent(id)}` : "/notes";
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

export function NotesWorkspace({ initialNotes, subjects, topics, premium }: { initialNotes: NoteSummary[]; subjects: SubjectOption[]; topics: TopicOption[]; /** A running plan (or staff): Note → Preliminary is paid. */ premium: boolean }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const notesQuery = useQuery({ queryKey: ["notes"], queryFn: () => listNotes(), initialData: initialNotes });
  const notes = notesQuery.data;
  const [search, setSearch] = useState("");
  // "" = every note; "none" = notes without a subject.
  const [subjectFilter, setSubjectFilter] = useState("");
  const [creating, setCreating] = useState(false);
  // Set when this page pushed the open note onto history, so "‹ Notes" can simply go back.
  const pushedNote = useRef(false);
  // The open note lives in the URL (?id=), so browser/phone back closes it.
  const urlId = searchParams.get("id");
  const selectedId = urlId ?? (isDesktop ? notes[0]?.id ?? null : null);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return notes.filter((note) =>
      (!subjectFilter || (subjectFilter === "none" ? !note.subjectId : note.subjectId === subjectFilter)) &&
      (!needle || `${note.title}\n${note.plainText}\n${note.subject?.name ?? ""}\n${note.topic?.name ?? ""}`.toLowerCase().includes(needle)));
  }, [notes, search, subjectFilter]);

  const refreshList = () => void queryClient.invalidateQueries({ queryKey: ["notes"] });

  /** Phones push a history entry (back returns to the list); desktop just swaps the note. */
  function openNote(id: string) {
    pushedNote.current = !isDesktop;
    setUrl(id, isDesktop);
  }

  function closeNote() {
    if (pushedNote.current) { pushedNote.current = false; window.history.back(); }
    else setUrl(null, true);
  }

  async function newNote() {
    setCreating(true);
    try {
      const id = await createNote({ title: "", content: "" });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      openNote(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create a note");
    } finally {
      setCreating(false);
    }
  }

  // Filter chips only for subjects that have notes (and "no subject" when some have none).
  const filedSubjects = subjects.filter((subject) => notes.some((note) => note.subjectId === subject.id));
  const hasUnfiled = notes.some((note) => !note.subjectId);
  const chips = filedSubjects.length ? [{ id: "", name: "সব" }, ...filedSubjects, ...(hasUnfiled ? [{ id: "none", name: "Subject ছাড়া" }] : [])] : [];

  return <div className="space-y-3">
    {/* One slim header in the home page's blue: title, count, new note, and search. */}
    <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)] lg:hidden">
      <div className="flex items-center gap-2 pl-1">
        <h1 className="text-xl font-bold tracking-tight">নোটস</h1>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ring-1 ring-white/25">{notes.length}</span>
        <button type="button" onClick={() => void newNote()} disabled={creating} className="ml-auto flex h-9 items-center gap-1 rounded-full bg-white px-3.5 text-[13px] font-semibold text-blue-700 shadow-sm transition active:scale-95 disabled:opacity-70"><Plus className="size-4" /> নতুন</button>
      </div>
      <label className="relative mt-2.5 block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নোট খুঁজুন" aria-label="নোট খুঁজুন" className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/30" />
      </label>
    </section>

    <div className="hidden items-center justify-between gap-4 lg:flex">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">নোটস</h1>
        <p className="mt-0.5 text-sm text-slate-500">পড়ার নোট লিখে রাখুন; AI দিয়ে লেখাতে বা বাড়াতে পারেন।</p>
      </div>
      <button type="button" onClick={() => void newNote()} disabled={creating} className="flex h-10 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><Plus className="size-4" /> নতুন নোট</button>
    </div>

    {/* Desktop: the row is held to the box's height (minmax(0,1fr)), so a long note scrolls inside the
        editor instead of growing past the box and being cut off. */}
    <div className="lg:grid lg:h-[calc(100dvh-13rem)] lg:min-h-[32rem] lg:grid-cols-[19rem_1fr] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:rounded-3xl lg:bg-white lg:shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]">
      {/* Phones: the list is the page; desktop: the left column. */}
      <aside className="flex min-h-0 flex-col lg:border-r lg:border-slate-100">
        <div className="hidden p-3 lg:block">
          <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নোট খুঁজুন" aria-label="নোট খুঁজুন" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        {chips.length ? <nav aria-label="Subject" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] lg:mx-0 lg:px-3">
          {chips.map((chip) => <button key={chip.id || "all"} type="button" aria-pressed={subjectFilter === chip.id} onClick={() => setSubjectFilter(chip.id)} className={cn("h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold transition", subjectFilter === chip.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)] lg:bg-slate-100 lg:shadow-none")}>{chip.name}</button>)}
        </nav> : null}

        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] lg:overflow-y-auto lg:rounded-none lg:shadow-none">
          {visible.length === 0 ? <li className="px-4 py-10 text-center text-sm text-slate-500">
            <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-orange-50"><FileText className="size-6 text-orange-500" /></span>
            {notes.length === 0 ? "এখনো কোনো নোট নেই। “নতুন” চাপুন, বা assistant-কে বলুন।" : "কোনো নোট মেলেনি।"}
          </li> : null}
          {visible.map((note) => {
            const active = isDesktop && note.id === selectedId;
            return <li key={note.id}>
              <button type="button" onClick={() => openNote(note.id)} className={cn("block w-full px-3.5 py-2.5 text-left transition active:bg-slate-50", active ? "bg-blue-50" : "hover:bg-slate-50")}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className={cn("truncate text-[15px] font-semibold", active ? "text-blue-800" : "text-slate-900")}><MathText text={note.title || "শিরোনাম নেই"} /></span>
                  <span className="shrink-0 text-[11px] text-slate-400">{updatedLabel(note.updatedAt)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] leading-snug">
                  {note.subject ? <span className="max-w-[45%] shrink-0 truncate rounded-full bg-blue-50 px-1.5 py-px text-[11px] font-medium text-blue-700">{note.subject.name}{note.topic ? ` › ${note.topic.name}` : ""}</span> : null}
                  <span className="min-w-0 flex-1 truncate text-slate-500">{note.plainText ? <MathText text={note.plainText.replace(/\s+/g, " ")} /> : "ফাঁকা নোট"}</span>
                </span>
              </button>
            </li>;
          })}
        </ul>
      </aside>

      {/* Phones: a full-screen editor over everything; desktop: the right column. */}
      <section className={cn(
        "min-w-0",
        selectedId ? "fixed inset-0 z-45 flex flex-col bg-white lg:static lg:z-auto lg:h-full lg:min-h-0 lg:overflow-hidden lg:bg-transparent" : "hidden lg:block",
      )}>
        {selectedId ? (
          <NoteEditor
            key={selectedId}
            noteId={selectedId}
            subjects={subjects}
            topics={topics}
            premium={premium}
            onSaved={refreshList}
            onDeleted={() => { closeNote(); refreshList(); }}
            onBack={closeNote}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-zinc-500">
            <FileText className="size-8 text-slate-300" />
            একটা নোট বেছে নিন, বা নতুন লিখুন।
          </div>
        )}
      </section>
    </div>
  </div>;
}
