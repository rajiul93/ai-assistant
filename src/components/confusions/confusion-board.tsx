"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, CircleHelp, ImageIcon, Lightbulb, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MathText } from "@/components/math-text";
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
import { useBestMic } from "@/lib/use-best-mic";
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

const joinSpoken = (current: string, said: string) => (current.trim() ? `${current.trimEnd()} ${said}` : said);
const joinRead = (current: string, read: string) => (current.trim() ? `${current.trimEnd()}\n${read}` : read);

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
function ConfusionDialog({ item, mode, subjects, onClose }: { item: Item; mode: "edit" | "clear"; subjects: Subject[]; onClose: () => void }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(item.subjectId ?? "");
  const [topic, setTopic] = useState(item.topic ?? "");
  const [text, setText] = useState(item.text);
  const [clarification, setClarification] = useState(item.clarification ?? "");
  const [pending, start] = useTransition();
  const voice = useDictation((target, said) => {
    if (target === "dialog-text") setText((value) => joinSpoken(value, said));
    if (target === "dialog-clarification") setClarification((value) => joinSpoken(value, said));
  });
  const showClarification = mode === "clear" || item.status === "CLEAR";
  const photo = useImageText("clarification", (read) => setClarification((value) => joinRead(value, read)));

  const save = () => start(async () => {
    try {
      if (mode === "clear") {
        await setConfusionStatus(item.id, "CLEAR", clarification);
        toast.success("Clear হয়েছে!");
      } else {
        await updateConfusion(item.id, { subjectId: subjectId || null, topic, text, ...(showClarification ? { clarification } : {}) });
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
        ? <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950"><MathText text={item.text} /></div>
        : <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">Subject</span>
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={cn(field, "h-11")}>
                <option value="">Subject ছাড়া</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">Topic (ইচ্ছা হলে)</span><input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={160} className={cn(field, "h-11")} /></label>
          </div>
          <label className="block space-y-1.5"><span className="text-xs font-medium text-zinc-600">কী নিয়ে confusion</span>
            <div className="relative">
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} className={cn(field, "resize-y py-2.5 leading-relaxed", voice.supported && "pr-11")} />
              {voice.supported ? <DictateButton active={voice.dictating === "dialog-text"} onClick={() => voice.dictate("dialog-text")} label="Confusion" className="absolute right-1.5 top-1.5" /> : null}
            </div>
          </label>
        </div>}
      {showClarification ? <label className="block space-y-1.5"><span className="text-xs font-medium text-emerald-700">কীভাবে clear হলো (ইচ্ছা হলে)</span>
        <div className="relative">
          <textarea value={clarification} onChange={(event) => setClarification(event.target.value)} rows={4} autoFocus={mode === "clear"} placeholder="স্যার/ম্যাম যা বুঝিয়েছেন, বা নিজে যা বুঝলে — পরে রিভিশনে কাজে লাগবে" className={cn(field, "resize-y border-emerald-200 py-2.5 leading-relaxed", voice.supported && "pr-11")} />
          {voice.supported ? <DictateButton active={voice.dictating === "dialog-clarification"} onClick={() => voice.dictate("dialog-clarification")} label="ব্যাখ্যা" className="absolute right-1.5 top-1.5" /> : null}
        </div>
      </label> : null}
      {showClarification ? <div className="flex items-center justify-between gap-2">{voice.dictating ? <Listening heard={voice.heard} /> : <span className="text-xs text-zinc-500">বোর্ড বা খাতার ছবি থেকেও লেখা যায়</span>}<PhotoButton reading={photo.reading} onClick={photo.pick} />{photo.field}</div>
        : voice.dictating ? <Listening heard={voice.heard} /> : null}
      <button type="button" onClick={save} disabled={pending || photo.reading || !text.trim()} className={cn("h-11 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-50", mode === "clear" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-950 hover:bg-zinc-800")}>
        {pending ? "সেভ হচ্ছে…" : mode === "clear" ? "Clear-এ নাও" : "সেভ করো"}
      </button>
    </DialogContent>
  </Dialog>;
}

function ConfusionCard({ item, onEdit, onClear, onDelete }: { item: Item; onEdit: () => void; onClear: () => void; onDelete: () => void }) {
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
          <span className="font-medium text-indigo-600">{item.subject?.name ?? "Subject নেই"}</span>
          {item.topic ? <span>· {item.topic}</span> : null}
          <span className="flex items-center gap-1">· <CalendarDays className="size-3.5" />{formatDate(item.createdAt)}</span>
        </p>
        <p className="mt-1.5 whitespace-pre-line font-medium leading-relaxed"><MathText text={item.text} /></p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={onEdit} aria-label="Edit" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><Pencil className="size-4" /></button>
        <button type="button" onClick={onDelete} aria-label="Delete" className="flex size-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
      </div>
    </div>
    {clear && item.clarification ? <div className="mt-3 flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950"><Lightbulb className="mt-0.5 size-4 shrink-0 text-emerald-600" /><p className="min-w-0 whitespace-pre-line"><MathText text={item.clarification} /></p></div> : null}
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
export function ConfusionBoard({ items, subjects }: { items: Item[]; subjects: Subject[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active: Status = searchParams.get("status")?.toUpperCase() === "CLEAR" ? "CLEAR" : "CONFUSION";
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [dialog, setDialog] = useState<{ item: Item; mode: "edit" | "clear" } | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);

  // Quick add.
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [adding, startAdding] = useTransition();
  const voice = useDictation((target, said) => {
    if (target === "add-text") setText((value) => joinSpoken(value, said));
    if (target === "add-topic") setTopic((value) => joinSpoken(value, said.replace(/[।.]$/, "")));
  });
  const photo = useImageText("confusion", (read) => setText((value) => joinRead(value, read)));
  const add = () => startAdding(async () => {
    try {
      await createConfusion({ subjectId: subjectId || null, topic, text });
      setText("");
      toast.success("Confusion লেখা হলো — ক্লাসে জিজ্ঞেস করো");
      if (active !== "CONFUSION") router.replace(`${pathname}?status=confusion`, { scroll: false });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "সেভ করা গেল না।");
    }
  });

  const counts = { CONFUSION: items.filter((item) => item.status === "CONFUSION").length, CLEAR: items.filter((item) => item.status === "CLEAR").length };
  const inTab = items.filter((item) => item.status === active);
  // Only subjects that have something in this tab, so the filter stays short.
  const tabSubjects = subjects.filter((subject) => inTab.some((item) => item.subjectId === subject.id));
  const visible = inTab.filter((item) => subjectFilter === "all" || (subjectFilter === "none" ? !item.subjectId : item.subjectId === subjectFilter));

  return <div className="mx-auto max-w-3xl space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Confusion</h1>
      <p className="mt-1 text-sm text-zinc-500">পড়তে গিয়ে যা বুঝলে না লিখে রাখো, ক্লাসে জিজ্ঞেস করে Clear করো।</p>
    </div>

    <section className="space-y-2.5 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} aria-label="Subject" className={cn(field, "h-11")}>
          <option value="">Subject বেছে নাও (ইচ্ছা হলে)</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <div className="relative">
          <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={160} placeholder="Topic (ইচ্ছা হলে)" aria-label="Topic" className={cn(field, "h-11", voice.supported && "pr-11")} />
          {voice.supported ? <DictateButton active={voice.dictating === "add-topic"} onClick={() => voice.dictate("add-topic")} label="Topic" className="absolute right-1.5 top-1.5" /> : null}
        </div>
      </div>
      <div className="relative">
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder={voice.supported ? "কী নিয়ে confusion? লেখো বা 🎤 চেপে বলো" : "কী নিয়ে confusion?"} aria-label="Confusion" className={cn(field, "resize-y py-2.5 leading-relaxed", voice.supported && "pr-11")} />
        {voice.supported ? <DictateButton active={voice.dictating === "add-text"} onClick={() => voice.dictate("add-text")} label="Confusion" className="absolute right-1.5 top-1.5" /> : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        {voice.dictating ? <Listening heard={voice.heard} /> : <PhotoButton reading={photo.reading} onClick={photo.pick} />}
        {photo.field}
        <button type="button" onClick={add} disabled={adding || photo.reading || !text.trim()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"><Plus className="size-4" /> {adding ? "লেখা হচ্ছে…" : "যোগ করো"}</button>
      </div>
    </section>

    <div role="tablist" aria-label="Status" className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1">
      {tabs.map((tab) => <button
        key={tab.status}
        type="button"
        role="tab"
        aria-selected={active === tab.status}
        onClick={() => { setSubjectFilter("all"); router.replace(`${pathname}?status=${tab.status.toLowerCase()}`, { scroll: false }); }}
        className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition", active === tab.status ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
      >
        <tab.icon className={cn("size-4", tab.status === "CONFUSION" ? "text-amber-500" : "text-emerald-600")} />
        {tab.label}
        {counts[tab.status] ? <span className="rounded-full bg-zinc-200/70 px-1.5 text-[11px] tabular-nums text-zinc-600">{counts[tab.status]}</span> : null}
      </button>)}
    </div>
    <p className={cn("text-xs", active === "CONFUSION" ? "text-amber-700" : "text-emerald-700")}>{tabs.find((tab) => tab.status === active)?.hint}</p>

    {tabSubjects.length > 1 || (tabSubjects.length && inTab.some((item) => !item.subjectId)) ? <div className="flex flex-wrap gap-1.5">
      {[{ id: "all", name: `সব (${inTab.length})` }, ...tabSubjects, ...(inTab.some((item) => !item.subjectId) ? [{ id: "none", name: "Subject নেই" }] : [])].map((subject) => (
        <button key={subject.id} type="button" onClick={() => setSubjectFilter(subject.id)} aria-pressed={subjectFilter === subject.id} className={cn("h-8 rounded-full px-3 text-xs font-medium ring-1 transition", subjectFilter === subject.id ? "bg-zinc-950 text-white ring-zinc-950" : "bg-white text-zinc-600 ring-zinc-200 hover:ring-zinc-400")}>{subject.name}</button>
      ))}
    </div> : null}

    {visible.length
      ? <div className="space-y-3">{visible.map((item) => <ConfusionCard key={item.id} item={item} onEdit={() => setDialog({ item, mode: "edit" })} onClear={() => setDialog({ item, mode: "clear" })} onDelete={() => setDeleting(item)} />)}</div>
      : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">{active === "CONFUSION" ? "কোনো confusion নেই — উপরে লিখে রাখো।" : "এখনো কিছু Clear হয়নি।"}</div>}

    {dialog ? <ConfusionDialog key={dialog.item.id + dialog.mode} item={dialog.item} mode={dialog.mode} subjects={subjects} onClose={() => setDialog(null)} /> : null}

    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>এটা মুছে ফেলবে?</AlertDialogTitle>
        <AlertDialogDescription>“{deleting?.text.slice(0, 80)}{(deleting?.text.length ?? 0) > 80 ? "…" : ""}” মুছে যাবে। ফেরানো যাবে না।</AlertDialogDescription>
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
