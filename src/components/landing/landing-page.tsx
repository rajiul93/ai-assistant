import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Check, CheckCircle2, FileText, Lock, Mic, NotebookPen, ScanText, Sparkles, Timer, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LandingPlan = { name: string; planType: "STUDENT" | "PROFESSIONAL"; priceBdt: number; durationDays: number };

const taka = (value: number) => `৳${value.toLocaleString("en-IN")}`;

/* ---------- Small product visuals (drawn with HTML, so they stay sharp and light) ---------- */

function Field({ label, value, filled = true }: { label: string; value: string; filled?: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-200/80">
    <span className="text-[11px] text-zinc-400">{label}</span>
    <span className={cn("truncate text-xs font-medium", filled ? "text-zinc-800" : "text-zinc-300")}>{value}</span>
  </div>;
}

function Wave({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-flex h-4 items-center gap-[3px]", className)}>
    {[0, 0.15, 0.3, 0.1, 0.25].map((delay, index) => <span key={index} className="voice-bar h-full w-[3px] rounded-full bg-current" style={{ animationDelay: `${delay}s` }} />)}
  </span>;
}

function FormFromFileVisual() {
  return <div className="flex items-center gap-3">
    <div className="relative w-20 shrink-0 rotate-[-4deg] rounded-lg bg-white p-2 shadow-sm ring-1 ring-zinc-200">
      <span className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold text-red-500"><FileText className="size-3" /> PDF</span>
      {[80, 60, 90, 50, 70, 40].map((width, index) => <span key={index} className="mb-1 block h-1 rounded-full bg-zinc-200" style={{ width: `${width}%` }} />)}
    </div>
    <ArrowRight className="size-4 shrink-0 text-indigo-400" />
    <div className="min-w-0 flex-1 space-y-1.5">
      <Field label="Post" value="Assistant Officer" />
      <Field label="Roll" value="241 0587" />
      <Field label="User ID" value="BPSC-7K2Q" />
    </div>
  </div>;
}

function VoiceFormVisual() {
  return <div className="space-y-2">
    <div className="flex items-center gap-2 rounded-full bg-zinc-950 py-1.5 pl-1.5 pr-3 text-white">
      <span className="flex size-6 items-center justify-center rounded-full bg-rose-500"><Mic className="size-3.5" /></span>
      <span className="truncate text-xs">“Physics chapter 3, কাল সকালে, 45 মিনিট”</span>
      <Wave className="ml-auto h-3 shrink-0 text-rose-300" />
    </div>
    <Field label="Title" value="Physics chapter 3" />
    <div className="grid grid-cols-2 gap-1.5">
      <Field label="Due" value="কাল, সকাল" />
      <Field label="Time" value="45m" />
    </div>
  </div>;
}

function VoiceChatVisual() {
  return <div className="space-y-2 text-xs">
    <div className="ml-8 w-fit rounded-2xl rounded-br-md bg-zinc-950 px-3 py-1.5 text-white">নিউটনের তৃতীয় সূত্র বুঝিয়ে বলো</div>
    <div className="mr-6 rounded-2xl rounded-bl-md bg-white px-3 py-1.5 text-zinc-700 ring-1 ring-zinc-200">প্রত্যেক ক্রিয়ার একটি সমান ও বিপরীত প্রতিক্রিয়া আছে। যেমন…</div>
    <div className="ml-8 flex w-fit items-center gap-2 rounded-2xl rounded-br-md bg-zinc-950 px-3 py-1.5 text-white"><Wave className="h-3 text-rose-300" /> থামো, একটা উদাহরণ দাও</div>
  </div>;
}

function TrackVisual() {
  return <div className="flex items-center gap-4">
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r="32" fill="none" strokeWidth="7" className="stroke-zinc-200" />
        <circle cx="40" cy="40" r="32" fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={201} strokeDashoffset={60} className="stroke-emerald-500" />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-sm font-semibold tabular-nums">2h 48m</span><span className="text-[9px] text-zinc-400">আজ পড়া</span></span>
    </div>
    <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
      {[["Bangla grammar", true], ["Math — percentage", true], ["English vocab ৩০টি", false]].map(([title, done]) => <li key={String(title)} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-zinc-200/80">
        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300")}>{done ? <Check className="size-2.5" strokeWidth={3} /> : null}</span>
        <span className={cn("truncate", done && "text-zinc-400 line-through")}>{title}</span>
      </li>)}
    </ul>
  </div>;
}

function NotesVisual() {
  return <div className="grid grid-cols-[6.5rem_1fr] gap-2 text-xs">
    <ul className="space-y-1 rounded-lg bg-white p-2 ring-1 ring-zinc-200/80">
      <li className="font-semibold text-zinc-800">বাংলাদেশ বিষয়াবলি</li>
      <li className="pl-2 text-zinc-500">› মুক্তিযুদ্ধ</li>
      <li className="rounded bg-indigo-50 pl-2 font-medium text-indigo-700">› সংবিধান</li>
      <li className="font-semibold text-zinc-800">English</li>
    </ul>
    <div className="rounded-lg bg-white p-2 ring-1 ring-zinc-200/80">
      <p className="font-semibold text-zinc-800">সংবিধানের মূলনীতি</p>
      <p className="mt-1 leading-relaxed text-zinc-500">১. জাতীয়তাবাদ ২. সমাজতন্ত্র ৩. গণতন্ত্র ৪. ধর্মনিরপেক্ষতা</p>
    </div>
  </div>;
}

function FeatureCard({ icon, title, body, visual, className, ai = true }: { icon: ReactNode; title: string; body: string; visual: ReactNode; className?: string; ai?: boolean }) {
  return <article className={cn("flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white", className)}>
    <div className="flex-1 bg-linear-to-b from-zinc-50 to-zinc-100/60 p-5">{visual}</div>
    <div className="border-t border-zinc-100 p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-zinc-950 text-white">{icon}</span>
        <h3 className="font-semibold tracking-tight">{title}</h3>
        {ai ? <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">AI</span> : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{body}</p>
    </div>
  </article>;
}

/* ---------- Page ---------- */

const freeItems = ["Task বানানো, সাজানো ও শেষ করা", "Subject ও topic গুছিয়ে রাখা", "Rich-text notes লেখা", "Study timer ও দৈনিক লক্ষ্য", "Revision-এর হিসাব", "Job application ও ধাপগুলো track করা"];
const aiItems = ["ছবি/PDF থেকে form নিজে পূরণ", "Voice দিয়ে task ও form পূরণ", "AI-এর সাথে একটানা voice-এ কথা", "AI দিয়ে note লেখা ও ব্যাখ্যা", "ছবি দেখে প্রশ্নের উত্তর", "বলেই পাতা খোলা, timer চালু"];

export function LandingPage({ plans }: { plans: LandingPlan[] }) {
  const cheapest = plans.length ? Math.min(...plans.map((plan) => plan.priceBdt)) : null;
  const shown = plans.slice(0, 4);

  return <div className="min-h-full bg-white text-zinc-950">
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Prep home" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><span className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-white"><Sparkles className="size-3.5" /></span>Prep</Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <a href="#plans" className="hidden rounded-full px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-950 sm:block">Plans</a>
          <Link href="/login" className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800">Sign in</Link>
        </div>
      </div>
    </header>

    <main>
      {/* Section 1 — what the AI does */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600"><Sparkles className="size-3.5 text-indigo-500" /> চাকরি ও পড়াশোনার প্রস্তুতি, এক জায়গায়</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl">পড়ায় মন দাও।<br /><span className="text-zinc-400">বাকি ঝামেলা AI-এর।</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-500 sm:text-lg">Form পূরণ, task গোছানো, note লেখা — বলো বা একটা ছবি দাও, Prep নিজেই করে দেবে। পড়ার সময় আর অগ্রগতি থাকবে চোখের সামনে।</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:w-auto">Free-তে শুরু করো <ArrowRight className="size-4" /></Link>
            <a href="#plans" className="flex h-12 w-full items-center justify-center rounded-full border border-zinc-200 px-6 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 sm:w-auto">AI plan দেখো</a>
          </div>
          <p className="mt-3 text-xs text-zinc-400">Google দিয়ে এক ক্লিকে · কোনো card লাগবে না</p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <FeatureCard className="md:col-span-3" icon={<ScanText className="size-4" />} title="ছবি/PDF থেকে form" body="Admit card বা applicant copy-র ছবি দাও — Roll, User ID, পদের নাম সব নিজে বসে যাবে।" visual={<FormFromFileVisual />} />
          <FeatureCard className="md:col-span-3" icon={<Wand2 className="size-4" />} title="Voice দিয়ে form পূরণ" body="টাইপ না করে বলো; task-এর নাম, সময়, তারিখ নিজে থেকে ঠিক জায়গায় বসবে।" visual={<VoiceFormVisual />} />
          <FeatureCard className="md:col-span-2" icon={<Mic className="size-4" />} title="AI-এর সাথে voice-এ কথা" body="প্রশ্ন করো, উত্তর শোনো, মাঝপথে থামিয়ে নতুন কিছু বলো — একটানা, হাত ছাড়াই।" visual={<VoiceChatVisual />} />
          <FeatureCard className="md:col-span-2" icon={<Timer className="size-4" />} title="Task ও পড়ার সময়" body="দৈনিক কাজ, study timer আর লক্ষ্য — কতটা এগোলে, এক নজরে।" visual={<TrackVisual />} ai={false} />
          <FeatureCard className="md:col-span-2" icon={<NotebookPen className="size-4" />} title="Notes ও subjects" body="Subject › topic ধরে note গোছাও, task-এর সাথে জুড়ে দাও।" visual={<NotesVisual />} ai={false} />
        </div>
      </section>

      {/* Section 2 — free by hand, faster with AI */}
      <section className="border-y border-zinc-100 bg-zinc-50/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">সব কিছু free — হাতে করলে।</h2>
            <p className="mt-3 text-base leading-relaxed text-zinc-500">Subscription ছাড়াও পুরো app ব্যবহার করতে পারবে, সব কাজ নিজে হাতে। AI plan নিলে একই কাজ বলে বা একটা ছবি দিয়েই হয়ে যায়।</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">Manual</h3>
                <p className="text-2xl font-semibold">Free<span className="text-sm font-normal text-zinc-400"> · সবসময়</span></p>
              </div>
              <ul className="mt-5 space-y-3">
                {freeItems.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-700"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-zinc-400" /> {item}</li>)}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-indigo-500/25 blur-3xl" />
              <div className="relative flex items-baseline justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-4 text-indigo-300" /> AI</h3>
                <p className="text-2xl font-semibold">{cheapest !== null ? `${taka(cheapest)} থেকে` : "Subscription"}</p>
              </div>
              <p className="relative mt-1 text-xs text-zinc-400">Manual-এর সব কিছু, আর সাথে:</p>
              <ul className="relative mt-4 space-y-3">
                {aiItems.map((item) => <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-200"><Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-300" /> {item}</li>)}
              </ul>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500"><Lock className="size-3.5" /> AI feature-গুলো চালু হয় subscription নিলে; তোমার data সবসময় তোমারই থাকে।</p>
        </div>
      </section>

      {/* Section 3 — subscribe */}
      <section id="plans" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16 sm:px-6 sm:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">টাইপ কম, পড়া বেশি।</h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-300">Form টাইপ করা, task লেখা, note বানানো — এসবের সময়টা পড়ায় দাও। AI plan নাও, বাকিটা Prep সামলাবে।</p>
            {shown.length ? <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {shown.map((plan) => <div key={`${plan.planType}-${plan.name}`} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left ring-1 ring-white/10">
                <span>
                  <span className="block text-sm font-medium">{plan.planType === "STUDENT" ? "Student" : "Professional"} · {plan.name}</span>
                  <span className="text-xs text-zinc-400">{plan.durationDays} দিন</span>
                </span>
                <span className="text-lg font-semibold tabular-nums">{taka(plan.priceBdt)}</span>
              </div>)}
            </div> : null}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 sm:w-auto"><Sparkles className="size-4" /> AI plan নাও</Link>
              <Link href="/login" className="flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold text-zinc-300 ring-1 ring-white/20 transition hover:bg-white/5 sm:w-auto">আগে free-তে দেখো</Link>
            </div>
            <p className="mt-4 text-xs text-zinc-500">bKash / Nagad · বাকি দিন থাকলে নতুন plan তার সাথে যোগ হয়</p>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-zinc-400 sm:flex-row sm:px-6">
        <span className="flex items-center gap-1.5"><BookOpen className="size-3.5" /> Prep — পড়াশোনা ও চাকরির প্রস্তুতি</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  </div>;
}
