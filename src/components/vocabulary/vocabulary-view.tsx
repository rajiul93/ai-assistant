"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpenText, Check, ChevronDown, Eye, EyeOff, Loader2, Lock, Pencil, Plus, Search, Sparkles, Trash2, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { canPronounce, pronounce, useSpeaking } from "@/lib/pronounce";
import { cn } from "@/lib/utils";
import { bareAffix } from "@/lib/vocabulary/affixes";
import { banglaVerbForms } from "@/lib/vocabulary/bangla-verb";
import { banglaPlural, nounKey, pluralRule } from "@/lib/vocabulary/nouns";
import { createAffix, createNoun, createVerb, deleteAffix, deleteNoun, deleteVerb, setLearned, updateAffix, updateNoun, updateVerb, type getVocabState, type listAffixes, type listNouns, type listVerbs } from "@/server/actions/vocabulary";
import { VocabDone } from "@/components/vocabulary/vocab-done";
import { BATCH_SIZE, PASS_PERCENT } from "@/lib/vocabulary/exam";
import { errorMessage } from "@/lib/user-error";

type Verb = Awaited<ReturnType<typeof listVerbs>>[number];
type Affix = Awaited<ReturnType<typeof listAffixes>>[number];
type AffixKind = Affix["kind"];
type Noun = Awaited<ReturnType<typeof listNouns>>[number];
type LearnKind = "VERB" | "NOUN" | "AFFIX" | "PERSON";
type ExplainKind = "VERB" | "NOUN" | "AFFIX";

const tabs = [
  { id: "verbs", label: "Verb" },
  { id: "persons", label: "Person" },
  { id: "nouns", label: "Singular · Plural" },
  { id: "affixes", label: "Prefix · Suffix" },
  { id: "done", label: "Done" },
] as const;
type Tab = (typeof tabs)[number]["id"];

const input = "h-11 w-full min-w-0 rounded-xl bg-slate-100 px-3 text-[15px] outline-none ring-blue-500 transition placeholder:text-slate-400 focus:bg-white focus:ring-2";
const iconButton = "flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40";
const card = (learned: boolean) => cn("rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)] ring-1 transition", learned ? "ring-emerald-200 bg-emerald-50/40" : "ring-transparent");
// Phones: one sideways-scrolling row of chips; wider screens wrap.
const chipRow = "-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden";
const chip = (active: boolean) => cn("flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-95", active ? "bg-blue-600 text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]");

/** The user's own ticks: which rows they have finished learning (a learned word moves to Done). */
type Learned = { has: (kind: LearnKind, id: string) => boolean; toggle: (kind: LearnKind, id: string, label?: string) => void; locked: boolean };

/** Asks AI for a verb's other forms, a noun's plural, or a prefix/suffix's meaning and examples. */
async function fillWithAI(kind: "verb" | "noun" | AffixKind, word: string): Promise<Record<string, string> | null> {
  const response = await fetch("/api/vocabulary/fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, word }) });
  const payload = (await response.json().catch(() => ({}))) as Record<string, string> & { error?: string };
  if (!response.ok) { toast.error(payload.error ?? "AI পূরণ করতে পারল না।"); return null; }
  return payload;
}

/** 🔊 — says the English word with the browser's voice. Free for everyone. */
function Speak({ text, className }: { text: string; className?: string }) {
  const speaking = useSpeaking(text);
  if (!text || text === "-") return null;
  return <button
    type="button"
    onClick={(event) => { event.stopPropagation(); if (!canPronounce()) { toast.error("এই browser-এ উচ্চারণ শোনা যায় না।"); return; } pronounce(text); }}
    aria-label={`${text} — উচ্চারণ শোনো`}
    title="উচ্চারণ শোনো"
    className={cn("flex size-8 shrink-0 items-center justify-center rounded-full transition active:scale-90", speaking ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100", className)}
  ><Volume2 className={cn("size-4", speaking && "animate-pulse")} /></button>;
}

function AiButton({ busy, disabled, onClick }: { busy: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={busy || disabled} title="বাকি ঘরগুলো AI দিয়ে পূরণ করো — মিলিয়ে নিয়ে Add করো" className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-violet-50 px-3.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50">
    {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} AI
  </button>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block">
    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-full bg-white pl-10 pr-4 text-[15px] shadow-[0_2px_10px_-4px_rgba(15,23,42,0.2)] outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2" />
  </label>;
}

/** Content that can be hidden for self-testing; tap it to peek. */
function QuizCell({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const [peek, setPeek] = useState(false);
  if (!hidden || peek) return <>{children}</>;
  return <button type="button" onClick={() => setPeek(true)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-blue-50 hover:text-blue-700">দেখো</button>;
}

function HideToggle({ label, hidden, onToggle }: { label: string; hidden: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-pressed={hidden} className={cn(chip(hidden), hidden && "bg-slate-900 shadow-none")}>
    {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {label}
  </button>;
}

/** The round "learned" tick at the start of each card's top row; a lock while the set of 50 waits for its exams. */
function LearnedBox({ checked, onToggle, label, locked = false }: { checked: boolean; onToggle: () => void; label: string; locked?: boolean }) {
  return <button type="button" role="checkbox" aria-checked={checked} aria-label={`${label} — শেখা হয়েছে`} title={locked ? "আগে Done-এ exam দাও" : checked ? "শেখা হয়েছে — চাপলে উঠে যাবে" : "শেখা হলে টিক দাও — Done-এ চলে যাবে"} onClick={onToggle}
    className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90", checked ? "border-emerald-500 bg-emerald-500 text-white" : locked ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-white hover:border-emerald-500")}>
    {checked ? <Check className="size-4" strokeWidth={3} /> : locked ? <Lock className="size-3.5" /> : null}
  </button>;
}

/** A word table's progress: how many are learned (they wait in Done), and the lock when the set is full. */
function WordProgress({ done, total, locked, onDone }: { done: number; total: number; locked: boolean; onDone: () => void }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return <div className="rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)]">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-slate-800">শেখা হয়েছে <span className="text-emerald-600">{done}</span><span className="text-slate-400"> / {total}</span> <span className="font-bold text-emerald-600">· {percent}%</span></p>
      <button type="button" onClick={onDone} className="h-8 shrink-0 rounded-full bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-100">Done দেখো</button>
    </div>
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${percent}%` }} /></div>
    {locked ? <p className="mt-2.5 flex items-start gap-1.5 rounded-2xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900"><Lock className="mt-0.5 size-3.5 shrink-0" />{BATCH_SIZE}টা শব্দ শেখা হয়েছে। নতুন শব্দ নিতে Done-এ তিনটা exam দাও — প্রতিটায় {PASS_PERCENT}% পেলে পরের {BATCH_SIZE}টা খুলবে।</p> : null}
  </div>;
}

type Status = "all" | "left" | "done";

/** How much of a table this user has ticked, and a filter for what is left. */
function ProgressBar({ done, total, status, onStatus }: { done: number; total: number; status: Status; onStatus: (status: Status) => void }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return <div className="rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)]">
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-sm font-semibold text-slate-800">শেখা হয়েছে <span className="text-emerald-600">{done}</span><span className="text-slate-400"> / {total}</span></p>
      <p className="text-sm font-bold tabular-nums text-emerald-600">{percent}%</p>
    </div>
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${percent}%` }} /></div>
    <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 text-[12.5px] font-semibold">
      {([["all", "সব"], ["left", `বাকি ${total - done}`], ["done", `শেখা ${done}`]] as const).map(([id, label]) => (
        <button key={id} type="button" onClick={() => onStatus(id)} className={cn("h-8 rounded-xl transition", status === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{label}</button>
      ))}
    </div>
  </div>;
}

const matches = (query: string, ...fields: string[]) => !query.trim() || fields.some((field) => field.toLowerCase().includes(query.trim().toLowerCase()));
const inStatus = (status: Status, learned: boolean) => status === "all" || (status === "done") === learned;

/**
 * The word explained in Bangla: closed until tapped. Paid users (and staff) read it; others see a
 * lock that leads to Plans (the text never reached their page). Staff can write it with AI.
 */
function Explain({ kind, id, explanation, hasExplanation, canEdit }: { kind: ExplainKind; id: string; explanation: string | null; hasExplanation: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(explanation);
  const [busy, setBusy] = useState(false);
  const locked = hasExplanation && text === null;

  async function write() {
    setBusy(true);
    try {
      const response = await fetch("/api/vocabulary/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }) });
      const payload = (await response.json().catch(() => ({}))) as { explanation?: string; error?: string };
      if (!response.ok || !payload.explanation) { toast.error(payload.error ?? "AI লিখতে পারল না।"); return; }
      setText(payload.explanation);
      setOpen(true);
      toast.success("ব্যাখ্যা লেখা হলো — সবাই (paid) দেখতে পাবে");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!hasExplanation && !text && !canEdit) return null;
  return <div className="mt-2.5">
    <div className="flex flex-wrap items-center gap-1.5">
      {locked
        ? <Link href="/billing" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-[12.5px] font-semibold text-amber-800 ring-1 ring-amber-200"><Lock className="size-3.5" /> বাংলায় ব্যাখ্যা · Plan নিলে দেখবে</Link>
        : text ? <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition", open ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100")}>
          <BookOpenText className="size-3.5" /> বাংলায় ব্যাখ্যা <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button> : null}
      {canEdit ? <button type="button" onClick={() => void write()} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-3 text-[12.5px] font-semibold text-white shadow-[0_6px_14px_-8px_rgba(139,92,246,0.9)] disabled:opacity-60">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {text || hasExplanation ? "AI দিয়ে আবার লেখো" : "AI দিয়ে বোঝাও"}
      </button> : null}
    </div>
    {open && text ? <div className="mt-2 whitespace-pre-line rounded-2xl bg-violet-50/70 px-3.5 py-3 text-[14.5px] leading-relaxed text-slate-800 ring-1 ring-violet-100">{text}</div> : null}
  </div>;
}

function NewBadge() {
  return <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">নতুন</span>;
}

/** Edit and delete, for staff with the Vocabulary permission. */
function EditButtons({ label, pending, onEdit, onDelete }: { label: string; pending: boolean; onEdit: () => void; onDelete: () => void }) {
  return <span className="ml-auto flex shrink-0">
    <button type="button" onClick={onEdit} aria-label={`${label} edit`} className={iconButton}><Pencil className="size-4" /></button>
    <button type="button" onClick={onDelete} disabled={pending} aria-label={`${label} মুছে ফেলো`} className={cn(iconButton, "hover:bg-red-50 hover:text-red-600")}><Trash2 className="size-4" /></button>
  </span>;
}

/** A form of a word in a small tile: label, the English with 🔊, and its Bangla (both can be hidden). */
function FormTile({ label, english, bangla, hideEnglish, hideBangla, tone }: { label: string; english: string; bangla: string; hideEnglish: boolean; hideBangla: boolean; tone: string }) {
  return <div className={cn("min-w-0 rounded-2xl px-3 py-2", tone)}>
    <p className="text-[10.5px] font-bold uppercase tracking-wide opacity-70">{label}</p>
    <QuizCell hidden={hideEnglish}>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p className="min-w-0 flex-1 text-[16px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]">{english}</p>
        <Speak text={english} className="size-7" />
      </div>
      {bangla ? <p className="text-[13.5px] text-slate-600"><QuizCell hidden={hideBangla}>{bangla}</QuizCell></p> : null}
    </QuizCell>
  </div>;
}

/** The admin's add form, folded away behind one button. */
function AddPanel({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-blue-200 bg-white/60 text-sm font-semibold text-blue-700 transition hover:bg-white"><Plus className="size-4" /> {label}</button>;
  return <div className="relative rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)]">
    <button type="button" onClick={() => setOpen(false)} aria-label="বন্ধ করো" className={cn(iconButton, "absolute right-2 top-2")}><X className="size-4" /></button>
    <p className="mb-2.5 text-sm font-bold text-slate-900">{label}</p>
    {children(() => setOpen(false))}
  </div>;
}

function SaveBar({ pending, disabled, label = "Add" }: { pending: boolean; disabled: boolean; label?: string }) {
  return <button type="submit" disabled={pending || disabled} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] text-sm font-bold text-white shadow-[0_10px_20px_-12px_rgba(37,99,235,0.9)] disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {label}</button>;
}

/* ---------- Verb: present · past · past participle, each with its Bangla ---------- */

type VerbDraft = { present: string; past: string; pastParticiple: string; meaning: string };
const PAGE = 60;
const letters = "abcdefghijklmnopqrstuvwxyz".split("");
const emptyVerb: VerbDraft = { present: "", past: "", pastParticiple: "", meaning: "" };

function VerbTable({ verbs, canEdit, learned, onDone }: { verbs: Verb[]; canEdit: boolean; learned: Learned; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<VerbDraft>(emptyVerb);
  const [editing, setEditing] = useState<{ id: string; values: VerbDraft } | null>(null);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState({ past: false, pastParticiple: false, bangla: false });
  const [filling, setFilling] = useState(false);
  const [letter, setLetter] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [pending, start] = useTransition();
  const rows = verbs.map((verb) => ({ ...verb, bangla: banglaVerbForms(verb.meaning, verb.present), learned: learned.has("VERB", verb.id) }));
  const done = rows.filter((row) => row.learned).length;
  // A learned word leaves the list: it waits in Done (flashcards and exams).
  const filtered = rows.filter((row) => !row.learned
    && (!letter || row.present.toLowerCase().startsWith(letter))
    && matches(query, row.present, row.past, row.pastParticiple, row.meaning, row.bangla.past, row.bangla.pastParticiple));
  const shown = filtered.slice(0, limit);
  const complete = (values: VerbDraft) => Object.values(values).every((value) => value.trim());
  // Changing what is listed starts again from the top of the list.
  const narrow = (change: () => void) => { change(); setLimit(PAGE); };
  // Already in the table (the server checks again).
  const taken = (present: string, exceptId?: string) => rows.some((row) => row.present.toLowerCase() === present.trim().toLowerCase() && row.id !== exceptId);

  async function fill() {
    setFilling(true);
    const forms = await fillWithAI("verb", draft.present);
    setFilling(false);
    if (forms) setDraft((value) => ({ ...value, past: forms.past ?? value.past, pastParticiple: forms.pastParticiple ?? value.pastParticiple, meaning: forms.meaning ?? value.meaning }));
  }
  const add = () => start(async () => {
    if (taken(draft.present)) { toast.error(`“${draft.present.trim()}” আগেই table-এ আছে।`); return; }
    try { await createVerb(draft); setDraft(emptyVerb); toast.success(`“${draft.present}” যোগ হলো`); router.refresh(); } catch (error) { toast.error(errorMessage(error, "যোগ করা গেল না।")); }
  });
  const save = () => editing && start(async () => {
    if (taken(editing.values.present, editing.id)) { toast.error(`“${editing.values.present.trim()}” আগেই table-এ আছে।`); return; }
    try { await updateVerb(editing.id, editing.values); setEditing(null); toast.success("সেভ হলো"); router.refresh(); } catch (error) { toast.error(errorMessage(error, "সেভ করা গেল না।")); }
  });
  const remove = (verb: Verb) => start(async () => {
    if (!window.confirm(`“${verb.present}” মুছে ফেলবে? সবার table থেকে মুছে যাবে।`)) return;
    try { await deleteVerb(verb.id); toast.success("মুছে ফেলা হলো"); router.refresh(); } catch (error) { toast.error(errorMessage(error, "মোছা গেল না।")); }
  });

  const columns = [
    { key: "present", label: "Present (go)" },
    { key: "past", label: "Past (went)" },
    { key: "pastParticiple", label: "Past participle (gone)" },
    { key: "meaning", label: "অর্থ (যাওয়া)" },
  ] as const;

  return <section className="space-y-3">
    {canEdit ? <AddPanel label="নতুন verb যোগ করো">{() => <form onSubmit={(event) => { event.preventDefault(); if (complete(draft)) add(); }} className="space-y-2">
      <div className="flex gap-2">
        <input value={draft.present} onChange={(event) => setDraft({ ...draft, present: event.target.value })} placeholder="Present (go)" aria-label="Present" className={input} autoCapitalize="off" />
        <AiButton busy={filling} disabled={!draft.present.trim()} onClick={() => void fill()} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={draft.past} onChange={(event) => setDraft({ ...draft, past: event.target.value })} placeholder="Past (went)" aria-label="Past" className={input} autoCapitalize="off" />
        <input value={draft.pastParticiple} onChange={(event) => setDraft({ ...draft, pastParticiple: event.target.value })} placeholder="P.P. (gone)" aria-label="Past participle" className={input} autoCapitalize="off" />
      </div>
      <input value={draft.meaning} onChange={(event) => setDraft({ ...draft, meaning: event.target.value })} placeholder="অর্থ (যাওয়া)" aria-label="অর্থ" className={input} />
      <p className="text-xs text-slate-500">Present লিখে <span className="font-semibold text-violet-700">AI</span> চাপলে বাকি ঘর বসে যাবে — মিলিয়ে নাও। যোগ করা verb সবাই দেখবে।</p>
      <SaveBar pending={pending} disabled={!complete(draft)} />
    </form>}</AddPanel> : null}

    <WordProgress done={done} total={rows.length} locked={learned.locked} onDone={onDone} />
    <SearchBox value={query} onChange={(value) => narrow(() => setQuery(value))} placeholder="খুঁজো — go, went, যাওয়া…" />
    <div className={chipRow}>
      <HideToggle label="Past" hidden={hidden.past} onToggle={() => setHidden({ ...hidden, past: !hidden.past })} />
      <HideToggle label="P.P." hidden={hidden.pastParticiple} onToggle={() => setHidden({ ...hidden, pastParticiple: !hidden.pastParticiple })} />
      <HideToggle label="বাংলা" hidden={hidden.bangla} onToggle={() => setHidden({ ...hidden, bangla: !hidden.bangla })} />
    </div>
    <div className={chipRow} aria-label="প্রথম অক্ষর">
      {["", ...letters].map((item) => <button key={item || "all"} type="button" onClick={() => narrow(() => setLetter(item))} aria-pressed={letter === item} className={cn("h-8 min-w-8 shrink-0 rounded-full px-2 text-[13px] font-bold uppercase transition", letter === item ? "bg-slate-900 text-white" : "bg-white text-slate-500 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]")}>{item || "সব"}</button>)}
    </div>

    <ul className="space-y-2.5">
      {shown.map((verb) => editing?.id === verb.id
        ? <li key={verb.id} className="rounded-3xl bg-blue-50/60 p-3.5 ring-1 ring-blue-200">
          <div className="grid grid-cols-2 gap-2">
            {columns.map((column) => <input key={column.key} value={editing.values[column.key]} onChange={(event) => setEditing({ ...editing, values: { ...editing.values, [column.key]: event.target.value } })} aria-label={column.label} placeholder={column.label} className={cn(input, "bg-white")} autoCapitalize="off" />)}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="h-10 flex-1 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">বাতিল</button>
            <button type="button" onClick={save} disabled={pending || !complete(editing.values)} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">সেভ</button>
          </div>
        </li>
        : <li key={verb.id} className={card(false)}>
          {/* The tick sits in the top row, so the forms below use the card's full width. */}
          <div className="flex items-center gap-2">
            <LearnedBox checked={false} locked={learned.locked} onToggle={() => learned.toggle("VERB", verb.id, verb.present)} label={verb.present} />
            <h3 className="min-w-0 text-[21px] font-bold leading-tight tracking-tight text-slate-900 [overflow-wrap:anywhere]">{verb.present}</h3>
            <Speak text={verb.present} />
            {verb.userId ? <NewBadge /> : null}
            {canEdit ? <EditButtons label={verb.present} pending={pending} onEdit={() => setEditing({ id: verb.id, values: { present: verb.present, past: verb.past, pastParticiple: verb.pastParticiple, meaning: verb.meaning } })} onDelete={() => remove(verb)} /> : null}
          </div>
          <p className="mt-1 text-[15px] text-slate-600"><QuizCell hidden={hidden.bangla}>{verb.meaning}</QuizCell></p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <FormTile label="Past" english={verb.past} bangla={verb.bangla.past} hideEnglish={hidden.past} hideBangla={hidden.bangla} tone="bg-sky-50 text-sky-800" />
            <FormTile label="Past participle" english={verb.pastParticiple} bangla={verb.bangla.pastParticiple} hideEnglish={hidden.pastParticiple} hideBangla={hidden.bangla} tone="bg-violet-50 text-violet-800" />
          </div>
          <Explain kind="VERB" id={verb.id} explanation={verb.explanation} hasExplanation={verb.hasExplanation} canEdit={canEdit} />
        </li>)}
    </ul>
    {!shown.length ? <p className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-slate-500">{!rows.length ? "এখনো কোনো verb নেই।" : done === rows.length ? "সব verb শেখা হয়ে গেছে — Done-এ দেখো।" : "কিছু মিলল না।"}</p> : null}
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-slate-500">{filtered.length}টির মধ্যে {shown.length}টি</p>
      {filtered.length > shown.length ? <button type="button" onClick={() => setLimit((value) => value + PAGE)} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-blue-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.25)]">আরও দেখাও</button> : null}
    </div>
  </section>;
}

/* ---------- Person: pronoun forms (fixed reference) ---------- */

type Form = [english: string, bangla: string];
const personRows: Array<{ form: string; hint: string; example: string; first: Form[]; second: Form[]; third: Form[] }> = [
  { form: "Subject", hint: "কর্তা", example: "I read. They play.", first: [["I", "আমি"], ["we", "আমরা"]], second: [["you", "তুমি/আপনি/তোমরা"]], third: [["he", "সে (ছেলে)"], ["she", "সে (মেয়ে)"], ["it", "এটা"], ["they", "তারা"]] },
  { form: "Object", hint: "কর্ম", example: "He knows me. Call them.", first: [["me", "আমাকে"], ["us", "আমাদেরকে"]], second: [["you", "তোমাকে/তোমাদেরকে"]], third: [["him", "তাকে"], ["her", "তাকে"], ["it", "এটাকে"], ["them", "তাদেরকে"]] },
  { form: "Possessive adjective", hint: "noun-এর আগে বসে", example: "This is my book.", first: [["my", "আমার"], ["our", "আমাদের"]], second: [["your", "তোমার/তোমাদের"]], third: [["his", "তার"], ["her", "তার"], ["its", "এর"], ["their", "তাদের"]] },
  { form: "Possessive pronoun", hint: "noun ছাড়া একা বসে", example: "The book is mine.", first: [["mine", "আমারটা"], ["ours", "আমাদেরটা"]], second: [["yours", "তোমারটা/তোমাদেরটা"]], third: [["his", "তারটা"], ["hers", "তারটা"], ["theirs", "তাদেরটা"]] },
  { form: "Reflexive", hint: "নিজে/নিজেকে", example: "I did it myself.", first: [["myself", "আমি নিজে"], ["ourselves", "আমরা নিজেরা"]], second: [["yourself", "তুমি নিজে"], ["yourselves", "তোমরা নিজেরা"]], third: [["himself", "সে নিজে"], ["herself", "সে নিজে"], ["itself", "এটা নিজে"], ["themselves", "তারা নিজেরা"]] },
];

const agreementRows: Array<{ verb: string; first: string; second: string; third: string }> = [
  { verb: "be (present)", first: "I am · we are", second: "you are", third: "he/she/it is · they are" },
  { verb: "be (past)", first: "I was · we were", second: "you were", third: "he/she/it was · they were" },
  { verb: "have", first: "I have · we have", second: "you have", third: "he/she/it has · they have" },
  { verb: "do", first: "I do · we do", second: "you do", third: "he/she/it does · they do" },
  { verb: "Present simple", first: "I go · we go", second: "you go", third: "he/she/it goes · they go" },
];

// Fixed keys for the ticks, so they survive reordering of the rows above.
const pronounKey = (form: string) => `pronoun-${form.toLowerCase().replace(/\s+/g, "-")}`;
const agreementKey = (verb: string) => `agreement-${verb.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "")}`;

const PERSON_TONES = ["bg-sky-50", "bg-violet-50", "bg-amber-50"];

/** Each pronoun as a chip: tap it to hear it, its Bangla under it. */
function PronounChips({ forms }: { forms: Form[] }) {
  return <div className="flex flex-wrap gap-1.5">{forms.map(([english, bangla]) => <button key={english} type="button" onClick={() => canPronounce() && pronounce(english)} title="উচ্চারণ শোনো" className="rounded-xl bg-white px-2.5 py-1 text-left shadow-[0_2px_6px_-3px_rgba(15,23,42,0.25)] transition active:scale-95">
    <span className="flex items-center gap-1 text-[15px] font-bold text-slate-900">{english}<Volume2 className="size-3 text-blue-500" /></span>
    <span className="block text-[11.5px] text-slate-500">{bangla}</span>
  </button>)}</div>;
}

function PersonTable({ learned }: { learned: Learned }) {
  const [status, setStatus] = useState<Status>("all");
  const keys = [...personRows.map((row) => pronounKey(row.form)), ...agreementRows.map((row) => agreementKey(row.verb))];
  const done = keys.filter((key) => learned.has("PERSON", key)).length;
  const pronouns = personRows.filter((row) => inStatus(status, learned.has("PERSON", pronounKey(row.form))));
  const agreements = agreementRows.filter((row) => inStatus(status, learned.has("PERSON", agreementKey(row.verb))));

  return <section className="space-y-3">
    <ProgressBar done={done} total={keys.length} status={status} onStatus={setStatus} />
    <ul className="space-y-2.5">
      {pronouns.map((row) => {
        const key = pronounKey(row.form);
        const checked = learned.has("PERSON", key);
        return <li key={row.form} className={card(checked)}>
          <div className="flex items-center gap-2">
            <LearnedBox checked={checked} onToggle={() => learned.toggle("PERSON", key)} label={row.form} />
            <h3 className="text-[18px] font-bold text-blue-700">{row.form} <span className="text-sm font-medium text-slate-500">· {row.hint}</span></h3>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm italic text-slate-500">{row.example} <Speak text={row.example} className="size-7" /></p>
          <div className="mt-2.5 space-y-2">
            {([["First person · বক্তা", row.first], ["Second person · শ্রোতা", row.second], ["Third person · অন্য কেউ", row.third]] as const).map(([label, forms], index) => <div key={label} className={cn("rounded-2xl p-2.5", PERSON_TONES[index])}>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <PronounChips forms={forms} />
            </div>)}
          </div>
        </li>;
      })}
    </ul>

    <h3 className="pt-2 text-[15px] font-bold text-slate-900">Person অনুযায়ী verb</h3>
    <ul className="space-y-2">
      {agreements.map((row) => {
        const key = agreementKey(row.verb);
        const checked = learned.has("PERSON", key);
        return <li key={row.verb} className={card(checked)}>
          <div className="flex items-center gap-2">
            <LearnedBox checked={checked} onToggle={() => learned.toggle("PERSON", key)} label={row.verb} />
            <p className="font-bold text-blue-700">{row.verb}</p>
          </div>
          <dl className="mt-1.5 space-y-1 text-[14.5px]">
            {([["1st", row.first], ["2nd", row.second], ["3rd", row.third]] as const).map(([label, text]) => <div key={label} className="flex items-center gap-2">
              <dt className="w-9 shrink-0 text-xs font-bold text-slate-400">{label}</dt>
              <dd className="min-w-0 flex-1 text-slate-800">{text}</dd>
              <Speak text={text.replace(/·/g, ",")} className="size-7" />
            </div>)}
          </dl>
        </li>;
      })}
    </ul>
    {!pronouns.length && !agreements.length ? <p className="rounded-3xl bg-white px-4 py-8 text-center text-sm text-slate-500">এখানে কিছু নেই।</p> : null}
    <p className="text-xs text-slate-500">মনে রাখো: Present simple-এ শুধু third person singular (he/she/it) হলে verb-এর সাথে s/es বসে।</p>
  </section>;
}

/* ---------- Singular · plural ---------- */

type NounDraft = { singular: string; plural: string; meaning: string };
const emptyNoun: NounDraft = { singular: "", plural: "", meaning: "" };

const pluralRules: Array<[rule: string, text: string]> = [
  ["+s", "সাধারণ নিয়ম: book → books, boy → boys"],
  ["+es", "s, x, z, ch, sh শেষে: box → boxes, church → churches"],
  ["y → ies", "ব্যঞ্জন + y শেষে: city → cities (কিন্তু day → days)"],
  ["o → oes", "কিছু o-শেষ শব্দ: potato → potatoes, hero → heroes (photo → photos)"],
  ["f / fe → ves", "knife → knives, leaf → leaves (কিন্তু roof → roofs, chief → chiefs)"],
  ["অনিয়মিত", "man → men, child → children, foot → feet, mouse → mice"],
  ["প্রধান শব্দে বহুবচন", "brother-in-law → brothers-in-law, passer-by → passers-by"],
  ["একই রূপ", "sheep, deer, fish, series, species — দুই বচনেই এক"],
  ["বিদেশি শব্দ", "criterion → criteria, datum → data, crisis → crises, radius → radii"],
  ["শুধু বহুবচন", "scissors, trousers, cattle, police — সবসময় plural verb"],
  ["অগণনযোগ্য", "information, advice, furniture, news — plural হয় না, singular verb"],
];

function NounTable({ nouns, canEdit, learned, onDone }: { nouns: Noun[]; canEdit: boolean; learned: Learned; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<NounDraft>(emptyNoun);
  const [editing, setEditing] = useState<{ id: string; values: NounDraft } | null>(null);
  const [query, setQuery] = useState("");
  const [ruleFilter, setRuleFilter] = useState("");
  const [hidden, setHidden] = useState({ plural: false, bangla: false });
  const [showRules, setShowRules] = useState(false);
  const [filling, setFilling] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [pending, start] = useTransition();

  const rows = nouns
    .map((noun) => ({ ...noun, rule: pluralRule(noun.singular, noun.plural), learned: learned.has("NOUN", noun.id) }))
    .sort((a, b) => nounKey(a).localeCompare(nounKey(b)));
  const done = rows.filter((row) => row.learned).length;
  // A learned word leaves the list: it waits in Done.
  const inState = rows.filter((row) => !row.learned);
  const filtered = inState.filter((row) => (!ruleFilter || row.rule === ruleFilter) && matches(query, row.singular, row.plural, row.meaning));
  const shown = filtered.slice(0, limit);
  const ruleCounts = new Map<string, number>();
  for (const row of inState) ruleCounts.set(row.rule, (ruleCounts.get(row.rule) ?? 0) + 1);
  const complete = (values: NounDraft) => Object.values(values).every((value) => value.trim());
  // Already in the table (the server checks again).
  const taken = (noun: NounDraft, exceptId?: string) => rows.some((row) => nounKey(row) === nounKey(noun) && row.id !== exceptId);
  const narrow = (change: () => void) => { change(); setLimit(PAGE); };

  async function fill() {
    setFilling(true);
    const result = await fillWithAI("noun", draft.singular);
    setFilling(false);
    if (result) setDraft((value) => ({ ...value, plural: result.plural ?? value.plural, meaning: result.meaning ?? value.meaning }));
  }
  const add = () => start(async () => {
    if (taken(draft)) { toast.error(`“${nounKey(draft)}” আগেই table-এ আছে।`); return; }
    try { await createNoun(draft); setDraft(emptyNoun); toast.success(`“${nounKey(draft)}” যোগ হলো`); router.refresh(); } catch (error) { toast.error(errorMessage(error, "যোগ করা গেল না।")); }
  });
  const save = () => editing && start(async () => {
    if (taken(editing.values, editing.id)) { toast.error(`“${nounKey(editing.values)}” আগেই table-এ আছে।`); return; }
    try { await updateNoun(editing.id, editing.values); setEditing(null); toast.success("সেভ হলো"); router.refresh(); } catch (error) { toast.error(errorMessage(error, "সেভ করা গেল না।")); }
  });
  const remove = (noun: Noun) => start(async () => {
    if (!window.confirm(`“${nounKey(noun)}” মুছে ফেলবে? সবার table থেকে মুছে যাবে।`)) return;
    try { await deleteNoun(noun.id); toast.success("মুছে ফেলা হলো"); router.refresh(); } catch (error) { toast.error(errorMessage(error, "মোছা গেল না।")); }
  });

  const fields = [
    { key: "singular", label: "Singular (child)" },
    { key: "plural", label: "Plural (children)" },
    { key: "meaning", label: "অর্থ (শিশু)" },
  ] as const;

  return <section className="space-y-3">
    <div className="rounded-3xl bg-white shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)]">
      <button type="button" onClick={() => setShowRules(!showRules)} aria-expanded={showRules} className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-sm font-bold text-slate-900">
        <span className="flex items-center gap-2"><BookOpenText className="size-4 text-blue-600" /> Plural করার নিয়মগুলো</span>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform", showRules && "rotate-180")} />
      </button>
      {showRules ? <ul className="space-y-2 border-t border-slate-100 px-4 py-3 text-[14.5px]">
        {pluralRules.map(([rule, text]) => <li key={rule}><span className="mr-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{rule}</span><span className="text-slate-700">{text}</span></li>)}
      </ul> : null}
    </div>

    {canEdit ? <AddPanel label="নতুন noun যোগ করো">{() => <form onSubmit={(event) => { event.preventDefault(); if (complete(draft)) add(); }} className="space-y-2">
      <div className="flex gap-2">
        <input value={draft.singular} onChange={(event) => setDraft({ ...draft, singular: event.target.value })} placeholder={fields[0].label} aria-label="Singular" className={input} autoCapitalize="off" />
        <AiButton busy={filling} disabled={!draft.singular.trim() || draft.singular.trim() === "-"} onClick={() => void fill()} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={draft.plural} onChange={(event) => setDraft({ ...draft, plural: event.target.value })} placeholder={fields[1].label} aria-label="Plural" className={input} autoCapitalize="off" />
        <input value={draft.meaning} onChange={(event) => setDraft({ ...draft, meaning: event.target.value })} placeholder={fields[2].label} aria-label="অর্থ" className={input} />
      </div>
      <p className="text-xs text-slate-500">Singular লিখে <span className="font-semibold text-violet-700">AI</span> চাপলে plural আর অর্থ বসবে। Plural না থাকলে “-” (information), singular না থাকলে “-” (scissors)।</p>
      <SaveBar pending={pending} disabled={!complete(draft)} />
    </form>}</AddPanel> : null}

    <WordProgress done={done} total={rows.length} locked={learned.locked} onDone={onDone} />
    <SearchBox value={query} onChange={(value) => narrow(() => setQuery(value))} placeholder="খুঁজো — child, children, শিশু…" />
    <div className={chipRow}>
      <HideToggle label="Plural" hidden={hidden.plural} onToggle={() => setHidden({ ...hidden, plural: !hidden.plural })} />
      <HideToggle label="বাংলা" hidden={hidden.bangla} onToggle={() => setHidden({ ...hidden, bangla: !hidden.bangla })} />
    </div>
    <div className={chipRow} aria-label="নিয়ম অনুযায়ী">
      {["", ...ruleCounts.keys()].map((rule) => <button key={rule || "all"} type="button" onClick={() => narrow(() => setRuleFilter(rule))} aria-pressed={ruleFilter === rule} className={chip(ruleFilter === rule)}>
        {rule || "সব নিয়ম"}{rule ? <span className="opacity-70">{ruleCounts.get(rule)}</span> : null}
      </button>)}
    </div>

    <ul className="space-y-2.5">
      {shown.map((row) => editing?.id === row.id
        ? <li key={row.id} className="rounded-3xl bg-blue-50/60 p-3.5 ring-1 ring-blue-200">
          <div className="grid grid-cols-2 gap-2">
            {fields.map((field) => <input key={field.key} value={editing.values[field.key]} onChange={(event) => setEditing({ ...editing, values: { ...editing.values, [field.key]: event.target.value } })} aria-label={field.label} placeholder={field.label} className={cn(input, "bg-white", field.key === "meaning" && "col-span-2")} autoCapitalize="off" />)}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="h-10 flex-1 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">বাতিল</button>
            <button type="button" onClick={save} disabled={pending || !complete(editing.values)} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">সেভ</button>
          </div>
        </li>
        : <li key={row.id} className={card(false)}>
          <div className="flex items-center gap-2">
            <LearnedBox checked={false} locked={learned.locked} onToggle={() => learned.toggle("NOUN", row.id, nounKey(row))} label={nounKey(row)} />
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", row.rule === "+s" || row.rule === "+es" || row.rule === "y → ies" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800")}>{row.rule}</span>
            {row.userId ? <NewBadge /> : null}
            {canEdit ? <EditButtons label={nounKey(row)} pending={pending} onEdit={() => setEditing({ id: row.id, values: { singular: row.singular, plural: row.plural, meaning: row.meaning } })} onDelete={() => remove(row)} /> : null}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {row.singular === "-"
              ? <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-400">Singular নেই</div>
              : <FormTile label="Singular" english={row.singular} bangla={row.meaning} hideEnglish={false} hideBangla={hidden.bangla} tone="bg-sky-50 text-sky-800" />}
            {row.plural === "-"
              ? <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-400">Plural হয় না</div>
              : <FormTile label="Plural" english={row.plural} bangla={row.singular === "-" ? row.meaning : banglaPlural(row.meaning, row.person)} hideEnglish={hidden.plural} hideBangla={hidden.bangla} tone="bg-emerald-50 text-emerald-800" />}
          </div>
          <Explain kind="NOUN" id={row.id} explanation={row.explanation} hasExplanation={row.hasExplanation} canEdit={canEdit} />
        </li>)}
    </ul>
    {!shown.length ? <p className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-slate-500">{!rows.length ? "এখনো কোনো noun নেই।" : done === rows.length ? "সব noun শেখা হয়ে গেছে — Done-এ দেখো।" : "কিছু মিলল না।"}</p> : null}
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-slate-500">{filtered.length}টির মধ্যে {shown.length}টি · হলুদ নিয়মগুলো পরীক্ষায় বেশি আসে</p>
      {filtered.length > shown.length ? <button type="button" onClick={() => setLimit((value) => value + PAGE)} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-blue-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.25)]">আরও দেখাও</button> : null}
    </div>
  </section>;
}

/* ---------- Prefix & suffix ---------- */

type AffixDraft = { kind: AffixKind; affix: string; meaning: string; example: string };
const kindLabel: Record<AffixKind, string> = { PREFIX: "Prefix", SUFFIX: "Suffix" };

function KindSwitch({ value, onChange }: { value: AffixKind; onChange: (kind: AffixKind) => void }) {
  return <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Prefix না Suffix">
    {(["PREFIX", "SUFFIX"] as const).map((kind) => <button key={kind} type="button" role="radio" aria-checked={value === kind} onClick={() => onChange(kind)} className={cn("h-9 rounded-lg text-sm font-semibold transition", value === kind ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{kindLabel[kind]}</button>)}
  </div>;
}

/** The first English word of an example ("unhappy — অসুখী" → "unhappy"), to say aloud. */
const exampleWord = (example: string) => example.split(/[—,–-]/)[0]?.trim().match(/^[A-Za-z' ]+/)?.[0]?.trim() ?? "";

function AffixTable({ affixes, canEdit, learned, onDone }: { affixes: Affix[]; canEdit: boolean; learned: Learned; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<AffixDraft>({ kind: "PREFIX", affix: "", meaning: "", example: "" });
  const [editing, setEditing] = useState<{ id: string; values: AffixDraft } | null>(null);
  const [kindFilter, setKindFilter] = useState<"ALL" | AffixKind>("ALL");
  const [query, setQuery] = useState("");
  const [hideMeaning, setHideMeaning] = useState(false);
  const [filling, setFilling] = useState(false);
  const [pending, start] = useTransition();
  const rows = affixes
    .map((entry) => ({ ...entry, learned: learned.has("AFFIX", entry.id) }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || bareAffix(a.affix).localeCompare(bareAffix(b.affix)));
  const done = rows.filter((row) => row.learned).length;
  // A learned prefix/suffix leaves the list: it waits in Done.
  const inState = rows.filter((row) => !row.learned);
  const shown = inState.filter((entry) => (kindFilter === "ALL" || entry.kind === kindFilter) && matches(query, entry.affix, entry.meaning, entry.example));
  const complete = (values: AffixDraft) => Boolean(values.affix.trim() && values.meaning.trim());
  // Already in the table, "un" and "un-" alike (the server checks again).
  const taken = (entry: AffixDraft, exceptId?: string) => rows.some((row) => row.kind === entry.kind && bareAffix(row.affix) === bareAffix(entry.affix) && row.id !== exceptId);

  async function fill() {
    setFilling(true);
    const result = await fillWithAI(draft.kind, draft.affix);
    setFilling(false);
    if (result) setDraft((value) => ({ ...value, meaning: result.meaning ?? value.meaning, example: result.example ?? value.example }));
  }
  const add = () => start(async () => {
    if (taken(draft)) { toast.error(`“${draft.affix.trim()}” আগেই table-এ আছে।`); return; }
    try { await createAffix(draft); setDraft({ ...draft, affix: "", meaning: "", example: "" }); toast.success(`“${draft.affix}” যোগ হলো`); router.refresh(); } catch (error) { toast.error(errorMessage(error, "যোগ করা গেল না।")); }
  });
  const save = () => editing && start(async () => {
    if (taken(editing.values, editing.id)) { toast.error(`“${editing.values.affix.trim()}” আগেই table-এ আছে।`); return; }
    try { await updateAffix(editing.id, editing.values); setEditing(null); toast.success("সেভ হলো"); router.refresh(); } catch (error) { toast.error(errorMessage(error, "সেভ করা গেল না।")); }
  });
  const remove = (entry: Affix) => start(async () => {
    if (!window.confirm(`“${entry.affix}” মুছে ফেলবে? সবার table থেকে মুছে যাবে।`)) return;
    try { await deleteAffix(entry.id); toast.success("মুছে ফেলা হলো"); router.refresh(); } catch (error) { toast.error(errorMessage(error, "মোছা গেল না।")); }
  });

  return <section className="space-y-3">
    {canEdit ? <AddPanel label="নতুন prefix / suffix যোগ করো">{() => <form onSubmit={(event) => { event.preventDefault(); if (complete(draft)) add(); }} className="space-y-2">
      <KindSwitch value={draft.kind} onChange={(kind) => setDraft({ ...draft, kind })} />
      <div className="flex gap-2">
        <input value={draft.affix} onChange={(event) => setDraft({ ...draft, affix: event.target.value })} placeholder={draft.kind === "PREFIX" ? "un-" : "-less"} aria-label="Prefix/Suffix" className={input} autoCapitalize="off" />
        <AiButton busy={filling} disabled={!draft.affix.trim()} onClick={() => void fill()} />
      </div>
      <input value={draft.meaning} onChange={(event) => setDraft({ ...draft, meaning: event.target.value })} placeholder="অর্থ (না/বিপরীত)" aria-label="অর্থ" className={input} />
      <input value={draft.example} onChange={(event) => setDraft({ ...draft, example: event.target.value })} placeholder="উদাহরণ (unhappy — অসুখী)" aria-label="উদাহরণ" className={input} />
      <SaveBar pending={pending} disabled={!complete(draft)} />
    </form>}</AddPanel> : null}

    <WordProgress done={done} total={rows.length} locked={learned.locked} onDone={onDone} />
    <SearchBox value={query} onChange={setQuery} placeholder="খুঁজো — un, less, অসুখী…" />
    <div className={chipRow}>
      {(["ALL", "PREFIX", "SUFFIX"] as const).map((kind) => <button key={kind} type="button" onClick={() => setKindFilter(kind)} aria-pressed={kindFilter === kind} className={chip(kindFilter === kind)}>
        {kind === "ALL" ? "সব" : kindLabel[kind]} <span className="opacity-70">{kind === "ALL" ? inState.length : inState.filter((entry) => entry.kind === kind).length}</span>
      </button>)}
      <HideToggle label="অর্থ লুকাও" hidden={hideMeaning} onToggle={() => setHideMeaning(!hideMeaning)} />
    </div>

    <ul className="space-y-2.5">
      {shown.map((entry) => editing?.id === entry.id
        ? <li key={entry.id} className="space-y-2 rounded-3xl bg-blue-50/60 p-3.5 ring-1 ring-blue-200">
          <KindSwitch value={editing.values.kind} onChange={(kind) => setEditing({ ...editing, values: { ...editing.values, kind } })} />
          {(["affix", "meaning", "example"] as const).map((key) => <input key={key} value={editing.values[key]} onChange={(event) => setEditing({ ...editing, values: { ...editing.values, [key]: event.target.value } })} aria-label={key} className={cn(input, "bg-white")} autoCapitalize="off" />)}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="h-10 flex-1 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">বাতিল</button>
            <button type="button" onClick={save} disabled={pending || !complete(editing.values)} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">সেভ</button>
          </div>
        </li>
        : <li key={entry.id} className={card(false)}>
          <div className="flex items-center gap-2">
            <LearnedBox checked={false} locked={learned.locked} onToggle={() => learned.toggle("AFFIX", entry.id, entry.affix)} label={entry.affix} />
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", entry.kind === "PREFIX" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700")}>{kindLabel[entry.kind]}</span>
            <h3 className="min-w-0 text-[21px] font-bold leading-tight text-slate-900 [overflow-wrap:anywhere]">{entry.affix}</h3>
            {entry.userId ? <NewBadge /> : null}
            {canEdit ? <EditButtons label={entry.affix} pending={pending} onEdit={() => setEditing({ id: entry.id, values: { kind: entry.kind, affix: entry.affix, meaning: entry.meaning, example: entry.example } })} onDelete={() => remove(entry)} /> : null}
          </div>
          <p className="mt-1 text-[15px] font-medium text-slate-700"><QuizCell hidden={hideMeaning}>{entry.meaning}</QuizCell></p>
          {entry.example ? <div className="mt-2 flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2">
            <p className="min-w-0 flex-1 text-[14px] text-amber-950 [overflow-wrap:anywhere]">{entry.example}</p>
            <Speak text={exampleWord(entry.example)} className="size-7" />
          </div> : null}
          <Explain kind="AFFIX" id={entry.id} explanation={entry.explanation} hasExplanation={entry.hasExplanation} canEdit={canEdit} />
        </li>)}
    </ul>
    {!shown.length ? <p className="rounded-3xl bg-white px-4 py-10 text-center text-sm text-slate-500">{rows.length ? "কিছু মিলল না।" : "এখনো কিছু নেই।"}</p> : null}
    <p className="text-xs text-slate-500">{shown.length}টি দেখানো হচ্ছে</p>
  </section>;
}

/**
 * Vocabulary: verb forms, pronouns by person, singular/plural and prefixes/suffixes, with Bangla.
 * The tables are shared (admins add to them); each user ticks off what they have learned. Every
 * word can be heard (🔊, free); its Bangla explanation is for paid users.
 */
export function VocabularyView({ verbs, affixes, nouns, state, canEdit }: { verbs: Verb[]; affixes: Affix[]; nouns: Noun[]; state: Awaited<ReturnType<typeof getVocabState>>; canEdit: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wanted = searchParams.get("tab");
  const active: Tab = tabs.some((tab) => tab.id === wanted) ? (wanted as Tab) : "verbs";

  const openTab = (tab: Tab) => router.replace(`${pathname}?tab=${tab}`, { scroll: false });

  // Ticks change at once on screen and are saved in the background; a failed save is undone. The
  // set's lock comes from the server (refreshed after each tick).
  const [learnedSet, setLearnedSet] = useState(() => new Set(state.learned.map((row) => row.key)));
  // The toast's "ফেরাও" runs later, so a toggle reads the ticks as they are then, not as they were.
  const current = useRef(learnedSet);
  useEffect(() => { current.current = learnedSet; }, [learnedSet]);
  const learned: Learned = {
    locked: state.status.locked,
    has: (kind, id) => learnedSet.has(`${kind}:${id}`),
    toggle: (kind, id, label) => {
      const key = `${kind}:${id}`;
      const next = !current.current.has(key);
      if (next && kind !== "PERSON" && state.status.locked) {
        toast.error(`${BATCH_SIZE}টা শব্দ শেখা হয়েছে — নতুন নিতে আগে Done-এ তিনটা exam দাও (প্রতিটায় ${PASS_PERCENT}%)।`, { action: { label: "Done", onClick: () => openTab("done") } });
        return;
      }
      const flip = (on: boolean) => setLearnedSet((ticks) => { const copy = new Set(ticks); if (on) copy.add(key); else copy.delete(key); current.current = copy; return copy; });
      flip(next);
      setLearned({ kind, entryId: id, learned: next })
        .then(() => {
          router.refresh();
          if (next && kind !== "PERSON") toast.success(`“${label ?? "শব্দটা"}” Done-এ গেল`, { action: { label: "ফেরাও", onClick: () => learned.toggle(kind, id, label) } });
        })
        .catch((error) => { flip(!next); toast.error(errorMessage(error, "সেভ করা গেল না — আবার চেষ্টা করো।")); });
    },
  };
  const doneOf = (kind: LearnKind) => [...learnedSet].filter((key) => key.startsWith(`${kind}:`)).length;
  const wordsDone = doneOf("VERB") + doneOf("NOUN") + doneOf("AFFIX");
  const totals: Record<Tab, [number, number]> = {
    verbs: [doneOf("VERB"), verbs.length],
    persons: [doneOf("PERSON"), personRows.length + agreementRows.length],
    nouns: [doneOf("NOUN"), nouns.length],
    affixes: [doneOf("AFFIX"), affixes.length],
    done: [wordsDone, verbs.length + nouns.length + affixes.length],
  };
  const allDone = wordsDone + doneOf("PERSON");
  const allTotal = totals.verbs[1] + totals.persons[1] + totals.nouns[1] + totals.affixes[1];

  return <div className="space-y-3">
    {/* The home page's blue: the overall progress, then the four lists. */}
    <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-4 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.7)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight">Vocabulary</h1>
          <p className="mt-0.5 text-[13px] text-white/85">শব্দ শোনো 🔊, অর্থ শেখো, শেখা হলে টিক দাও — Done-এ গিয়ে flashcard আর exam।</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-white/20 px-3 py-1.5 text-center ring-1 ring-white/30">
          <p className="text-lg font-bold leading-tight tabular-nums">{allDone}<span className="text-sm font-medium text-white/75">/{allTotal}</span></p>
          <p className="text-[10.5px] text-white/85">শেখা হয়েছে</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${allTotal ? Math.round((allDone / allTotal) * 100) : 0}%` }} /></div>
    </section>

    <div role="tablist" aria-label="Vocabulary" className={chipRow}>
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => openTab(tab.id)} className={cn(chip(active === tab.id), tab.id === "done" && active !== tab.id && "text-emerald-700")}>
        {tab.id === "done" ? <Check className="size-3.5" strokeWidth={3} /> : null}{tab.label}
        <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active === tab.id ? "bg-white/25" : "bg-slate-100 text-slate-500")}>{tab.id === "done" ? totals.done[0] : `${totals[tab.id][0]}/${totals[tab.id][1]}`}</span>
      </button>)}
    </div>

    {active === "verbs" ? <VerbTable verbs={verbs} canEdit={canEdit} learned={learned} onDone={() => openTab("done")} />
      : active === "persons" ? <PersonTable learned={learned} />
      : active === "nouns" ? <NounTable nouns={nouns} canEdit={canEdit} learned={learned} onDone={() => openTab("done")} />
      : active === "affixes" ? <AffixTable affixes={affixes} canEdit={canEdit} learned={learned} onDone={() => openTab("done")} />
      : <VocabDone verbs={verbs} nouns={nouns} affixes={affixes} learned={state.learned.filter((row) => learnedSet.has(row.key))} status={state.status} onUnlearn={(kind, id, label) => learned.toggle(kind, id, label)} />}
  </div>;
}
