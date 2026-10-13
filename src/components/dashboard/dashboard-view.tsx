import Link from "next/link";
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck,
  ChartColumnIncreasing,
  ChevronRight,
  CircleHelp,
  FileText,
  Keyboard,
  Languages,
  ListChecks,
  ListTodo,
  NotebookPen,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { ClockTools } from "@/components/dashboard/clock-tools";
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

/** The home page's shortcuts, in the design's pastel tiles. Only pages that exist. */
const quickAccess: Array<{ href: string; label: string; icon: LucideIcon; tone: string }> = [
  { href: "/question-bank", label: "প্রশ্ন ব্যাংক", icon: BookOpenText, tone: "bg-blue-50 text-blue-600" },
  { href: "/preliminary", label: "প্রিলিমিনারি", icon: ListChecks, tone: "bg-rose-50 text-rose-500" },
  { href: "/confusions", label: "কনফিউশন", icon: CircleHelp, tone: "bg-emerald-50 text-emerald-600" },
  { href: "/notes", label: "নোটস", icon: NotebookPen, tone: "bg-orange-50 text-orange-500" },
  { href: "/plan", label: "স্টাডি প্ল্যান", icon: CalendarCheck, tone: "bg-violet-50 text-violet-600" },
  { href: "/jobs", label: "চাকরি", icon: BriefcaseBusiness, tone: "bg-pink-50 text-pink-500" },
  { href: "/progress", label: "প্রগতি", icon: ChartColumnIncreasing, tone: "bg-indigo-50 text-indigo-600" },
  { href: "/short-questions", label: "শর্ট প্রশ্ন", icon: FileText, tone: "bg-sky-50 text-sky-600" },
  { href: "/vocabulary", label: "Vocabulary", icon: Languages, tone: "bg-teal-50 text-teal-600" },
  { href: "/typing", label: "Typing Lab", icon: Keyboard, tone: "bg-amber-50 text-amber-600" },
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
        <nav aria-label="Quick access" className="grid grid-cols-5 gap-[clamp(6px,2vw,16px)]">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={cn(card, "flex flex-col items-center gap-[clamp(6px,1.8vw,12px)] px-0.5 py-[clamp(10px,3vw,20px)] text-center transition hover:-translate-y-0.5 active:scale-95")}>
              <span className={cn("flex size-[clamp(42px,11.6vw,64px)] items-center justify-center rounded-[clamp(12px,3.4vw,20px)]", item.tone)}><Icon className="size-[clamp(21px,5.8vw,30px)]" strokeWidth={2} /></span>
              <span className="whitespace-nowrap text-[clamp(10.5px,2.95vw,15px)] font-medium leading-tight tracking-tight text-slate-700">{item.label}</span>
            </Link>;
          })}
        </nav>
      </section>

      <DailyChallengeCard dailyTargetMinutes={dailyTargetMinutes} savedSeconds={studiedSeconds} streak={streak} />

      {/* Today's tasks and what to revise, side by side. */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
        <section className="flex flex-col rounded-3xl bg-linear-to-br from-orange-50 to-amber-50/60 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[clamp(15px,4.3vw,20px)] font-bold text-slate-900"><ListTodo className="size-5 text-orange-500" /> আজকের কাজ</h2>
            <Link href="/tasks" className="flex items-center text-sm text-slate-500 hover:text-blue-700">সব <ChevronRight className="size-4" /></Link>
          </div>
          {todayTasks.length ? <ul className="mt-3 space-y-2">
            {todayTasks.slice(0, 4).map((task) => <li key={task.id}>
              <Link href="/tasks" className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5 transition hover:bg-white">
                <span className={cn("size-2.5 shrink-0 rounded-full", task.status === "FINISHED" ? "bg-emerald-500" : task.priority === "HIGH" ? "bg-red-500" : task.priority === "MEDIUM" ? "bg-amber-400" : "bg-slate-300")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-medium", task.status === "FINISHED" && "text-slate-400 line-through")}><MathText text={task.title} /></span>
                  <span className="block truncate text-xs text-slate-500">{task.subject?.name ?? "No subject"} · {task.estimatedMinutes}m</span>
                </span>
              </Link>
            </li>)}
          </ul> : <p className="mt-3 text-sm text-slate-600">আজকের জন্য কোনো কাজ নেই।</p>}
          <Link href="/tasks?add=1" className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50">নতুন task <ChevronRight className="size-4" /></Link>
        </section>

        <section className={cn(card, "p-4 sm:p-5")}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[clamp(15px,4.3vw,20px)] font-bold text-slate-900"><RotateCcw className="size-5 text-blue-600" /> রিভিশন বাকি</h2>
            <Link href="/tasks?view=revisions" className="flex items-center text-sm text-slate-500 hover:text-blue-700">সব <ChevronRight className="size-4" /></Link>
          </div>
          {toRevise.length ? <ul className="mt-2 divide-y divide-slate-100">
            {toRevise.map((task, index) => <li key={task.id}>
              <Link href="/tasks?view=revisions" className="flex items-center gap-3 py-2.5">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", index === 0 ? "bg-amber-100 text-amber-700" : index === 1 ? "bg-slate-100 text-slate-600" : "bg-orange-100 text-orange-700")}>{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium"><MathText text={task.title} /></span>
                  <span className="block text-xs text-slate-500">{task.subject?.name ?? "No subject"}</span>
                </span>
                <span className={needsRevision(task, todayMs) ? "shrink-0 text-xs font-medium text-amber-700" : "shrink-0 text-xs text-slate-500"}>
                  {task.timesRevised}× · {lastRevisedLabel(task.lastRevisedAt, todayMs).replace("last: ", "")}
                </span>
              </Link>
            </li>)}
          </ul> : <p className="mt-3 text-sm text-slate-500">শেষ করা task এখানে রিভিশনের জন্য আসবে।</p>}
        </section>
      </div>

      {/* Overall progress and the clock tools. */}
      <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Link href="/progress" className={cn(card, "block p-4 transition active:scale-[0.99] sm:p-5")}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">সার্বিক প্রস্তুতি</p>
            <p className="text-lg font-bold tabular-nums text-blue-700">{progressPercent}%</p>
          </div>
          <Progress className="mt-2.5 bg-slate-100" barClassName="bg-blue-600" value={progressPercent} />
          <p className={cn("mt-3 text-xs", prep?.overdue ? "font-medium text-red-600" : "text-slate-500")}>
            🔥 প্রস্তুতির সময়: {prep?.label ?? "Study Plan-এ deadline দিন"}
          </p>
        </Link>
        <ClockTools />
      </div>
    </div>
  );
}
