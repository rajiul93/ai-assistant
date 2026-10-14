import Link from "next/link";
import {
  BookOpen,
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck,
  ChartColumnIncreasing,
  ChevronRight,
  CircleHelp,
  Crown,
  FileText,
  Keyboard,
  Languages,
  ListChecks,
  ListTodo,
  MessageCircle,
  MonitorPlay,
  NotebookPen,
  RotateCcw,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ClockToolsCard } from "@/components/dashboard/clock-tools-card";
import { DailyChallengeCard } from "@/components/dashboard/daily-challenge-card";
import { DeadlineCountdown } from "@/components/dashboard/deadline-countdown";
import { HeroIllustration } from "@/components/dashboard/hero-illustration";
import { HeroPlanButton, TodayPlanStarter, type FirstTask } from "@/components/dashboard/today-plan-starter";
import { MathText } from "@/components/math-text";
import { PageFinder } from "@/components/page-finder";
import { Progress } from "@/components/ui/progress";
import { APP_TIMEZONE, dayjs, formatRemaining } from "@/lib/dayjs";
import { lastRevisedLabel, needsRevision } from "@/lib/revisions";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/server/queries";

/**
 * The home page's shortcuts, in the design's pastel tiles — three full rows of five on a phone.
 * Only pages that exist; `isNew` puts a small "নতুন" badge on recently added features.
 */
const quickAccess: Array<{ href: string; label: string; icon: LucideIcon; tone: string; isNew?: boolean }> = [
  { href: "/question-bank", label: "প্রশ্ন ব্যাংক", icon: BookOpenText, tone: "bg-blue-50 text-blue-600" },
  { href: "/preliminary", label: "প্রিলিমিনারি", icon: ListChecks, tone: "bg-rose-50 text-rose-500" },
  { href: "/videos", label: "ভিডিও", icon: MonitorPlay, tone: "bg-red-50 text-red-500", isNew: true },
  { href: "/messages", label: "মেসেজ", icon: MessageCircle, tone: "bg-cyan-50 text-cyan-600", isNew: true },
  { href: "/billing", label: "প্রিমিয়াম", icon: Crown, tone: "bg-yellow-50 text-yellow-600", isNew: true },
  { href: "/confusions", label: "কনফিউশন", icon: CircleHelp, tone: "bg-emerald-50 text-emerald-600" },
  { href: "/notes", label: "নোটস", icon: NotebookPen, tone: "bg-orange-50 text-orange-500" },
  { href: "/plan", label: "স্টাডি প্ল্যান", icon: CalendarCheck, tone: "bg-violet-50 text-violet-600" },
  { href: "/jobs", label: "চাকরি", icon: BriefcaseBusiness, tone: "bg-pink-50 text-pink-500" },
  { href: "/progress", label: "প্রগতি", icon: ChartColumnIncreasing, tone: "bg-indigo-50 text-indigo-600" },
  { href: "/short-questions", label: "শর্ট প্রশ্ন", icon: FileText, tone: "bg-sky-50 text-sky-600" },
  { href: "/subjects", label: "বিষয়", icon: BookOpen, tone: "bg-lime-50 text-lime-600" },
  { href: "/vocabulary", label: "Vocabulary", icon: Languages, tone: "bg-teal-50 text-teal-600" },
  { href: "/typing", label: "Typing Lab", icon: Keyboard, tone: "bg-amber-50 text-amber-600" },
  { href: "/profile", label: "প্রোফাইল", icon: UserRound, tone: "bg-fuchsia-50 text-fuchsia-600" },
];

const card = "rounded-3xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]";

export function DashboardView({
  longTermDeadline,
  dateOfBirth,
  ageLimitYears,
  preparationDeadline,
  dailyTargetMinutes,
  studiedSeconds,
  streak,
  todayTasks,
  pendingCount,
  finishedCount,
  revisionCount,
  toRevise,
  todayMs,
  progressPercent,
  planStartedAt,
  firstTask,
  firstName,
}: {
  longTermDeadline: Date | null;
  dateOfBirth: Date | null;
  ageLimitYears: number;
  preparationDeadline: Date | null;
  dailyTargetMinutes: number;
  studiedSeconds: number;
  /** Days in a row with any study. */
  streak: number;
  todayTasks: TaskWithRelations[];
  pendingCount: number;
  finishedCount: number;
  /** Revision-list tasks that need revising (never, or not for a week). */
  revisionCount: number;
  /** Up to five revision-list tasks, most in need of revision first. */
  toRevise: TaskWithRelations[];
  todayMs: number;
  progressPercent: number;
  planStartedAt: string | null;
  firstTask: FirstTask;
  firstName: string;
}) {
  const prep = preparationDeadline ? formatRemaining(preparationDeadline) : null;
  const hour = dayjs(todayMs).tz(APP_TIMEZONE).hour();
  const greeting = hour < 12 ? "শুভ সকাল" : hour < 17 ? "শুভ দুপুর" : "শুভ সন্ধ্যা";
  const openTasks = todayTasks.filter((task) => task.status !== "FINISHED");

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Desktop: the greeting and the page search (phones have them in the header). */}
      <div className="hidden items-center justify-between gap-3 lg:flex">
        <div>
          <p className="text-sm text-slate-500">{dayjs(todayMs).tz(APP_TIMEZONE).format("dddd, D MMMM")}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <PageFinder />
      </div>

      {/* Banner */}
      {/* Type sizes follow the screen width (clamp), so the banner reads the same on a small phone and a desktop. */}
      <section className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] px-[clamp(18px,5vw,40px)] py-[clamp(20px,6vw,44px)] text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.6)]">
        <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <HeroIllustration className="pointer-events-none absolute bottom-[4%] right-[-2%] w-[clamp(132px,40vw,330px)] lg:right-[3%] lg:w-[300px]" />
        <div className="relative max-w-[66%] lg:max-w-[60%]">
          <h1 className="whitespace-nowrap text-[clamp(23px,6.9vw,50px)] font-bold leading-[1.15] tracking-tight">লক্ষ্য সরকারি চাকরি</h1>
          <p className="mt-[clamp(4px,1.4vw,10px)] text-[clamp(12.5px,3.7vw,20px)] leading-snug text-white/90">পরিকল্পিত প্রস্তুতি, নিশ্চিত অগ্রগতি</p>
          <div className="mt-[clamp(14px,4.4vw,28px)]"><HeroPlanButton startedAt={planStartedAt} firstTask={firstTask} /></div>
        </div>
      </section>

      {/* Countdown + today's plan, side by side as in the design (wider countdown). */}
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-[clamp(10px,3vw,20px)] lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <DeadlineCountdown
          deadline={longTermDeadline ? longTermDeadline.toISOString() : null}
          dateOfBirth={dateOfBirth ? dateOfBirth.toISOString() : null}
          ageLimitYears={ageLimitYears}
        />
        <TodayPlanStarter
          startedAt={planStartedAt}
          firstTask={firstTask}
          taskCount={openTasks.length}
          revisionCount={revisionCount}
          dailyTargetMinutes={dailyTargetMinutes}
        />
      </div>

      {/* Quick access */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[clamp(17px,4.9vw,24px)] font-bold tracking-tight text-slate-900">Quick Access</h2>
          <PageFinder trigger="see-all" />
        </div>
        {/* Phones: just the icon and its name on the page, so five fit a row with room to breathe;
            from sm up each sits on its own white card, as in the design. */}
        <nav aria-label="Quick access" className="grid grid-cols-5 gap-x-1 gap-y-4 sm:gap-[clamp(10px,2vw,16px)]">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className="group flex flex-col items-center gap-1.5 text-center transition active:scale-95 sm:rounded-3xl sm:bg-white sm:px-1 sm:py-5 sm:shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:hover:-translate-y-0.5">
              <span className={cn("relative flex size-[clamp(48px,13.6vw,64px)] items-center justify-center rounded-[clamp(15px,4.2vw,20px)] ring-1 ring-white shadow-[0_6px_16px_-10px_rgba(15,23,42,0.35)] sm:shadow-none", item.tone)}>
                <Icon className="size-[clamp(23px,6.4vw,30px)]" strokeWidth={2} />
                {item.isNew ? <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 px-1.5 text-[9.5px] font-bold leading-4 text-white ring-2 ring-[#f4f6fb] sm:ring-white">নতুন</span> : null}
              </span>
              <span className="w-full truncate px-0.5 text-[clamp(11px,3vw,15px)] font-medium leading-tight text-slate-700">{item.label}</span>
            </Link>;
          })}
        </nav>
      </section>

      {/* Below the shortcuts everything sits two to a row, phones included, so the page stays short. */}
      <div className="grid grid-cols-2 gap-[clamp(10px,3vw,20px)] lg:grid-cols-3">
        <DailyChallengeCard dailyTargetMinutes={dailyTargetMinutes} savedSeconds={studiedSeconds} streak={streak} />

        <Link href="/progress" className={cn(card, "flex h-full flex-col p-3.5 transition active:scale-[0.98] sm:p-5")}>
          <span className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 sm:size-11"><ChartColumnIncreasing className="size-5 text-blue-600 sm:size-6" /></span>
            <span className="text-[13px] font-bold leading-tight text-slate-900 sm:text-base">সার্বিক প্রস্তুতি</span>
          </span>
          <span className="mt-2 block text-2xl font-bold tabular-nums text-blue-700 sm:text-3xl">{progressPercent}%</span>
          <span className="mt-auto block pt-1.5">
            <Progress className="h-1.5 bg-slate-100 sm:h-2" barClassName="bg-blue-600" value={progressPercent} />
            <span className={cn("mt-1.5 block truncate text-[11px] sm:text-sm", prep?.overdue ? "font-medium text-red-600" : "text-slate-500")}>{prep ? `সময়: ${prep.label}` : "Deadline দিন"}</span>
          </span>
        </Link>

        <section className="flex h-full flex-col rounded-3xl bg-linear-to-br from-orange-50 to-amber-50/60 p-3.5 sm:p-5">
          <Link href="/tasks" className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900 sm:text-base"><ListTodo className="size-4 text-orange-500 sm:size-5" /> আজকের কাজ</span>
            <ChevronRight className="size-4 shrink-0 text-slate-400" />
          </Link>
          {todayTasks.length ? <ul className="mt-2 space-y-1.5">
            {todayTasks.slice(0, 3).map((task) => <li key={task.id}>
              <Link href="/tasks" className="flex items-center gap-2 rounded-xl bg-white/80 px-2 py-1.5">
                <span className={cn("size-2 shrink-0 rounded-full", task.status === "FINISHED" ? "bg-emerald-500" : task.priority === "HIGH" ? "bg-red-500" : task.priority === "MEDIUM" ? "bg-amber-400" : "bg-slate-300")} />
                <span className={cn("min-w-0 flex-1 truncate text-[12px] font-medium sm:text-sm", task.status === "FINISHED" && "text-slate-400 line-through")}><MathText text={task.title} /></span>
              </Link>
            </li>)}
          </ul> : <p className="mt-2 text-[12px] text-slate-600 sm:text-sm">আজ কোনো কাজ নেই।</p>}
          {todayTasks.length > 3 ? <p className="mt-1 text-[11px] text-slate-500">আরও {todayTasks.length - 3}টি</p> : null}
          <Link href="/tasks?add=1" className="mt-auto pt-2 text-[12px] font-semibold text-blue-700 sm:text-sm">+ নতুন task</Link>
        </section>

        <section className={cn(card, "flex h-full flex-col p-3.5 sm:p-5")}>
          <Link href="/tasks?view=revisions" className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900 sm:text-base"><RotateCcw className="size-4 text-blue-600 sm:size-5" /> রিভিশন বাকি</span>
            <ChevronRight className="size-4 shrink-0 text-slate-400" />
          </Link>
          {toRevise.length ? <ul className="mt-2 space-y-1.5">
            {toRevise.slice(0, 3).map((task, index) => <li key={task.id}>
              <Link href="/tasks?view=revisions" className="flex items-center gap-2">
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", index === 0 ? "bg-amber-100 text-amber-700" : index === 1 ? "bg-slate-100 text-slate-600" : "bg-orange-100 text-orange-700")}>{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium sm:text-sm"><MathText text={task.title} /></span>
                  <span className={cn("block truncate text-[10.5px] sm:text-xs", needsRevision(task, todayMs) ? "text-amber-700" : "text-slate-500")}>{lastRevisedLabel(task.lastRevisedAt, todayMs).replace("last: ", "")}</span>
                </span>
              </Link>
            </li>)}
          </ul> : <p className="mt-2 text-[12px] text-slate-500 sm:text-sm">শেষ করা task রিভিশনের জন্য এখানে আসবে।</p>}
          {revisionCount > 3 ? <p className="mt-auto pt-1 text-[11px] text-slate-500">মোট {revisionCount}টি বাকি</p> : null}
        </section>

        <ClockToolsCard />

        <Link href="/tasks" className={cn(card, "flex h-full flex-col p-3.5 transition active:scale-[0.98] sm:p-5")}>
          <span className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-50 sm:size-11"><ListChecks className="size-5 text-violet-600 sm:size-6" /></span>
            <span className="text-[13px] font-bold leading-tight text-slate-900 sm:text-base">কাজের হিসাব</span>
          </span>
          <span className="mt-auto grid grid-cols-3 gap-1 pt-2.5 text-center">
            {[{ label: "বাকি", value: pendingCount, tone: "text-slate-900" }, { label: "শেষ", value: finishedCount, tone: "text-emerald-700" }, { label: "রিভিশন", value: revisionCount, tone: revisionCount ? "text-amber-700" : "text-slate-900" }].map((stat) => <span key={stat.label} className="rounded-xl bg-slate-50 py-1.5">
              <span className={cn("block text-base font-bold tabular-nums leading-tight sm:text-xl", stat.tone)}>{stat.value}</span>
              <span className="block truncate text-[10px] text-slate-500 sm:text-xs">{stat.label}</span>
            </span>)}
          </span>
        </Link>
      </div>
    </div>
  );
}
