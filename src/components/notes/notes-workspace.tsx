"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, FileText, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { QuillEditor, type QuillHandle } from "@/components/notes/quill-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { APP_TIMEZONE, dayjs } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { createNote, deleteNote, generateNoteContent, getNote, listNotes, updateNote } from "@/server/actions/notes";
import { useAssistantStore } from "@/store/assistant";

type NoteSummary = Awaited<ReturnType<typeof listNotes>>[number];
type SaveState = "saved" | "saving" | "unsaved" | "error";

function updatedLabel(date: Date) {
  const value = dayjs(date).tz(APP_TIMEZONE);
  return value.isSame(dayjs().tz(APP_TIMEZONE), "day") ? value.format("h:mm A") : value.format("D MMM YYYY");
}

/** Editor for one note: title + Quill body, autosaved 0.8s after typing stops, plus AI writing. */
function NoteEditor({ noteId, onSaved, onDeleted, onBack }: { noteId: string; onSaved: () => void; onDeleted: () => void; onBack: () => void }) {
  const noteQuery = useQuery({ queryKey: ["note", noteId], queryFn: () => getNote(noteId), staleTime: 0 });
  const lang = useAssistantStore((state) => state.lang);
  const editorRef = useRef<QuillHandle>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [writing, setWriting] = useState(false);
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
  useEffect(() => {
    if (note) latest.current = { title: note.title, content: note.content };
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
      const html = await generateNoteContent({ instruction: text, title: shownTitle, currentText: editorRef.current?.getText() ?? "", lang });
      editorRef.current?.insertHtml(html);
      setInstruction("");
      setAiOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI couldn't write this");
    } finally {
      setWriting(false);
    }
  }

  if (noteQuery.isPending) return <div className="space-y-3 p-6"><div className="h-9 w-2/3 animate-pulse rounded-lg bg-zinc-100" /><div className="h-64 animate-pulse rounded-xl bg-zinc-100" /></div>;
  if (!note) return <p className="p-6 text-sm text-zinc-500">This note couldn&apos;t be loaded.</p>;

  const saveLabel = { saved: "Saved", saving: "Saving…", unsaved: "Unsaved changes", error: "Couldn't save — retrying on next edit" }[saveState];

  return <div className="flex h-full flex-col">
    {/* Phones: this is the top bar of a full-screen editor (with room for the notch). */}
    <div className="flex items-center gap-1 border-b border-zinc-100 px-2 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] lg:gap-2 lg:px-4 lg:py-2.5">
      <button type="button" onClick={onBack} className="flex h-10 items-center gap-0.5 rounded-lg pl-1 pr-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 lg:hidden" aria-label="Back to notes"><ChevronLeft className="size-5" /> Notes</button>
      <p className={cn("ml-1 truncate text-xs", saveState === "error" ? "text-red-600" : "text-zinc-400")} aria-live="polite">{saveLabel}</p>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => setAiOpen(!aiOpen)} className={cn("flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition lg:h-8 lg:px-2.5", aiOpen ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100")}>
          <Sparkles className="size-4" /> <span className="lg:hidden">AI</span><span className="hidden lg:inline">Write with AI</span>
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} className="flex size-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-700 lg:size-8" aria-label="Delete note"><Trash2 className="size-4" /></button>
      </div>
    </div>

    {aiOpen ? <form className="flex flex-col gap-2 border-b border-indigo-100 bg-indigo-50/50 px-4 py-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void writeWithAi(); }}>
      <input
        autoFocus
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder={lang === "en" ? "e.g. Explain Newton's 3 laws with examples" : "যেমন: Newton-এর ৩টি সূত্র উদাহরণসহ বুঝিয়ে লেখো"}
        className="h-10 min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
      />
      <Button type="submit" disabled={writing || !instruction.trim()} className="gap-2">
        <Sparkles className="size-4" /> {writing ? "Writing…" : "Write"}
      </Button>
    </form> : null}

    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 lg:px-6 lg:pb-6">
      <input
        value={shownTitle}
        onChange={(event) => { setTitle(event.target.value); scheduleSave({ title: event.target.value }); }}
        placeholder="Title"
        maxLength={200}
        className="mb-3 w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-zinc-300"
      />
      <QuillEditor
        key={note.id}
        handleRef={editorRef}
        initialHtml={note.content}
        placeholder={lang === "en" ? "Start writing your note…" : "এখানে note লেখা শুরু করো…"}
        onChange={(html) => scheduleSave({ content: html })}
      />
    </div>

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <div className="space-y-1">
          <AlertDialogTitle>Delete this note?</AlertDialogTitle>
          <AlertDialogDescription>“{shownTitle || "Untitled note"}” will be removed permanently.</AlertDialogDescription>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            clearTimeout(timer.current);
            timer.current = undefined;
            void deleteNote(noteId).then(() => { toast.success("Note deleted"); onDeleted(); }).catch((error: Error) => toast.error(error.message));
          }}>Delete</AlertDialogAction>
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

export function NotesWorkspace({ initialNotes }: { initialNotes: NoteSummary[] }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const notesQuery = useQuery({ queryKey: ["notes"], queryFn: () => listNotes(), initialData: initialNotes });
  const notes = notesQuery.data;
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  // Set when this page pushed the open note onto history, so "‹ Notes" can simply go back.
  const pushedNote = useRef(false);
  // The open note lives in the URL (?id=), so browser/phone back closes it.
  const urlId = searchParams.get("id");
  const selectedId = urlId ?? (isDesktop ? notes[0]?.id ?? null : null);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? notes.filter((note) => `${note.title}\n${note.plainText}`.toLowerCase().includes(needle)) : notes;
  }, [notes, search]);

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

  return <div className="space-y-4">
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="lg:hidden">{notes.length} note{notes.length === 1 ? "" : "s"}</span>
          <span className="hidden lg:inline">Write and keep your study notes. Ask the AI to write or expand them.</span>
        </p>
      </div>
      <Button onClick={() => void newNote()} disabled={creating} className="h-10 gap-1.5 rounded-xl"><Plus className="size-4" /> New<span className="hidden sm:inline"> note</span></Button>
    </div>

    <div className="lg:grid lg:h-[calc(100dvh-13rem)] lg:min-h-[32rem] lg:grid-cols-[18rem_1fr] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-zinc-200 lg:bg-white">
      {/* Phones: the list is the page; desktop: the left column. */}
      <aside className="flex min-h-0 flex-col lg:border-r lg:border-zinc-200">
        <div className="pb-3 lg:border-b lg:border-zinc-100 lg:p-3">
          <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 lg:rounded-lg lg:border-0 lg:bg-zinc-100">
            <Search className="size-4 shrink-0 text-zinc-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" aria-label="Search notes" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none lg:h-9" />
          </label>
        </div>
        <ul className="min-h-0 flex-1 space-y-2 lg:space-y-0 lg:overflow-y-auto lg:p-2">
          {visible.length === 0 ? <li className="rounded-2xl border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 lg:border-0">
            <FileText className="mx-auto mb-2 size-7 text-zinc-300" />
            {notes.length === 0 ? "No notes yet. Tap “New” to write one, or ask the assistant." : "No notes match your search."}
          </li> : null}
          {visible.map((note) => {
            const active = isDesktop && note.id === selectedId;
            return <li key={note.id}>
              <button
                type="button"
                onClick={() => openNote(note.id)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99] lg:rounded-xl lg:border-0 lg:px-3 lg:py-2.5",
                  active ? "border-transparent bg-zinc-950 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50",
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold lg:text-sm lg:font-medium">{note.title || "Untitled note"}</span>
                  <span className={cn("shrink-0 text-xs lg:text-[11px]", active ? "text-white/60" : "text-zinc-400")}>{updatedLabel(note.updatedAt)}</span>
                </span>
                <span className={cn("mt-1 line-clamp-2 text-sm leading-snug lg:mt-0.5 lg:text-xs", active ? "text-white/70" : "text-zinc-500")}>{note.plainText.replace(/\s+/g, " ") || "Empty note"}</span>
              </button>
            </li>;
          })}
        </ul>
      </aside>

      {/* Phones: a full-screen editor over everything; desktop: the right column. */}
      <section className={cn(
        "min-w-0",
        selectedId ? "fixed inset-0 z-45 flex flex-col bg-white lg:static lg:z-auto lg:bg-transparent" : "hidden lg:block",
      )}>
        {selectedId ? (
          <NoteEditor
            key={selectedId}
            noteId={selectedId}
            onSaved={refreshList}
            onDeleted={() => { closeNote(); refreshList(); }}
            onBack={closeNote}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-zinc-500">
            <FileText className="size-8 text-zinc-300" />
            Pick a note, or create a new one.
          </div>
        )}
      </section>
    </div>
  </div>;
}
