"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, RotateCcw, Shuffle, Trophy, Undo2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { VocabExam, type ExamPlan } from "@/components/vocabulary/vocab-exam";
import { canPronounce, pronounce } from "@/lib/pronounce";
import { playSwipeSound } from "@/lib/swipe-sound";
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

/** A finger drag further than this (px) sideways turns to the next or previous card. */
const SWIPE = 60;

/** How long a swiped card takes to fly off before the next one comes in. */
const FLY_MS = 200;

/**
 * One learned word on the primary blue, front (the word) and back (its forms, meaning and sentences).
 * Tap to turn it over; swipe left for the next card, right for the previous one: the card flies
 * off with a soft whoosh and the next slides in from the other side (`enter`).
 */
function Flashcard({ card, missed, enter, onUnlearn, onNext, onPrev }: { card: VocabCard; missed: boolean; enter: "left" | "right" | null; onUnlearn: () => void; onNext?: () => void; onPrev?: () => void }) {
  const [back, setBack] = useState(false);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState(false);
  // The drag itself (with its latest distance) lives here: state may lag behind the last move.
  const drag = useRef<{ x: number; y: number; dx: number; sideways: boolean | null } | null>(null);
  // A swipe ends in a click on the card too; that click must not flip it.
  const swiped = useRef(false);

  function onPointerUp() {
    const from = drag.current;
    drag.current = null;
    if (from?.sideways && Math.abs(from.dx) > SWIPE) {
      swiped.current = true;
      // Off the screen the way it was going, then the next card.
      const next = from.dx < 0;
      setFlying(true);
      setDx(next ? -window.innerWidth : window.innerWidth);
      playSwipeSound();
      window.setTimeout(() => (next ? onNext : onPrev)?.(), FLY_MS);
      return;
    }
    if (from?.sideways) swiped.current = true;
    setDx(0);
  }

  return <div className="space-y-2">
    {/* Sideways movement stays inside this box: a card sticking out past the screen edge made
        phones zoom the whole page out and back, which looked like a reload. */}
    <div className="-mx-2 overflow-x-clip px-2">
    <button type="button" aria-label={back ? "সামনের দিক দেখো" : "উল্টে দেখো"}
      onClick={() => { if (swiped.current) { swiped.current = false; return; } setBack(!back); }}
      onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, dx: 0, sideways: null }; swiped.current = false; }}
      onPointerMove={(event) => {
        const from = drag.current;
        if (!from) return;
        const x = event.clientX - from.x;
        const y = event.clientY - from.y;
        // Decide once whether this is a sideways swipe or a scroll down the page.
        if (from.sideways === null && Math.hypot(x, y) > 8) from.sideways = Math.abs(x) > Math.abs(y);
        if (from.sideways) { from.dx = x; setDx(x); }
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; setDx(0); }}
      style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined, transition: flying ? `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms ease-in` : dx ? "none" : "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)", opacity: flying ? 0 : 1 }}
      className={cn(enter === "right" ? "card-in-right" : enter === "left" ? "card-in-left" : "", "relative flex min-h-56 w-full touch-pan-y select-none flex-col items-center justify-center overflow-hidden rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-5 text-center text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.8)]")}>
      {/* Two soft circles, as on the profile card. */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-16 left-10 size-36 rounded-full bg-white/10" />
      <span className="absolute left-3 top-3 flex gap-1.5">
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/30">{KIND_LABEL[card.kind]}</span>
        {missed ? <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[11px] font-bold text-white">ভুল হয়েছিল</span> : null}
      </span>
      {back ? <div className="relative w-full space-y-2 pt-6">
        <p className="text-[15px] font-semibold text-white">{card.meaning}</p>
        <div className="grid gap-1.5">
          {card.forms.map((form) => <div key={form.label} className="flex items-center justify-between gap-2 rounded-2xl bg-white/15 px-3 py-2 text-left ring-1 ring-white/20">
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/75">{form.label}</span>
            <span className="min-w-0 text-right"><span className="block text-[16px] font-bold [overflow-wrap:anywhere]">{form.english}</span>{form.bangla ? <span className="block text-[12.5px] text-white/85">{form.bangla}</span> : null}</span>
          </div>)}
        </div>
        {/* Example sentences (paid users), each with its Bangla. */}
        {card.sentences?.length ? <div className="space-y-1.5 pt-1 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">উদাহরণ বাক্য</p>
          {card.sentences.map((sentence, index) => <div key={index} className="rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/20">
            <p className="text-[14px] font-medium leading-snug"><span className="mr-1.5 rounded-full bg-white/25 px-1.5 text-[10.5px] font-bold">{sentence.form}</span>{sentence.en}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/85">{sentence.bn}</p>
          </div>)}
        </div> : null}
      </div> : <span className="relative">
        <span className="block text-[34px] font-bold tracking-tight [overflow-wrap:anywhere]">{card.word}</span>
        <span className="mt-2 block text-xs text-white/80">চাপ দিয়ে উল্টাও · পাশে টেনে পরেরটা</span>
      </span>}
    </button>
    </div>
    <div className="flex items-center justify-center gap-2">
      <button type="button" onClick={() => (canPronounce() ? pronounce(card.word) : toast.error("এই browser-এ উচ্চারণ শোনা যায় না।"))} className="flex h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3 text-[13px] font-semibold text-blue-700"><Volume2 className="size-4" /> শোনো</button>
      <button type="button" onClick={onUnlearn} title="ভুল করে টিক দিয়েছ বা আবার শিখতে চাও — শব্দটা তালিকায় ফিরে যাবে" className="flex h-9 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200"><Undo2 className="size-4" /> তালিকায় ফেরত পাঠাও</button>
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
  // The side the next card slides in from (none for the first card or a new filter).
  const [enter, setEnter] = useState<"left" | "right" | null>(null);
  // Every turn mounts a fresh card, even when the deck has one word and "next" is the same one.
  const [turn, setTurn] = useState(0);
  const [exam, setExam] = useState<ExamPlan | null>(null);
  const [examCards, setExamCards] = useState<VocabCard[]>([]);

  const deckBase = filter === "missed" ? missed : filter === "set" ? inSet : rows.map(cardOf);
  // A shuffled order holds until the filter changes; words that left it (unlearned) drop out.
  const deck = order ? order.map((key) => deckBase.find((card) => card.key === key)).filter((card): card is VocabCard => Boolean(card)) : deckBase;
  const index = Math.min(at, Math.max(0, deck.length - 1));
  const card = deck[index];

  /** To the next or previous card (wrapping at the ends), sliding in from the matching side; a swipe already made its sound. */
  const go = (direction: "next" | "prev", sound = true) => {
    if (sound) playSwipeSound();
    setEnter(direction === "next" ? "right" : "left");
    setTurn((value) => value + 1);
    setAt(direction === "next" ? (index < deck.length - 1 ? index + 1 : 0) : (index > 0 ? index - 1 : deck.length - 1));
  };

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
        {missed.length ? <button type="button" onClick={() => { setFilter("missed"); setOrder(null); setAt(0); setEnter(null); }} className="text-[13px] font-semibold text-rose-700">Flashcard-এ দেখো</button> : null}
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
        {([["all", `সব ${rows.length}`], ["set", `এই সেট ${inSet.length}`], ["missed", `ভুল ${missed.length}`]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => { setFilter(id); setOrder(null); setAt(0); setEnter(null); }} aria-pressed={filter === id} className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition", filter === id ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]")}>{label}</button>)}
        <button type="button" onClick={() => { setOrder(shuffle(deckBase.map((item) => item.key))); setAt(0); }} className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]"><Shuffle className="size-4" /> এলোমেলো</button>
      </div>
      {card ? <>
        <Flashcard key={`${card.key}:${turn}`} card={card} missed={missedKeys.has(card.key)} onUnlearn={() => onUnlearn(card.kind, card.entryId, card.word)}
          enter={enter} onNext={() => go("next", false)} onPrev={() => go("prev", false)} />
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => go("prev")} disabled={index === 0} className="flex h-11 items-center gap-1.5 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-700 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.25)] disabled:opacity-40"><ArrowLeft className="size-4" /> আগের</button>
          <p className="text-sm font-semibold tabular-nums text-slate-500">{index + 1} / {deck.length}</p>
          {index < deck.length - 1
            ? <button type="button" onClick={() => go("next")} className="flex h-11 items-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white">পরের <ArrowRight className="size-4" /></button>
            : <button type="button" onClick={() => setAt(0)} className="flex h-11 items-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"><RotateCcw className="size-4" /> আবার</button>}
        </div>
      </> : <p className={cn(panel, "py-8 text-center text-sm text-slate-500")}>এখানে কোনো শব্দ নেই।</p>}
    </section>

    {exam ? <VocabExam plan={exam} onRetry={() => setExam(planExam(exam.type, examCards, exam.revision))} onClose={() => setExam(null)} /> : null}
  </div>;
}
