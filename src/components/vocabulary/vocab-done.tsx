"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, RotateCcw, Shuffle, Trophy, Undo2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { VocabExam, type ExamPlan } from "@/components/vocabulary/vocab-exam";
import { canPronounce, pronounce } from "@/lib/pronounce";
import { cn } from "@/lib/utils";
import { affixCard, BATCH_SIZE, buildExam, EXAM_TYPES, nounCard, PASS_PERCENT, rounds, shuffle, verbCard, type BatchStatus, type ExamType, type MatchItem, type VocabCard, type WordKind } from "@/lib/vocabulary/exam";
import type { listAffixes, listNouns, listVerbs } from "@/server/actions/vocabulary";

type LearnedRow = { key: string; batch: number; missed: boolean };
const KIND_LABEL: Record<WordKind, string> = { VERB: "Verb", NOUN: "Noun", AFFIX: "Prefix/Suffix" };
const panel = "rounded-3xl bg-white p-4 shadow-[0_6px_24px_-14px_rgba(15,23,42,0.18)]";
/** An exam needs a few words to make sense of dragging and choosing. */
const MIN_WORDS = 4;

/** Questions and, for the drag-and-drop exams, each screen's answers in a random order. */
export function planExam(type: ExamType, cards: readonly VocabCard[], revision: boolean): ExamPlan {
  const items = buildExam(type, cards);
  if (type === "SPELLING") return { type, revision, spelling: items as Extract<ExamPlan, { spelling: unknown }>["spelling"] };
  const screens = rounds(items as MatchItem[]);
  return { type, revision, screens: screens.map((screen) => ({ items: screen, pool: shuffle(screen.map((item) => item.answer)) })) };
}

/** One learned word, front (the word) and back (its forms and meaning); tap to turn it over. */
function Flashcard({ card, missed, onUnlearn }: { card: VocabCard; missed: boolean; onUnlearn: () => void }) {
  const [back, setBack] = useState(false);
  return <div className="space-y-2">
    <button type="button" onClick={() => setBack(!back)} aria-label={back ? "সামনের দিক দেখো" : "উল্টে দেখো"}
      className={cn("relative flex min-h-56 w-full flex-col items-center justify-center rounded-3xl p-5 text-center shadow-[0_14px_30px_-18px_rgba(15,23,42,0.45)] ring-1 transition active:scale-[0.99]", back ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200")}>
      <span className="absolute left-3 top-3 flex gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{KIND_LABEL[card.kind]}</span>
        {missed ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">ভুল হয়েছিল</span> : null}
      </span>
      {back ? <div className="w-full space-y-2">
        <p className="text-[15px] font-semibold text-slate-700">{card.meaning}</p>
        <div className="grid gap-1.5">
          {card.forms.map((form) => <div key={form.label} className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{form.label}</span>
            <span className="min-w-0 text-right"><span className="block text-[16px] font-bold text-slate-900 [overflow-wrap:anywhere]">{form.english}</span>{form.bangla ? <span className="block text-[12.5px] text-slate-500">{form.bangla}</span> : null}</span>
          </div>)}
        </div>
      </div> : <>
        <p className="text-[34px] font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere]">{card.word}</p>
        <p className="mt-2 text-xs text-slate-400">চাপ দিয়ে উল্টাও</p>
      </>}
    </button>
    <div className="flex items-center justify-center gap-2">
      <button type="button" onClick={() => (canPronounce() ? pronounce(card.word) : toast.error("এই browser-এ উচ্চারণ শোনা যায় না।"))} className="flex h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3 text-[13px] font-semibold text-blue-700"><Volume2 className="size-4" /> শোনো</button>
      <button type="button" onClick={onUnlearn} className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200"><Undo2 className="size-4" /> আবার শিখব</button>
    </div>
  </div>;
}

/**
 * Done: the words the user has learned. The current set of 50 and its three exams (80% each opens
 * the next set), the words answered wrong waiting for revision, and every learned word as a flashcard.
 */
export function VocabDone({ verbs, nouns, affixes, learned, status, onUnlearn }: {
  verbs: Awaited<ReturnType<typeof listVerbs>>;
  nouns: Awaited<ReturnType<typeof listNouns>>;
  affixes: Awaited<ReturnType<typeof listAffixes>>;
  learned: LearnedRow[];
  status: BatchStatus;
  onUnlearn: (kind: WordKind, id: string, label: string) => void;
}) {
  const cardsByKey = useMemo(() => new Map([...verbs.map(verbCard), ...nouns.map(nounCard), ...affixes.map(affixCard)].map((card) => [card.key, card])), [verbs, nouns, affixes]);
  const rows = learned.filter((row) => cardsByKey.has(row.key));
  const cardOf = (row: LearnedRow) => cardsByKey.get(row.key)!;
  const inSet = rows.filter((row) => row.batch === status.batch).map(cardOf);
  const missed = rows.filter((row) => row.missed).map(cardOf);
  const missedKeys = new Set(rows.filter((row) => row.missed).map((row) => row.key));

  const [filter, setFilter] = useState<"all" | "set" | "missed">("all");
  const [order, setOrder] = useState<string[] | null>(null);
  const [at, setAt] = useState(0);
  const [exam, setExam] = useState<ExamPlan | null>(null);
  const [examCards, setExamCards] = useState<VocabCard[]>([]);

  const deckBase = filter === "missed" ? missed : filter === "set" ? inSet : rows.map(cardOf);
  // A shuffled order holds until the filter changes; words that left it (unlearned) drop out.
  const deck = order ? order.map((key) => deckBase.find((card) => card.key === key)).filter((card): card is VocabCard => Boolean(card)) : deckBase;
  const index = Math.min(at, Math.max(0, deck.length - 1));
  const card = deck[index];

  const start = (type: ExamType, cards: VocabCard[], revision: boolean) => {
    if (cards.length < MIN_WORDS) { toast.error(`Exam-এর জন্য অন্তত ${MIN_WORDS}টা শব্দ লাগবে।`); return; }
    const plan = planExam(type, cards, revision);
    if (!("spelling" in plan ? plan.spelling.length : plan.screens.length)) { toast.error("এই শব্দগুলো দিয়ে এই exam হয় না — অন্যটা দাও।"); return; }
    setExamCards(cards);
    setExam(plan);
  };

  if (!rows.length) return <div className={cn(panel, "py-10 text-center")}>
    <Check className="mx-auto size-8 text-emerald-500" />
    <p className="mt-2 text-sm font-semibold text-slate-800">এখনো কোনো শব্দ শেখা হয়নি</p>
    <p className="mt-1 text-[13px] text-slate-500">Verb, Singular · Plural বা Prefix · Suffix-এ শেখা শব্দে টিক দাও — এখানে flashcard আর exam পাবে।</p>
  </div>;

  const setPercent = Math.min(100, Math.round((status.inBatch / BATCH_SIZE) * 100));
  return <div className="space-y-3">
    {/* The current set and its three exams. */}
    <section className={panel}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">সেট {status.batch}</h2>
        <p className="text-sm font-semibold tabular-nums text-slate-600">{Math.min(status.inBatch, BATCH_SIZE)}<span className="text-slate-400">/{BATCH_SIZE} শব্দ</span></p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-linear-to-r from-emerald-400 to-teal-500" style={{ width: `${setPercent}%` }} /></div>
      <p className={cn("mt-2.5 flex items-start gap-1.5 rounded-2xl px-3 py-2 text-[12.5px]", status.passed ? "bg-emerald-50 text-emerald-900" : status.locked ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600")}>
        {status.passed ? <Trophy className="mt-0.5 size-3.5 shrink-0" /> : status.locked ? <Lock className="mt-0.5 size-3.5 shrink-0" /> : null}
        {status.passed ? `পাস! নতুন ${BATCH_SIZE}টা শব্দ খোলা — শিখে টিক দাও।`
          : status.locked ? `নতুন শব্দ বন্ধ। তিনটা exam-এর প্রতিটায় ${PASS_PERCENT}% পেলে পরের ${BATCH_SIZE}টা খুলবে।`
          : `আরও ${BATCH_SIZE - status.inBatch}টা শিখলে সেট পূর্ণ হবে; তারপর তিনটা exam-এ ${PASS_PERCENT}% পেলে পরের সেট খুলবে। এখন অনুশীলন করতে পারো।`}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {EXAM_TYPES.map(({ type, title, hint }) => {
          const best = status.best[type];
          const passed = status.full && (best ?? 0) >= PASS_PERCENT;
          return <button key={type} type="button" onClick={() => start(type, inSet, false)} className={cn("flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition active:scale-[0.99] sm:flex-col sm:items-start", passed ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200 hover:bg-white")}>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">{passed ? <Check className="size-4 text-emerald-600" strokeWidth={3} /> : null}{title}</span>
              <span className="block text-[12px] leading-snug text-slate-500">{hint}</span>
            </span>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", best === null ? "bg-white text-slate-400" : (best ?? 0) >= PASS_PERCENT ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800")}>{best === null ? "শুরু করো" : `সেরা ${best}%`}</span>
          </button>;
        })}
      </div>
    </section>

    {/* Words answered wrong, kept apart for another go. */}
    <section className={cn(panel, missed.length ? "ring-1 ring-rose-100" : "")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">ভুলগুলো <span className="text-rose-600">{missed.length}</span></h2>
        {missed.length ? <button type="button" onClick={() => { setFilter("missed"); setOrder(null); setAt(0); }} className="text-[13px] font-semibold text-rose-700">Flashcard-এ দেখো</button> : null}
      </div>
      {missed.length ? <>
        <p className="mt-1 text-[12.5px] text-slate-500">Exam-এ যেগুলো ভুল হয়েছে — ঠিক হলে এখান থেকে সরে যাবে।</p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {EXAM_TYPES.map(({ type, title }) => <button key={type} type="button" onClick={() => start(type, missed, true)} className="h-10 rounded-xl bg-rose-50 px-2 text-[13px] font-semibold text-rose-800 ring-1 ring-rose-100 hover:bg-rose-100">{title}</button>)}
        </div>
      </> : <p className="mt-1 text-[12.5px] text-slate-500">এখন কোনো ভুল নেই। Exam-এ ভুল হলে শব্দগুলো নিজে থেকেই এখানে আসবে।</p>}
    </section>

    {/* Every learned word as a flashcard. */}
    <section className="space-y-2.5">
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {([["all", `সব ${rows.length}`], ["set", `এই সেট ${inSet.length}`], ["missed", `ভুল ${missed.length}`]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => { setFilter(id); setOrder(null); setAt(0); }} aria-pressed={filter === id} className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition", filter === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]")}>{label}</button>)}
        <button type="button" onClick={() => { setOrder(shuffle(deckBase.map((item) => item.key))); setAt(0); }} className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]"><Shuffle className="size-4" /> এলোমেলো</button>
      </div>
      {card ? <>
        <Flashcard key={card.key} card={card} missed={missedKeys.has(card.key)} onUnlearn={() => onUnlearn(card.kind, card.entryId, card.word)} />
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setAt(Math.max(0, index - 1))} disabled={index === 0} className="flex h-11 items-center gap-1.5 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.25)] disabled:opacity-40"><ArrowLeft className="size-4" /> আগের</button>
          <p className="text-sm font-semibold tabular-nums text-slate-500">{index + 1} / {deck.length}</p>
          {index < deck.length - 1
            ? <button type="button" onClick={() => setAt(index + 1)} className="flex h-11 items-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white">পরের <ArrowRight className="size-4" /></button>
            : <button type="button" onClick={() => setAt(0)} className="flex h-11 items-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"><RotateCcw className="size-4" /> আবার</button>}
        </div>
      </> : <p className={cn(panel, "py-8 text-center text-sm text-slate-500")}>এখানে কোনো শব্দ নেই।</p>}
    </section>

    {exam ? <VocabExam plan={exam} onRetry={() => setExam(planExam(exam.type, examCards, exam.revision))} onClose={() => setExam(null)} /> : null}
  </div>;
}
