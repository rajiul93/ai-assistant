"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Search, Sparkles, Trash2 } from "lucide-react";
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
    <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5">
      <button type="button" onClick={onBack} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden" aria-label="Back to notes"><ArrowLeft className="size-4" /></button>
      <p className={cn("text-xs", saveState === "error" ? "text-red-600" : "text-zinc-400")} aria-live="polite">{saveLabel}</p>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={() => setAiOpen(!aiOpen)} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition", aiOpen ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100")}>
          <Sparkles className="size-4" /> Write with AI
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-700" aria-label="Delete note"><Trash2 className="size-4" /></button>
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

    <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
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

export function NotesWorkspace({ initialNotes }: { initialNotes: NoteSummary[] }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notesQuery = useQuery({ queryKey: ["notes"], queryFn: () => listNotes(), initialData: initialNotes });
  const notes = notesQuery.data;
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("id") ?? initialNotes[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? notes.filter((note) => `${note.title}\n${note.plainText}`.toLowerCase().includes(needle)) : notes;
  }, [notes, search]);

  const refreshList = () => void queryClient.invalidateQueries({ queryKey: ["notes"] });

  async function newNote() {
    setCreating(true);
    try {
      const id = await createNote({ title: "", content: "" });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(id);
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
        <p className="mt-1 text-sm text-zinc-500">Write and keep your study notes. Ask the AI to write or expand them.</p>
      </div>
      <Button onClick={() => void newNote()} disabled={creating} className="gap-2"><Plus className="size-4" /> New note</Button>
    </div>

    <div className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:h-[calc(100dvh-13rem)] lg:min-h-[32rem] lg:grid-cols-[18rem_1fr]">
      <aside className={cn("flex min-h-0 flex-col border-zinc-200 lg:border-r", selectedId && "hidden lg:flex")}>
        <div className="border-b border-zinc-100 p-3">
          <label className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3">
            <Search className="size-4 text-zinc-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" aria-label="Search notes" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {visible.length === 0 ? <li className="px-3 py-10 text-center text-sm text-zinc-500">{notes.length === 0 ? "No notes yet. Create one, or ask the assistant to write one." : "No notes match your search."}</li> : null}
          {visible.map((note) => <li key={note.id}>
            <button type="button" onClick={() => setSelectedId(note.id)} className={cn("w-full rounded-xl px-3 py-2.5 text-left transition", note.id === selectedId ? "bg-zinc-950 text-white" : "hover:bg-zinc-50")}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{note.title || "Untitled note"}</span>
                <span className={cn("shrink-0 text-[11px]", note.id === selectedId ? "text-white/60" : "text-zinc-400")}>{updatedLabel(note.updatedAt)}</span>
              </span>
              <span className={cn("mt-0.5 line-clamp-2 text-xs", note.id === selectedId ? "text-white/70" : "text-zinc-500")}>{note.plainText.replace(/\s+/g, " ") || "Empty note"}</span>
            </button>
          </li>)}
        </ul>
      </aside>

      <section className={cn("min-h-[60dvh] min-w-0 lg:min-h-0", !selectedId && "hidden lg:block")}>
        {selectedId ? (
          <NoteEditor
            key={selectedId}
            noteId={selectedId}
            onSaved={refreshList}
            onDeleted={() => { setSelectedId(null); refreshList(); }}
            onBack={() => setSelectedId(null)}
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
