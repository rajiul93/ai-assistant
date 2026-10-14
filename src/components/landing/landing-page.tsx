import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  CircleHelp,
  Crown,
  FileText,
  GraduationCap,
  Hourglass,
  Keyboard,
  Languages,
  ListChecks,
  ListTodo,
  Lock,
  MessageCircle,
  MonitorPlay,
  NotebookPen,
  Play,
  Sparkles,
  Timer,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { HeroIllustration } from "@/components/dashboard/hero-illustration";
import { cn } from "@/lib/utils";

/** Prices for one duration (a month), worked out on the server from the current pricing. */
export type LandingPricing = { durationLabel: string; discountPct: number; tiers: string[]; rows: Array<{ name: string; all: boolean; prices: number[] }>; from: number; online: boolean };

const taka = (value: number) => `৳${value.toLocaleString("en-IN")}`;
const card = "rounded-3xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]";
const heroGradient = "bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb]";

/** Every feature in the app today, in the home page's pastel tiles. Voice is admin-only, so not listed. */
const features: Array<{ icon: LucideIcon; label: string; body: string; tone: string }> = [
  { icon: BookOpenText, label: "প্রশ্ন ব্যাংক", body: "BCS, প্রাইমারি, ১১–২০ গ্রেডের বিগত প্রশ্ন", tone: "bg-blue-50 text-blue-600" },
  { icon: ListChecks, label: "প্রিলিমিনারি", body: "MCQ set বানিয়ে সময় ধরে পরীক্ষা", tone: "bg-rose-50 text-rose-500" },
  { icon: FileText, label: "শর্ট প্রশ্ন", body: "লিখিত প্রশ্ন, নিজে মিলিয়ে নম্বর", tone: "bg-sky-50 text-sky-600" },
  { icon: ListTodo, label: "Task ও timer", body: "আজকের কাজ, পড়ার সময়ের হিসাব", tone: "bg-orange-50 text-orange-500" },
  { icon: CalendarCheck, label: "স্টাডি প্ল্যান", body: "দৈনিক লক্ষ্য, বয়সের কাউন্টডাউন", tone: "bg-violet-50 text-violet-600" },
  { icon: NotebookPen, label: "নোটস", body: "Subject › topic ধরে গোছানো নোট", tone: "bg-amber-50 text-amber-600" },
  { icon: CircleHelp, label: "কনফিউশন", body: "সন্দেহ টুকে রাখুন, পরে Clear করুন", tone: "bg-emerald-50 text-emerald-600" },
  { icon: MonitorPlay, label: "ভিডিও", body: "YouTube ক্লাস, সাজেশন ছাড়া", tone: "bg-red-50 text-red-500" },
  { icon: Languages, label: "Vocabulary", body: "Verb, noun, prefix-suffix শেখা", tone: "bg-teal-50 text-teal-600" },
  { icon: Keyboard, label: "Typing Lab", body: "Bijoy-তে বাংলা টাইপিং অনুশীলন", tone: "bg-indigo-50 text-indigo-600" },
  { icon: BriefcaseBusiness, label: "চাকরির আবেদন", body: "কোথায় আবেদন, কোন ধাপে আছেন", tone: "bg-pink-50 text-pink-500" },
  { icon: MessageCircle, label: "বন্ধু ও গ্রুপ", body: "Chat, গ্রুপ, নোট-প্রশ্ন share", tone: "bg-cyan-50 text-cyan-600" },
];

const freeItems = [
  "Task, study timer, revision আর স্টাডি প্ল্যান",
  "Subject-topic, নোটস আর কনফিউশন",
  "প্রিলিমিনারি ও শর্ট প্রশ্নের set, পরীক্ষা ও ফলাফল",
  "প্রশ্ন ব্যাংকের প্রশ্ন",
  "Vocabulary, Typing Lab, চাকরির আবেদন",
  "বন্ধুদের সাথে chat, গ্রুপ আর share",
  "ভিডিও লাইব্রেরিতে ৫টা ভিডিও",
];
const planItems = [
  "AI সহকারী — প্রশ্ন করুন, ছবি দেখিয়ে বুঝে নিন",
  "বইয়ের পাতার ছবি থেকে প্রশ্নের set",
  "ছবি থেকে কনফিউশন, admit card থেকে আবেদনের তথ্য",
  "বেছে নেওয়া পরীক্ষার প্রশ্ন ব্যাংকের সমাধান ও ব্যাখ্যা",
  "সেই পরীক্ষার set প্রিলিমিনারিতে নিয়ে পরীক্ষা",
  "সীমাহীন ভিডিও",
];

/* ---------- Small product pictures, drawn in HTML so they stay sharp and light ---------- */

function McqVisual() {
  return <div className="space-y-2 text-[13px]">
    <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">৪৫তম BCS · বাংলা</span>
      <span className="flex items-center gap-1 tabular-nums"><Timer className="size-3.5" /> 08:42</span>
    </div>
    <p className="font-semibold leading-snug text-slate-800">“অরুণ” শব্দের সমার্থক কোনটি?</p>
    {[["ক", "চন্দ্র", false], ["খ", "সূর্য", true], ["গ", "আকাশ", false]].map(([key, text, right]) => <div key={String(key)} className={cn("flex items-center gap-2 rounded-xl px-2.5 py-1.5 ring-1", right ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-white text-slate-600 ring-slate-200")}>
      <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-bold", right ? "bg-emerald-500 text-white" : "bg-slate-100")}>{right ? <Check className="size-3" strokeWidth={3} /> : key}</span>{text}
    </div>)}
  </div>;
}

function PlanVisual() {
  return <div className="space-y-2.5">
    <div className="rounded-2xl bg-[#eef1fb] p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><Hourglass className="size-3.5 text-amber-500" /> ৩২ হতে বাকি</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center">
        {[["2", "বছর"], ["03", "মাস"], ["17", "দিন"]].map(([value, unit]) => <span key={unit} className="rounded-lg bg-white py-1"><span className="block text-base font-bold tabular-nums leading-tight">{value}</span><span className="text-[9px] text-slate-500">{unit}</span></span>)}
      </div>
    </div>
    <ul className="space-y-1.5 text-xs">
      {[["বাংলা ব্যাকরণ — সমাস", true], ["গণিত — শতকরা", true], ["English — Tense", false]].map(([title, done]) => <li key={String(title)} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>{done ? <Check className="size-2.5" strokeWidth={3} /> : null}</span>
        <span className={cn("truncate", done && "text-slate-400 line-through")}>{title}</span>
      </li>)}
    </ul>
  </div>;
}

function AiVisual() {
  return <div className="space-y-2 text-xs">
    <div className="flex items-center gap-2.5">
      <div className="w-16 shrink-0 rotate-[-4deg] rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
        <span className="mb-1 flex items-center gap-1 text-[8px] font-semibold text-blue-600"><Camera className="size-2.5" /> ছবি</span>
        {[85, 60, 90, 55, 75].map((width, index) => <span key={index} className="mb-1 block h-1 rounded-full bg-slate-200" style={{ width: `${width}%` }} />)}
      </div>
      <ArrowRight className="size-4 shrink-0 text-blue-400" />
      <div className="min-w-0 flex-1 space-y-1">
        {["১. বাংলা সাহিত্যের আদি নিদর্শন…", "২. ‘পদ্মাবতী’ কাব্যের রচয়িতা…", "৩. শূন্যপুরাণ কার রচনা…"].map((line) => <p key={line} className="truncate rounded-lg bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200">{line}</p>)}
      </div>
    </div>
    <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-linear-to-br from-[#3f6ef3] to-[#5a7ff6] px-3 py-1.5 text-white">২ নম্বরটার ব্যাখ্যা দাও</div>
    <div className="w-fit max-w-[90%] rounded-2xl rounded-tl-md bg-white px-3 py-1.5 text-slate-700 shadow-sm">‘পদ্মাবতী’ আলাওলের রচনা, মালিক মুহম্মদ জায়সীর ‘পদুমাবৎ’ অবলম্বনে…</div>
  </div>;
}

function FriendsVisual() {
  return <div className="space-y-1.5 text-xs">
    <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm">
      <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><UsersRound className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-800">৪৭তম BCS পড়ার দল</span><span className="block truncate text-[11px] text-slate-500">রিমা: আজ রাতে গণিতের মডেল টেস্ট?</span></span>
      <span className="flex size-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">3</span>
    </div>
    <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md bg-white px-3 py-1.5 text-slate-700 shadow-sm">সংবিধানের নোটটা পাঠাও তো</div>
    <div className="ml-auto flex w-fit items-center gap-2 rounded-2xl rounded-tr-md bg-linear-to-br from-[#3f6ef3] to-[#5a7ff6] px-3 py-1.5 text-white"><NotebookPen className="size-3.5" /> নোট share করা হলো</div>
  </div>;
}

function VideoVisual() {
  return <div className="overflow-hidden rounded-2xl bg-slate-900">
    <div className="relative flex aspect-video items-center justify-center bg-linear-to-br from-slate-700 to-slate-900">
      <span className="flex size-11 items-center justify-center rounded-full bg-white/95 text-blue-700 shadow-lg"><Play className="size-5 translate-x-px fill-current" /></span>
      <span className="absolute inset-x-2 bottom-2 h-1 rounded-full bg-white/25"><span className="block h-full w-2/5 rounded-full bg-red-500" /></span>
    </div>
    <p className="bg-white px-2.5 py-2 text-[11px] text-slate-500"><span className="font-semibold text-slate-800">শতকরা — এক ক্লাসে সব নিয়ম</span><br />শেষে অন্য ভিডিওর সাজেশন নেই</p>
  </div>;
}

function Showcase({ icon, tone, title, body, visual, plan }: { icon: ReactNode; tone: string; title: string; body: string; visual: ReactNode; plan?: string }) {
  return <article className={cn(card, "flex flex-col overflow-hidden")}>
    <div className="flex-1 bg-[#f4f6fb] p-4 sm:p-5">{visual}</div>
    <div className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}>{icon}</span>
        <h3 className="font-bold tracking-tight text-slate-900">{title}</h3>
        {plan ? <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">{plan}</span> : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
    </div>
  </article>;
}

/* ---------- Page ---------- */

/** The public page: what Prep is, every feature it has today, what's free and what a plan adds. */
export function LandingPage({ pricing }: { pricing: LandingPricing | null }) {
  const cheapest = pricing?.from ?? null;

  return <div className="min-h-full bg-[#f4f6fb] text-slate-900">
    <header className="sticky top-0 z-30 bg-[#f4f6fb]/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Prep home" className="min-w-0">
          <span className="flex items-center gap-1 text-[24px] font-extrabold leading-none tracking-tight text-slate-950">Prep<GraduationCap className="size-5 -translate-y-1.5 text-blue-600" strokeWidth={2.5} /></span>
          <span className="mt-0.5 block text-[11.5px] text-slate-500">চাকরির প্রস্তুতি, এখন আরও সহজ</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="#features" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-950 sm:block">Feature</a>
          <a href="#plans" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-950 sm:block">Plan</a>
          <Link href="/login" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition hover:bg-blue-700">Sign in</Link>
        </nav>
      </div>
    </header>

    <main className="mx-auto max-w-6xl space-y-14 px-4 pb-16 pt-2 sm:space-y-20 sm:px-6 sm:pt-6">
      {/* Hero — the home page's banner */}
      <section className={cn("relative overflow-hidden rounded-[28px] px-[clamp(18px,5vw,48px)] py-[clamp(24px,7vw,64px)] text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.6)]", heroGradient)}>
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <HeroIllustration className="pointer-events-none absolute bottom-[3%] right-[-4%] w-[clamp(130px,38vw,380px)] opacity-90 lg:right-[4%]" />
        <div className="relative max-w-[68%] lg:max-w-[58%]">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[clamp(11px,3vw,13px)] font-medium ring-1 ring-white/30"><Sparkles className="size-3.5" /> BCS · প্রাইমারি · ১১–২০ গ্রেড</p>
          <h1 className="mt-[clamp(10px,3vw,18px)] text-[clamp(26px,7.6vw,60px)] font-bold leading-[1.12] tracking-tight">লক্ষ্য সরকারি চাকরি</h1>
          <p className="mt-[clamp(6px,2vw,14px)] text-[clamp(13px,3.8vw,20px)] leading-snug text-white/90">পরিকল্পনা, পড়া, পরীক্ষা আর অগ্রগতি — প্রস্তুতির সব কিছু এক অ্যাপে।</p>
          <div className="mt-[clamp(16px,5vw,32px)] flex flex-wrap gap-2.5">
            <Link href="/login" className="flex h-[clamp(40px,11vw,52px)] items-center gap-2 rounded-full bg-white px-[clamp(16px,5vw,26px)] text-[clamp(13px,3.6vw,16px)] font-semibold text-slate-950 shadow-sm transition hover:bg-blue-50 active:scale-95">Free-তে শুরু করুন <ArrowRight className="size-4" /></Link>
            <a href="#plans" className="hidden h-12 items-center rounded-full px-5 text-[15px] font-semibold ring-1 ring-white/40 transition hover:bg-white/10 sm:flex">Plan দেখুন</a>
          </div>
          <p className="mt-2.5 text-[clamp(10.5px,2.8vw,13px)] text-white/80">Google দিয়ে এক চাপে · কোনো card লাগবে না</p>
        </div>
      </section>

      {/* Every feature at a glance, as the home page's Quick Access */}
      <section id="features" className="scroll-mt-20">
        <h2 className="text-[clamp(22px,6vw,36px)] font-bold tracking-tight">এক অ্যাপে যা যা আছে</h2>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-slate-500">চাকরির প্রস্তুতিতে যা লাগে, প্রতিটার আলাদা অ্যাপ না খুঁজে — সব এখানে, বাংলায়, ফোনে আরামে চলে।</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {features.map((feature) => <li key={feature.label} className={cn(card, "flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-start sm:gap-3 sm:p-4")}>
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl sm:size-11", feature.tone)}><feature.icon className="size-5 sm:size-[22px]" /></span>
            <span className="min-w-0">
              <span className="block text-[14px] font-bold leading-tight text-slate-900 sm:text-[15px]">{feature.label}</span>
              <span className="mt-1 block text-[12px] leading-snug text-slate-500 sm:text-[13px]">{feature.body}</span>
            </span>
          </li>)}
        </ul>
      </section>

      {/* A closer look at the main ones */}
      <section>
        <h2 className="text-[clamp(22px,6vw,36px)] font-bold tracking-tight">পড়া থেকে পরীক্ষা, পুরো পথ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Showcase icon={<BookOpenText className="size-5" />} tone="bg-blue-50 text-blue-600" title="প্রশ্ন ব্যাংক ও মডেল টেস্ট" body="বিগত সালের প্রশ্ন পরীক্ষা ধরে সাজানো। নিজের MCQ set বানিয়ে সময় ধরে পরীক্ষা দিন, ফলাফলে দেখুন কোথায় ভুল।" visual={<McqVisual />} />
          <Showcase icon={<CalendarCheck className="size-5" />} tone="bg-violet-50 text-violet-600" title="প্রতিদিনের পরিকল্পনা" body="আজকের task, study timer আর revision — সাথে চাকরির বয়স শেষ হতে কত দিন বাকি, সব home-এ।" visual={<PlanVisual />} />
          <Showcase icon={<Sparkles className="size-5" />} tone="bg-amber-50 text-amber-600" title="AI সহকারী" body="বইয়ের পাতার ছবি দিন, প্রশ্নের set তৈরি। না বুঝলে AI-কে জিজ্ঞেস করুন, ছবি দেখিয়েও।" visual={<AiVisual />} plan="Plan" />
          <Showcase icon={<MonitorPlay className="size-5" />} tone="bg-red-50 text-red-500" title="মনোযোগী ভিডিও ক্লাস" body="YouTube-এর ক্লাস এখানেই চালান। Pause বা শেষ হলে অন্য ভিডিওর সাজেশন আসে না, তাই পড়া থেকে মন সরে না।" visual={<VideoVisual />} />
          <Showcase icon={<UsersRound className="size-5" />} tone="bg-emerald-50 text-emerald-600" title="বন্ধুদের সাথে পড়া" body="বন্ধুকে chat করুন, পড়ার গ্রুপ খুলুন, নোট-task-প্রশ্নের set এক চাপে share করুন।" visual={<FriendsVisual />} />
          <article className={cn("relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.6)]", heroGradient)}>
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
            <div className="relative">
              <h3 className="text-xl font-bold leading-snug">আরও আছে</h3>
              <ul className="mt-3 space-y-2 text-[14px] text-white/95">
                {["শর্ট প্রশ্ন — লিখে মিলিয়ে নম্বর", "কনফিউশন — সন্দেহের তালিকা", "Vocabulary ও Typing Lab", "চাকরির আবেদনের হিসাব"].map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {item}</li>)}
              </ul>
            </div>
            <Link href="/login" className="relative mt-5 flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 active:scale-95">দেখে আসুন <ArrowRight className="size-4" /></Link>
          </article>
        </div>
      </section>

      {/* Free by hand, more with a plan */}
      <section>
        <h2 className="text-[clamp(22px,6vw,36px)] font-bold tracking-tight">বেশিরভাগই free</h2>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-slate-500">Plan ছাড়াই পুরো অ্যাপ ব্যবহার করা যায়। Plan নিলে AI আর কিছু বাড়তি সুবিধা খুলে যায়।</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className={cn(card, "p-5 sm:p-6")}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold">Free</h3>
              <p className="text-sm text-slate-500">সবসময়</p>
            </div>
            <ul className="mt-4 space-y-2.5">
              {freeItems.map((item) => <li key={item} className="flex items-start gap-2.5 text-[14px] text-slate-700"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {item}</li>)}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-5 text-white sm:p-6">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="relative flex items-baseline justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-bold"><Crown className="size-5 text-amber-300" /> Plan</h3>
              <p className="text-lg font-bold">{cheapest !== null ? `${taka(cheapest)} থেকে` : ""}</p>
            </div>
            <p className="relative mt-1 text-xs text-slate-400">Free-এর সব কিছু, আর সাথে:</p>
            <ul className="relative mt-3 space-y-2.5">
              {planItems.map((item) => <li key={item} className="flex items-start gap-2.5 text-[14px] text-slate-200"><Sparkles className="mt-0.5 size-4 shrink-0 text-blue-300" /> {item}</li>)}
            </ul>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Lock className="size-3.5" /> আপনার নোট, task আর প্রশ্ন শুধু আপনারই — share না করলে কেউ দেখে না।</p>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-20">
        <div className={cn("relative overflow-hidden rounded-[28px] px-5 py-10 text-center text-white sm:px-12 sm:py-14", heroGradient)}>
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-56 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-[clamp(24px,6.6vw,44px)] font-bold leading-tight tracking-tight">আজ থেকেই গুছিয়ে পড়া শুরু হোক</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/90">Free-তে শুরু করুন। দরকার হলে পরে plan নিন: পরীক্ষা বেছে নিন, সাথে AI — {pricing?.online ? "bKash, Nagad বা card-এ" : "bKash বা Nagad-এ"}।</p>
            {pricing ? <div className="mt-7 overflow-hidden rounded-2xl bg-white/15 text-left ring-1 ring-white/25">
              <div className="grid grid-cols-[1fr_repeat(var(--tiers),minmax(4.5rem,auto))] gap-x-3 px-4 py-2.5 text-[11.5px] font-medium text-white/80" style={{ ["--tiers" as string]: pricing.tiers.length }}>
                <span>{pricing.durationLabel}</span>{pricing.tiers.map((tier) => <span key={tier} className="text-right">{tier}</span>)}
              </div>
              {pricing.rows.map((row) => <div key={row.name} className={cn("grid grid-cols-[1fr_repeat(var(--tiers),minmax(4.5rem,auto))] items-center gap-x-3 border-t border-white/15 px-4 py-2.5", row.all && "bg-white/10")} style={{ ["--tiers" as string]: pricing.tiers.length }}>
                <span className="min-w-0 text-sm font-semibold">{row.name}{row.all && pricing.discountPct ? <span className="ml-1.5 rounded-full bg-amber-300 px-1.5 py-px text-[10px] font-bold text-amber-950">−{pricing.discountPct}%</span> : null}</span>
                {row.prices.map((price, index) => <span key={index} className="text-right text-base font-bold tabular-nums">{taka(price)}</span>)}
              </div>)}
            </div> : null}
            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Link href="/login" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-blue-700 transition hover:bg-blue-50 active:scale-95 sm:w-auto">Free-তে শুরু করুন <ArrowRight className="size-4" /></Link>
            </div>
            <p className="mt-3 text-xs text-white/80">প্রতিটা plan-এ System, AI আর পরীক্ষা — বেশি মেয়াদে আরও ছাড়</p>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-200/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
        <span className="flex items-center gap-1.5"><GraduationCap className="size-4 text-blue-600" /> Prep — চাকরির প্রস্তুতি, এখন আরও সহজ</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  </div>;
}
