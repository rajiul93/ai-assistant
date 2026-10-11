"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { banglaVerbForms } from "@/lib/vocabulary/bangla-verb";
import { bareAffix, commonAffixes } from "@/lib/vocabulary/common-affixes";
import { commonVerbs } from "@/lib/vocabulary/common-verbs";
import { createAffix, createVerb, deleteAffix, deleteVerb, updateAffix, updateVerb, type listAffixes, type listVerbs } from "@/server/actions/vocabulary";

type Verb = Awaited<ReturnType<typeof listVerbs>>[number];
type Affix = Awaited<ReturnType<typeof listAffixes>>[number];
type AffixKind = Affix["kind"];

const tabs = [
  { id: "verbs", label: "Verb" },
  { id: "persons", label: "Person" },
  { id: "affixes", label: "Prefix & Suffix" },
] as const;
type Tab = (typeof tabs)[number]["id"];

const input = "h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none transition focus:border-zinc-400";
const iconButton = "flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40";

/** Asks AI for a verb's other forms, or a prefix/suffix's meaning and examples. */
async function fillWithAI(kind: "verb" | AffixKind, word: string): Promise<Record<string, string> | null> {
  const response = await fetch("/api/vocabulary/fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, word }) });
  const payload = (await response.json().catch(() => ({}))) as Record<string, string> & { error?: string };
  if (!response.ok) { toast.error(payload.error ?? "AI পূরণ করতে পারল না।"); return null; }
  return payload;
}

function AiButton({ busy, disabled, onClick }: { busy: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={busy || disabled} title="বাকি ঘরগুলো AI দিয়ে পূরণ করো — মিলিয়ে নিয়ে Add করো" className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-50 disabled:opacity-50">
    {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} AI
  </button>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block">
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn(input, "pl-8")} />
  </label>;
}

/** A cell that can be hidden for self-testing; tap it to peek. */
function QuizCell({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const [peek, setPeek] = useState(false);
  if (!hidden || peek) return <>{children}</>;
  return <button type="button" onClick={() => setPeek(true)} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700">দেখো</button>;
}

function HideToggle({ label, hidden, onToggle }: { label: string; hidden: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-pressed={hidden} className={cn("flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 transition", hidden ? "bg-zinc-950 text-white ring-zinc-950" : "bg-white text-zinc-600 ring-zinc-200 hover:ring-zinc-400")}>
    {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {label}
  </button>;
}

const matches = (query: string, ...fields: string[]) => !query.trim() || fields.some((field) => field.toLowerCase().includes(query.trim().toLowerCase()));

/* ---------- Verb: present · past · past participle, each with its Bangla ---------- */

/** One verb form with its Bangla under it; the Bangla can be hidden for practice (tap to peek). */
function FormCell({ english, bangla, hideBangla, badge }: { english: string; bangla: string; hideBangla: boolean; badge?: boolean }) {
  return <div>
    <p className="text-lg font-semibold leading-snug">{english}{badge ? <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">আমার</span> : null}</p>
    {bangla ? <p className="mt-0.5 text-base text-zinc-700"><QuizCell hidden={hideBangla}>{bangla}</QuizCell></p> : null}
  </div>;
}

type VerbDraft = { present: string; past: string; pastParticiple: string; meaning: string };
/** A table row: one of the user's verbs (editable) or one from the built-in list everyone gets. */
type VerbRow = VerbDraft & { key: string; mine: Verb | null; bangla: { past: string; pastParticiple: string } };
const PAGE = 150;
const letters = "abcdefghijklmnopqrstuvwxyz".split("");
const emptyVerb: VerbDraft = { present: "", past: "", pastParticiple: "", meaning: "" };

function VerbTable({ verbs }: { verbs: Verb[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<VerbDraft>(emptyVerb);
  const [editing, setEditing] = useState<{ id: string; values: VerbDraft } | null>(null);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState({ past: false, pastParticiple: false, bangla: false });
  const [filling, setFilling] = useState(false);
  const [source, setSource] = useState<"all" | "mine" | "common">("all");
  const [letter, setLetter] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [pending, start] = useTransition();
  // The user's own verb replaces the built-in one with the same present form.
  const own = new Set(verbs.map((verb) => verb.present.toLowerCase()));
  const rows: VerbRow[] = [
    ...verbs.map((verb) => ({ ...verb, key: verb.id, mine: verb, bangla: banglaVerbForms(verb.meaning, verb.present) })),
    ...commonVerbs.filter((verb) => !own.has(verb.present.toLowerCase())).map((verb, index) => ({ ...verb, key: `common-${index}`, mine: null, bangla: banglaVerbForms(verb.meaning, verb.present) })),
  ].sort((a, b) => a.present.localeCompare(b.present));
  const commonCount = rows.length - verbs.length;
  const filtered = rows.filter((row) => (source === "all" || (source === "mine") === Boolean(row.mine))
    && (!letter || row.present.toLowerCase().startsWith(letter))
    && matches(query, row.present, row.past, row.pastParticiple, row.meaning, row.bangla.past, row.bangla.pastParticiple));
  const shown = filtered.slice(0, limit);
  const complete = (values: VerbDraft) => Object.values(values).every((value) => value.trim());
  // Changing what is listed starts again from the top of the list.
  const narrow = (change: () => void) => { change(); setLimit(PAGE); };

  async function fill() {
    setFilling(true);
    const forms = await fillWithAI("verb", draft.present);
    setFilling(false);
    if (forms) setDraft((value) => ({ ...value, past: forms.past ?? value.past, pastParticiple: forms.pastParticiple ?? value.pastParticiple, meaning: forms.meaning ?? value.meaning }));
  }
  const add = () => start(async () => {
    try {
      await createVerb(draft);
      const replacesCommon = commonVerbs.some((verb) => verb.present.toLowerCase() === draft.present.trim().toLowerCase());
      setDraft(emptyVerb);
      toast.success(replacesCommon ? `“${draft.present}” যোগ হলো — সাধারণ তালিকার বদলে এখন তোমার লেখাটা দেখাবে` : `“${draft.present}” যোগ হলো`);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "যোগ করা গেল না।"); }
  });
  const save = () => editing && start(async () => {
    try { await updateVerb(editing.id, editing.values); setEditing(null); toast.success("সেভ হলো"); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "সেভ করা গেল না।"); }
  });
  const remove = (verb: Verb) => start(async () => {
    if (!window.confirm(`“${verb.present}” মুছে ফেলবে?`)) return;
    try { await deleteVerb(verb.id); toast.success("মুছে ফেলা হলো"); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "মোছা গেল না।"); }
  });

  const columns = [
    { key: "present", label: "Present" },
    { key: "past", label: "Past" },
    { key: "pastParticiple", label: "Past participle" },
    { key: "meaning", label: "অর্থ" },
  ] as const;

  return <section className="space-y-3">
    <form onSubmit={(event) => { event.preventDefault(); if (complete(draft)) add(); }} className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_1fr_1.3fr]">
        <input value={draft.present} onChange={(event) => setDraft({ ...draft, present: event.target.value })} placeholder="Present (go)" aria-label="Present" className={input} autoCapitalize="off" />
        <AiButton busy={filling} disabled={!draft.present.trim()} onClick={() => void fill()} />
        <input value={draft.past} onChange={(event) => setDraft({ ...draft, past: event.target.value })} placeholder="Past (went)" aria-label="Past" className={input} autoCapitalize="off" />
        <input value={draft.pastParticiple} onChange={(event) => setDraft({ ...draft, pastParticiple: event.target.value })} placeholder="Past participle (gone)" aria-label="Past participle" className={input} autoCapitalize="off" />
        <input value={draft.meaning} onChange={(event) => setDraft({ ...draft, meaning: event.target.value })} placeholder="অর্থ (যাওয়া)" aria-label="অর্থ" className={input} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">Present লিখে <span className="font-medium text-indigo-700">AI</span> চাপলে বাকি ঘর বসে যাবে — মিলিয়ে নাও।</p>
        <button type="submit" disabled={pending || !complete(draft)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"><Plus className="size-4" /> Add</button>
      </div>
    </form>

    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium">
        {([["all", `সব (${rows.length})`], ["mine", `আমার (${verbs.length})`], ["common", `সাধারণ (${commonCount})`]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => narrow(() => setSource(id))} className={cn("h-8 rounded-full px-3", source === id ? "bg-white shadow-sm" : "text-zinc-500")}>{label}</button>
        ))}
      </div>
      <div className="min-w-48 flex-1"><SearchBox value={query} onChange={(value) => narrow(() => setQuery(value))} placeholder="খুঁজো — go, went, যাওয়া…" /></div>
      <span className="text-xs text-zinc-500">লুকাও:</span>
      <HideToggle label="Past" hidden={hidden.past} onToggle={() => setHidden({ ...hidden, past: !hidden.past })} />
      <HideToggle label="P.P." hidden={hidden.pastParticiple} onToggle={() => setHidden({ ...hidden, pastParticiple: !hidden.pastParticiple })} />
      <HideToggle label="বাংলা" hidden={hidden.bangla} onToggle={() => setHidden({ ...hidden, bangla: !hidden.bangla })} />
    </div>
    <div className="flex flex-wrap gap-1" aria-label="প্রথম অক্ষর">
      {["", ...letters].map((item) => <button key={item || "all"} type="button" onClick={() => narrow(() => setLetter(item))} aria-pressed={letter === item} className={cn("h-7 min-w-7 rounded-md px-1.5 text-xs font-semibold uppercase transition", letter === item ? "bg-zinc-950 text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:text-zinc-900")}>{item || "সব"}</button>)}
    </div>

    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[560px] text-left text-base">
        <thead className="bg-zinc-100 text-sm text-zinc-600"><tr>
          <th className="w-10 px-3 py-2.5 font-medium">#</th>
          <th className="px-3 py-2.5 font-medium">Present <span className="font-normal">· অর্থ</span></th>
          <th className="px-3 py-2.5 font-medium">Past <span className="font-normal">· অর্থ</span></th>
          <th className="px-3 py-2.5 font-medium">Past participle <span className="font-normal">· অর্থ</span></th>
          <th className="w-20" />
        </tr></thead>
        <tbody>
          {shown.map((verb, index) => verb.mine && editing?.id === verb.mine.id
            ? <tr key={verb.key} className="bg-indigo-50/40">
              <td className="px-3 py-2 text-zinc-400 tabular-nums">{index + 1}</td>
              <td colSpan={3} className="px-1.5 py-1.5"><div className="grid grid-cols-4 gap-1.5">
                {columns.map((column) => <input key={column.key} value={editing.values[column.key]} onChange={(event) => setEditing({ ...editing, values: { ...editing.values, [column.key]: event.target.value } })} aria-label={column.label} placeholder={column.label} className={input} autoCapitalize="off" />)}
              </div></td>
              <td className="px-1.5"><div className="flex">
                <button type="button" onClick={save} disabled={pending || !complete(editing.values)} aria-label="Save" className={cn(iconButton, "text-emerald-700")}><Check className="size-4" /></button>
                <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className={iconButton}><X className="size-4" /></button>
              </div></td>
            </tr>
            : <tr key={verb.key} className="odd:bg-white even:bg-zinc-100">
              <td className="px-3 py-2.5 text-zinc-400 tabular-nums">{index + 1}</td>
              <td className="px-3 py-2.5 align-top"><FormCell english={verb.present} bangla={verb.meaning} hideBangla={hidden.bangla} badge={Boolean(verb.mine)} /></td>
              <td className="px-3 py-2.5 align-top"><QuizCell hidden={hidden.past}><FormCell english={verb.past} bangla={verb.bangla.past} hideBangla={hidden.bangla} /></QuizCell></td>
              <td className="px-3 py-2.5 align-top"><QuizCell hidden={hidden.pastParticiple}><FormCell english={verb.pastParticiple} bangla={verb.bangla.pastParticiple} hideBangla={hidden.bangla} /></QuizCell></td>
              <td className="px-1.5">{verb.mine ? <div className="flex">
                <button type="button" onClick={() => verb.mine && setEditing({ id: verb.mine.id, values: { present: verb.present, past: verb.past, pastParticiple: verb.pastParticiple, meaning: verb.meaning } })} aria-label={`${verb.present} edit`} className={iconButton}><Pencil className="size-4" /></button>
                <button type="button" onClick={() => verb.mine && remove(verb.mine)} disabled={pending} aria-label={`${verb.present} মুছে ফেলো`} className={cn(iconButton, "hover:bg-red-50 hover:text-red-700")}><Trash2 className="size-4" /></button>
              </div> : null}</td>
            </tr>)}
        </tbody>
      </table>
      {!shown.length ? <p className="px-4 py-10 text-center text-sm text-zinc-500">{source === "mine" && !verbs.length ? "এখনো তোমার নিজের কোনো verb নেই — উপরে লিখে Add করো।" : "কিছু মিলল না।"}</p> : null}
    </div>
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-zinc-500">{filtered.length}টির মধ্যে {shown.length}টি দেখানো হচ্ছে · “সাধারণ” verb-গুলো সবার জন্য, বদলানো যায় না — নিজের মতো লিখতে চাইলে একই verb উপরে Add করো।</p>
      {filtered.length > shown.length ? <button type="button" onClick={() => setLimit((value) => value + PAGE)} className="h-9 shrink-0 rounded-lg px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50">আরও দেখাও</button> : null}
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

function Forms({ forms }: { forms: Form[] }) {
  return <ul className="space-y-1">{forms.map(([english, bangla]) => <li key={english}><span className="font-semibold">{english}</span> <span className="text-zinc-600">— {bangla}</span></li>)}</ul>;
}

function PersonTable() {
  return <section className="space-y-5">
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-base">
        <thead className="bg-zinc-100 text-sm text-zinc-600"><tr>
          <th className="px-3 py-2.5 font-medium">রূপ</th>
          <th className="px-3 py-2.5 font-medium">First person <span className="font-normal">(বক্তা)</span></th>
          <th className="px-3 py-2.5 font-medium">Second person <span className="font-normal">(শ্রোতা)</span></th>
          <th className="px-3 py-2.5 font-medium">Third person <span className="font-normal">(অন্য কেউ)</span></th>
        </tr></thead>
        <tbody>
          {personRows.map((row) => <tr key={row.form} className="align-top odd:bg-white even:bg-zinc-100">
            <td className="px-3 py-3"><p className="font-semibold text-indigo-700">{row.form}</p><p className="text-sm text-zinc-600">{row.hint}</p><p className="mt-1 text-sm italic text-zinc-500">{row.example}</p></td>
            <td className="px-3 py-3"><Forms forms={row.first} /></td>
            <td className="px-3 py-3"><Forms forms={row.second} /></td>
            <td className="px-3 py-3"><Forms forms={row.third} /></td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <div>
      <h3 className="mb-2 text-sm font-semibold">Person অনুযায়ী verb</h3>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-base">
          <thead className="bg-zinc-100 text-sm text-zinc-600"><tr><th className="px-3 py-2.5 font-medium">Verb</th><th className="px-3 py-2.5 font-medium">First person</th><th className="px-3 py-2.5 font-medium">Second person</th><th className="px-3 py-2.5 font-medium">Third person</th></tr></thead>
          <tbody>
            {agreementRows.map((row) => <tr key={row.verb} className="odd:bg-white even:bg-zinc-100"><td className="px-3 py-2.5 font-semibold text-indigo-700">{row.verb}</td><td className="px-3 py-2.5">{row.first}</td><td className="px-3 py-2.5">{row.second}</td><td className="px-3 py-2.5">{row.third}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">মনে রাখো: Present simple-এ শুধু third person singular (he/she/it) হলে verb-এর সাথে s/es বসে।</p>
    </div>
  </section>;
}

/* ---------- Prefix & suffix ---------- */

type AffixDraft = { kind: AffixKind; affix: string; meaning: string; example: string };
const kindLabel: Record<AffixKind, string> = { PREFIX: "Prefix", SUFFIX: "Suffix" };
/** A table row: one of the user's entries (editable) or one from the built-in list everyone gets. */
type AffixRow = AffixDraft & { key: string; mine: Affix | null };

function KindSelect({ value, onChange }: { value: AffixKind; onChange: (kind: AffixKind) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value as AffixKind)} aria-label="Prefix না Suffix" className={input}>
    <option value="PREFIX">Prefix</option>
    <option value="SUFFIX">Suffix</option>
  </select>;
}

function AffixTable({ affixes }: { affixes: Affix[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<AffixDraft>({ kind: "PREFIX", affix: "", meaning: "", example: "" });
  const [editing, setEditing] = useState<{ id: string; values: AffixDraft } | null>(null);
  const [kindFilter, setKindFilter] = useState<"ALL" | AffixKind>("ALL");
  const [query, setQuery] = useState("");
  const [hideMeaning, setHideMeaning] = useState(false);
  const [filling, setFilling] = useState(false);
  const [source, setSource] = useState<"all" | "mine" | "common">("all");
  const [pending, start] = useTransition();
  // The user's own entry replaces the built-in one for the same prefix/suffix.
  const own = new Set(affixes.map((entry) => entry.kind + bareAffix(entry.affix)));
  const rows: AffixRow[] = [
    ...affixes.map((entry) => ({ ...entry, key: entry.id, mine: entry })),
    ...commonAffixes.filter((entry) => !own.has(entry.kind + bareAffix(entry.affix))).map((entry, index) => ({ ...entry, key: `common-${index}`, mine: null })),
  ].sort((a, b) => a.kind.localeCompare(b.kind) || bareAffix(a.affix).localeCompare(bareAffix(b.affix)));
  const inSource = rows.filter((row) => source === "all" || (source === "mine") === Boolean(row.mine));
  const shown = inSource.filter((entry) => (kindFilter === "ALL" || entry.kind === kindFilter) && matches(query, entry.affix, entry.meaning, entry.example));
  const complete = (values: AffixDraft) => Boolean(values.affix.trim() && values.meaning.trim());

  async function fill() {
    setFilling(true);
    const result = await fillWithAI(draft.kind, draft.affix);
    setFilling(false);
    if (result) setDraft((value) => ({ ...value, meaning: result.meaning ?? value.meaning, example: result.example ?? value.example }));
  }
  const add = () => start(async () => {
    try {
      await createAffix(draft);
      const replacesCommon = commonAffixes.some((entry) => entry.kind === draft.kind && bareAffix(entry.affix) === bareAffix(draft.affix));
      setDraft({ ...draft, affix: "", meaning: "", example: "" });
      toast.success(replacesCommon ? `“${draft.affix}” যোগ হলো — সাধারণ তালিকার বদলে এখন তোমার লেখাটা দেখাবে` : `“${draft.affix}” যোগ হলো`);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "যোগ করা গেল না।"); }
  });
  const save = () => editing && start(async () => {
    try { await updateAffix(editing.id, editing.values); setEditing(null); toast.success("সেভ হলো"); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "সেভ করা গেল না।"); }
  });
  const remove = (entry: Affix) => start(async () => {
    if (!window.confirm(`“${entry.affix}” মুছে ফেলবে?`)) return;
    try { await deleteAffix(entry.id); toast.success("মুছে ফেলা হলো"); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "মোছা গেল না।"); }
  });

  return <section className="space-y-3">
    <form onSubmit={(event) => { event.preventDefault(); if (complete(draft)) add(); }} className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-[7rem_1fr_auto_1.2fr_1.6fr]">
        <KindSelect value={draft.kind} onChange={(kind) => setDraft({ ...draft, kind })} />
        <input value={draft.affix} onChange={(event) => setDraft({ ...draft, affix: event.target.value })} placeholder={draft.kind === "PREFIX" ? "un-" : "-less"} aria-label="Prefix/Suffix" className={input} autoCapitalize="off" />
        <AiButton busy={filling} disabled={!draft.affix.trim()} onClick={() => void fill()} />
        <input value={draft.meaning} onChange={(event) => setDraft({ ...draft, meaning: event.target.value })} placeholder="অর্থ (না/বিপরীত)" aria-label="অর্থ" className={input} />
        <input value={draft.example} onChange={(event) => setDraft({ ...draft, example: event.target.value })} placeholder="উদাহরণ (unhappy — অসুখী)" aria-label="উদাহরণ" className={input} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">Prefix/Suffix লিখে <span className="font-medium text-indigo-700">AI</span> চাপলে অর্থ আর উদাহরণ বসে যাবে — মিলিয়ে নাও।</p>
        <button type="submit" disabled={pending || !complete(draft)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"><Plus className="size-4" /> Add</button>
      </div>
    </form>

    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium">
        {(["ALL", "PREFIX", "SUFFIX"] as const).map((kind) => <button key={kind} type="button" onClick={() => setKindFilter(kind)} className={cn("h-8 rounded-full px-3", kindFilter === kind ? "bg-white shadow-sm" : "text-zinc-500")}>
          {kind === "ALL" ? "সব" : kindLabel[kind]} ({kind === "ALL" ? inSource.length : inSource.filter((entry) => entry.kind === kind).length})
        </button>)}
      </div>
      <div className="flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium">
        {([["all", "সবার + আমার"], ["mine", `আমার (${affixes.length})`], ["common", "সাধারণ"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSource(id)} className={cn("h-8 rounded-full px-3", source === id ? "bg-white shadow-sm" : "text-zinc-500")}>{label}</button>
        ))}
      </div>
      <div className="min-w-40 flex-1"><SearchBox value={query} onChange={setQuery} placeholder="খুঁজো — un, less, অসুখী…" /></div>
      <HideToggle label="অর্থ লুকাও" hidden={hideMeaning} onToggle={() => setHideMeaning(!hideMeaning)} />
    </div>

    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[600px] text-left text-base">
        <thead className="bg-zinc-100 text-sm text-zinc-600"><tr>
          <th className="w-24 px-3 py-2.5 font-medium">ধরন</th><th className="px-3 py-2.5 font-medium">Prefix / Suffix</th><th className="px-3 py-2.5 font-medium">অর্থ</th><th className="px-3 py-2.5 font-medium">উদাহরণ</th><th className="w-20" />
        </tr></thead>
        <tbody>
          {shown.map((entry) => entry.mine && editing?.id === entry.mine.id
            ? <tr key={entry.key} className="bg-indigo-50/40">
              <td className="px-1.5 py-1.5"><KindSelect value={editing.values.kind} onChange={(kind) => setEditing({ ...editing, values: { ...editing.values, kind } })} /></td>
              {(["affix", "meaning", "example"] as const).map((key) => <td key={key} className="px-1.5 py-1.5"><input value={editing.values[key]} onChange={(event) => setEditing({ ...editing, values: { ...editing.values, [key]: event.target.value } })} aria-label={key} className={input} autoCapitalize="off" /></td>)}
              <td className="px-1.5"><div className="flex">
                <button type="button" onClick={save} disabled={pending || !complete(editing.values)} aria-label="Save" className={cn(iconButton, "text-emerald-700")}><Check className="size-4" /></button>
                <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className={iconButton}><X className="size-4" /></button>
              </div></td>
            </tr>
            : <tr key={entry.key} className="odd:bg-white even:bg-zinc-100">
              <td className="px-3 py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", entry.kind === "PREFIX" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700")}>{kindLabel[entry.kind]}</span></td>
              <td className="px-3 py-2.5 text-lg font-semibold">{entry.affix}{entry.mine ? <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">আমার</span> : null}</td>
              <td className="px-3 py-2.5 text-zinc-700"><QuizCell hidden={hideMeaning}>{entry.meaning}</QuizCell></td>
              <td className="px-3 py-2.5 text-zinc-700">{entry.example || <span className="text-zinc-300">—</span>}</td>
              <td className="px-1.5">{entry.mine ? <div className="flex">
                <button type="button" onClick={() => entry.mine && setEditing({ id: entry.mine.id, values: { kind: entry.kind, affix: entry.affix, meaning: entry.meaning, example: entry.example } })} aria-label={`${entry.affix} edit`} className={iconButton}><Pencil className="size-4" /></button>
                <button type="button" onClick={() => entry.mine && remove(entry.mine)} disabled={pending} aria-label={`${entry.affix} মুছে ফেলো`} className={cn(iconButton, "hover:bg-red-50 hover:text-red-700")}><Trash2 className="size-4" /></button>
              </div> : null}</td>
            </tr>)}
        </tbody>
      </table>
      {!shown.length ? <p className="px-4 py-10 text-center text-sm text-zinc-500">{source === "mine" && !affixes.length ? "এখনো তোমার নিজের কিছু নেই — উপরে লিখে Add করো।" : "কিছু মিলল না।"}</p> : null}
    </div>
    <p className="text-xs text-zinc-500">{shown.length}টি দেখানো হচ্ছে · “সাধারণ” তালিকা সবার জন্য, বদলানো যায় না — নিজের মতো লিখতে চাইলে একই prefix/suffix উপরে Add করো।</p>
  </section>;
}

/** Vocabulary: the user's verb-forms table, a pronoun reference by person, and a prefix/suffix table. */
export function VocabularyView({ verbs, affixes }: { verbs: Verb[]; affixes: Affix[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wanted = searchParams.get("tab");
  const active: Tab = tabs.some((tab) => tab.id === wanted) ? (wanted as Tab) : "verbs";

  return <div className="mx-auto max-w-4xl space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Vocabulary</h1>
      <p className="mt-1 text-sm text-zinc-500">Verb-এর রূপ, Person অনুযায়ী pronoun, আর Prefix–Suffix — বাংলা অর্থসহ।</p>
    </div>
    <div role="tablist" aria-label="Vocabulary" className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100 p-1">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => router.replace(`${pathname}?tab=${tab.id}`, { scroll: false })} className={cn("flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition", active === tab.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>
        {tab.label}
        {tab.id === "verbs" ? <span className="rounded-full bg-zinc-200/70 px-1.5 text-[11px] tabular-nums text-zinc-600">{verbs.length + commonVerbs.length}</span> : null}
        {tab.id === "affixes" ? <span className="rounded-full bg-zinc-200/70 px-1.5 text-[11px] tabular-nums text-zinc-600">{affixes.length + commonAffixes.length}</span> : null}
      </button>)}
    </div>
    {active === "verbs" ? <VerbTable verbs={verbs} /> : active === "persons" ? <PersonTable /> : <AffixTable affixes={affixes} />}
  </div>;
}
