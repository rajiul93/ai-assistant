"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, CircleHelp, ImageIcon, Lightbulb, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MathText, RichHtml } from "@/components/math-text";
import { QuillEditor, type QuillHandle } from "@/components/notes/quill-editor";
import { DictateButton } from "@/components/preliminary/question-set-form";
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
import { formatDate } from "@/lib/dayjs";
import { htmlToPlainText, isRichHtml, toEditorHtml } from "@/lib/note-html";
import { useBestMic } from "@/lib/use-best-mic";
import { SubjectTopicFilter, TopicSelect, useSubjectTopicFilter } from "@/components/subject-topic-filter";
import { topicPath, type TopicNode } from "@/lib/subject-filter";
import { cn } from "@/lib/utils";
import { createConfusion, deleteConfusion, setConfusionStatus, updateConfusion, type listConfusions } from "@/server/actions/confusions";

type Item = Awaited<ReturnType<typeof listConfusions>>[number];
type Subject = { id: string; name: string };
type Status = Item["status"];

const tabs: Array<{ status: Status; label: string; hint: string; icon: typeof CircleHelp }> = [
  { status: "CONFUSION", label: "Confusion", hint: "ক্লাসে জিজ্ঞেস করে clear করে নাও", icon: CircleHelp },
  { status: "CLEAR", label: "Clear", hint: "যেগুলো বুঝে গেছ — কী শিখলে সাথে লেখা থাকে", icon: CheckCircle2 },
];

const field = "w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400";

/** One mic for the page, pointed at whichever field's mic was tapped; what is said is added to that field. */
function useDictation(insert: (target: string, said: string) => void) {
  const [dictating, setDictating] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const target = useRef<string | null>(null);
  const end = () => { target.current = null; setDictating(null); setHeard(""); };
  const mic = useBestMic({
    context: () => (target.current?.includes("clarification") ? "How a teacher cleared up a student's doubt" : "A student's doubt about a topic, to ask in class"),
    onInterim: setHeard,
    onResult: (said) => { const at = target.current; end(); if (at) insert(at, said.trim()); },
    onError: (error) => { end(); toast.error(error.message); },
  });
  function dictate(next: string) {
    mic.stop();
    if (target.current === next) { end(); return; }
    target.current = next;
    setDictating(next);
    setHeard("");
    mic.start();
  }
  return { supported: mic.supported, dictating, heard: heard && heard !== "…" ? heard : "", dictate, stop: () => { mic.stop(); end(); } };
}

/** What the editor holds, or "" when nothing is written (a formula alone counts). */
const written = (html: string, text: string) => (text.trim() || html.includes("ql-formula") ? html : "");
/** Rich text, or plain text from before the editor, as one line of plain text. */
const plainText = (text: string) => (isRichHtml(text) ? htmlToPlainText(text) : text);
const placeholder = "কী নিয়ে confusion? গণিত লিখতে fx বোতাম চাপো";

/** A phone photo scaled down to a JPEG the AI reads well and the upload limit allows (base64, no prefix). */
async function photoToJpeg(file: File, maxSide = 2000) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
}

/** "ছবি থেকে": pick or take a photo, and its text (or just the marked part) is handed to onText. */
function useImageText(purpose: "confusion" | "clarification", onText: (text: string) => void) {
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function read(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("একটা ছবি দাও (JPG, PNG, WebP)।"); return; }
    setReading(true);
    try {
      const response = await fetch("/api/confusions/read-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: await photoToJpeg(file), purpose }) });
      const payload = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "ছবিটা পড়া গেল না।");
      if (!payload.text) { toast.error("ছবিতে কোনো লেখা পাওয়া গেল না।"); return; }
      onText(payload.text);
      toast.success("ছবি থেকে লেখা বসানো হলো — মিলিয়ে নাও");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ছবিটা পড়া গেল না।");
    } finally {
      setReading(false);
    }
  }
  const field = <input ref={input} type="file" accept="image/*" className="hidden" onChange={(event) => { void read(event.target.files?.[0]); event.target.value = ""; }} />;
  return { reading, pick: () => input.current?.click(), field };
}

function PhotoButton({ reading, onClick }: { reading: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={reading} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-60">
    {reading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />} {reading ? "ছবি পড়ছে…" : "ছবি থেকে"}
  </button>;
}

function Listening({ heard }: { heard: string }) {
  return <p role="status" className="flex items-center gap-2 text-xs font-medium text-red-600"><span className="size-2 shrink-0 animate-pulse rounded-full bg-red-500" />{heard || "শুনছি… বলো"}</p>;
}

/** Edit a confusion, or mark it Clear with what made it clear. */
function ConfusionDialog({ item, mode, subjects, topics, onClose }: { item: Item; mode: "edit" | "clear"; subjects: Subject[]; topics: TopicNode[]; onClose: () => void }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(item.subjectId ?? "");
  const [topicId, setTopicId] = useState(item.topicId ?? "");
  // Older entries have a free-text topic; it's kept as it is.
  const topic = item.topic ?? "";
  // Both are editor HTML; older plain-text entries are turned into paragraphs once, here.
  const [initial] = useState(() => ({ text: toEditorHtml(item.text), clarification: toEditorHtml(item.clarification) }));
  const [text, setText] = useState(initial.text);
  const [clarification, setClarification] = useState(initial.clarification);
  const textEditor = useRef<QuillHandle>(null);
  const clarificationEditor = useRef<QuillHandle>(null);
  const [pending, start] = useTransition();
  const voice = useDictation((target, said) => {
    if (target === "dialog-text") textEditor.current?.insertText(said);
    if (target === "dialog-clarification") clarificationEditor.current?.insertText(said);
  });
  const showClarification = mode === "clear" || item.status === "CLEAR";
  const photo = useImageText("clarification", (read) => clarificationEditor.current?.insertText(read, true));

  const save = () => start(async () => {
    try {
      if (mode === "clear") {
        await setConfusionStatus(item.id, "CLEAR", clarification);
        toast.success("Clear হয়েছে!");
      } else {
        await updateConfusion(item.id, { subjectId: subjectId || null, topicId: topicId || null, topic, text, ...(showClarification ? { clarification } : {}) });
        toast.success("সেভ হলো");
      }
      voice.stop();
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "সেভ করা গেল না।");
    }
  });

  return <Dialog open onOpenChange={(open) => { if (!open && !pending) { voice.stop(); onClose(); } }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{mode === "clear" ? "Clear হয়েছে — কী বুঝলে?" : "Confusion edit করো"}</DialogTitle></DialogHeader>
      {mode === "clear"
        ? <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950"><RichHtml html={initial.text} className="confusion-text" /></div>
        : <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">Subject</span>
              <select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId(""); }} className={cn(field, "h-11")}>
                <option value="">Subject ছাড়া (Other)</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">Topic (ইচ্ছা হলে)</span><TopicSelect subjectId={subjectId} topics={topics} value={topicId} onChange={setTopicId} className={cn(field, "h-11 disabled:bg-zinc-50 disabled:text-zinc-400")} />{topic ? <span className="block text-xs text-zinc-500">আগে লেখা: {topic}</span> : null}</label>
          </div>
          {/* A div, not a label: a label would pass clicks in the editor on to its first toolbar button. */}
          <div className="space-y-1.5">
            <div className="flex min-h-8 items-center justify-between gap-2"><span className="text-xs font-medium text-zinc-600">কী নিয়ে confusion</span>
              {voice.supported ? <DictateButton active={voice.dictating === "dialog-text"} onClick={() => voice.dictate("dialog-text")} label="Confusion" /> : null}</div>
            <div className="task-editor"><QuillEditor handleRef={textEditor} initialHtml={initial.text} placeholder={placeholder} onChange={(html, plain) => setText(written(html, plain))} /></div>
          </div>
        </div>}
      {showClarification ? <div className="space-y-1.5">
        <div className="flex min-h-8 items-center justify-between gap-2"><span className="text-xs font-medium text-emerald-700">কীভাবে clear হলো (ইচ্ছা হলে)</span>
          {voice.supported ? <DictateButton active={voice.dictating === "dialog-clarification"} onClick={() => voice.dictate("dialog-clarification")} label="ব্যাখ্যা" /> : null}</div>
        <div className="task-editor"><QuillEditor handleRef={clarificationEditor} initialHtml={initial.clarification} placeholder="স্যার/ম্যাম যা বুঝিয়েছেন, বা নিজে যা বুঝলে — পরে রিভিশনে কাজে লাগবে" onChange={(html, plain) => setClarification(written(html, plain))} /></div>
      </div> : null}
      {showClarification ? <div className="flex items-center justify-between gap-2">{voice.dictating ? <Listening heard={voice.heard} /> : <span className="text-xs text-zinc-500">বোর্ড বা খাতার ছবি থেকেও লেখা যায়</span>}<PhotoButton reading={photo.reading} onClick={photo.pick} />{photo.field}</div>
        : voice.dictating ? <Listening heard={voice.heard} /> : null}
      <button type="button" onClick={save} disabled={pending || photo.reading || !text.trim()} className={cn("h-11 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-50", mode === "clear" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-950 hover:bg-zinc-800")}>
        {pending ? "সেভ হচ্ছে…" : mode === "clear" ? "Clear-এ নাও" : "সেভ করো"}
      </button>
    </DialogContent>
  </Dialog>;
}

function ConfusionCard({ item, place, onEdit, onClear, onDelete }: { item: Item; place: string; onEdit: () => void; onClear: () => void; onDelete: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const reopen = () => start(async () => {
    try { await setConfusionStatus(item.id, "CONFUSION"); toast.success("আবার Confusion-এ নেওয়া হলো"); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't move it."); }
  });
  const clear = item.status === "CLEAR";

  return <article className={cn("rounded-2xl border bg-white p-4", clear ? "border-zinc-200" : "border-amber-200")}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
          <span className="font-medium text-indigo-600">{place}</span>
          {item.topic && !item.topicId ? <span>· {item.topic}</span> : null}
          <span className="flex items-center gap-1">· <CalendarDays className="size-3.5" />{formatDate(item.createdAt)}</span>
        </p>
        <RichHtml html={toEditorHtml(item.text)} className="confusion-text mt-1.5 text-[0.95rem] text-zinc-950" />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={onEdit} aria-label="Edit" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><Pencil className="size-4" /></button>
        <button type="button" onClick={onDelete} aria-label="Delete" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
      </div>
    </div>
    {clear && item.clarification ? <div className="mt-3 flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950"><Lightbulb className="mt-0.5 size-4 shrink-0 text-emerald-600" /><RichHtml html={toEditorHtml(item.clarification)} className="confusion-text min-w-0 flex-1" /></div> : null}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {clear
        ? <>
          {item.clearedAt ? <span className="mr-auto text-xs text-emerald-700">Clear: {formatDate(item.clearedAt)}</span> : null}
          <button type="button" disabled={pending} onClick={reopen} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"><RotateCcw className="size-4" /> আবার confusion</button>
        </>
        : <button type="button" onClick={onClear} className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-700"><CheckCircle2 className="size-4" /> Clear হয়েছে</button>}
    </div>
  </article>;
}

/** Confusion: doubts to ask in class, in two columns — Confusion and Clear. */
export function ConfusionBoard({ items, subjects, topics = [] }: { items: Item[]; subjects: Subject[]; topics?: TopicNode[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active: Status = searchParams.get("status")?.toUpperCase() === "CLEAR" ? "CLEAR" : "CONFUSION";
  const [dialog, setDialog] = useState<{ item: Item; mode: "edit" | "clear" } | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const deletingText = deleting ? plainText(deleting.text) : "";

  // Quick add.
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [text, setText] = useState("");
  // Quill is uncontrolled: a new key gives an empty editor after adding.
  const [editorKey, setEditorKey] = useState(0);
  const editor = useRef<QuillHandle>(null);
  const [adding, startAdding] = useTransition();
  const voice = useDictation((target, said) => {
    if (target === "add-text") editor.current?.insertText(said);
  });
  const photo = useImageText("confusion", (read) => editor.current?.insertText(read, true));
  const add = () => startAdding(async () => {
    try {
      await createConfusion({ subjectId: subjectId || null, topicId: topicId || null, topic: "", text });
      setText("");
      setEditorKey((key) => key + 1);
      toast.success("Confusion লেখা হলো — ক্লাসে জিজ্ঞেস করো");
      if (active !== "CONFUSION") router.replace(`${pathname}?status=confusion`, { scroll: false });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "সেভ করা গেল না।");
    }
  });

  // Filed under the user's subject → topic tree; the tabs count only what the filter shows.
  const filter = useSubjectTopicFilter(subjects, topics);
  const inScope = items.filter((item) => filter.matches(item));
  const counts = { CONFUSION: inScope.filter((item) => item.status === "CONFUSION").length, CLEAR: inScope.filter((item) => item.status === "CLEAR").length };
  const inTab = inScope.filter((item) => item.status === active);
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
  /** "Subject › Topic" for a card; "Other" when it has no (existing) subject. */
  const placeOf = (item: Item) => {
    const subject = item.subjectId ? subjectNames.get(item.subjectId) : undefined;
    if (!subject) return "Other";
    const topic = item.topicId ? topicById.get(item.topicId) : undefined;
    return topic ? `${subject} › ${topicPath(topic, topics)}` : subject;
  };
  // Only subjects that have something in this tab, so the filter stays short.
  const visible = inTab.filter((item) => filter.matches(item));

  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Confusion</h1>
      <p className="mt-1 text-sm text-zinc-500">পড়তে গিয়ে যা বুঝলে না লিখে রাখো, ক্লাসে জিজ্ঞেস করে Clear করো।</p>
    </div>

    <section className="space-y-2.5 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId(""); }} aria-label="Subject" className={cn(field, "h-11")}>
          <option value="">Subject বেছে নাও (না দিলে Other)</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <TopicSelect subjectId={subjectId} topics={topics} value={topicId} onChange={setTopicId} className={cn(field, "h-11 disabled:bg-zinc-50 disabled:text-zinc-400")} />
      </div>
      <div className="task-editor"><QuillEditor key={editorKey} handleRef={editor} initialHtml="" placeholder={placeholder} onChange={(html, plain) => setText(written(html, plain))} /></div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {voice.supported ? <DictateButton active={voice.dictating === "add-text"} onClick={() => voice.dictate("add-text")} label="Confusion" /> : null}
          {voice.dictating ? <Listening heard={voice.heard} /> : <PhotoButton reading={photo.reading} onClick={photo.pick} />}
        </div>
        {photo.field}
        <button type="button" onClick={add} disabled={adding || photo.reading || !text.trim()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"><Plus className="size-4" /> {adding ? "লেখা হচ্ছে…" : "যোগ করো"}</button>
      </div>
    </section>

    <SubjectTopicFilter subjects={subjects} topics={topics} items={items} selection={filter.selection} onSelect={filter.select} matches={filter.matches} />

    <div role="tablist" aria-label="Status" className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1">
      {tabs.map((tab) => <button
        key={tab.status}
        type="button"
        role="tab"
        aria-selected={active === tab.status}
        onClick={() => {
          // Keep the subject/topic filter while switching tabs.
          const params = new URLSearchParams(searchParams.toString());
          params.set("status", tab.status.toLowerCase());
          router.replace(`${pathname}?${params}`, { scroll: false });
        }}
        className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition", active === tab.status ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
      >
        <tab.icon className={cn("size-4", tab.status === "CONFUSION" ? "text-amber-500" : "text-emerald-600")} />
        {tab.label}
        {counts[tab.status] ? <span className="rounded-full bg-zinc-200/70 px-1.5 text-[11px] tabular-nums text-zinc-600">{counts[tab.status]}</span> : null}
      </button>)}
    </div>
    <p className={cn("text-xs", active === "CONFUSION" ? "text-amber-700" : "text-emerald-700")}>{tabs.find((tab) => tab.status === active)?.hint}</p>


    {visible.length
      ? <div className="space-y-3">{visible.map((item) => <ConfusionCard key={item.id} item={item} place={placeOf(item)} onEdit={() => setDialog({ item, mode: "edit" })} onClear={() => setDialog({ item, mode: "clear" })} onDelete={() => setDeleting(item)} />)}</div>
      : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">{active === "CONFUSION" ? "কোনো confusion নেই — উপরে লিখে রাখো।" : "এখনো কিছু Clear হয়নি।"}</div>}

    {dialog ? <ConfusionDialog key={dialog.item.id + dialog.mode} item={dialog.item} mode={dialog.mode} subjects={subjects} topics={topics} onClose={() => setDialog(null)} /> : null}

    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>এটা মুছে ফেলবে?</AlertDialogTitle>
        <AlertDialogDescription>“<MathText text={`${deletingText.slice(0, 80)}${deletingText.length > 80 ? "…" : ""}`} />” মুছে যাবে। ফেরানো যাবে না।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখো</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
            const target = deleting;
            setDeleting(null);
            if (target) void deleteConfusion(target.id).then(() => { toast.success("মুছে ফেলা হলো"); router.refresh(); }).catch((error: Error) => toast.error(error.message));
          }}>মুছে ফেলো</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
