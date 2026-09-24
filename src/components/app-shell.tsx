"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  NotebookPen,
  CalendarClock,
  LayoutDashboard,
  ListTodo,
  RefreshCcw,
  Timer,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";
import { StudyAssistant } from "@/components/study-assistant";
import { SubjectPickerDialog } from "@/components/timer/subject-picker-dialog";
import { TimerAlarm } from "@/components/timer/timer-alarm";
import { VoiceCommandCenter } from "@/components/voice-command-center";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/revisions", label: "Revision", icon: RefreshCcw },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/plan", label: "Study Plan", icon: CalendarClock },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
];

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-zinc-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-zinc-200 bg-white lg:flex lg:flex-col">
        <div className="px-6 py-6">
          <p className="text-lg font-semibold tracking-tight">Prep</p>
          <p className="mt-1 text-sm text-zinc-500">Job preparation</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  active ? "bg-zinc-950 text-white" : "text-zinc-700 hover:bg-zinc-100",
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-4">
          <p className="mb-3 truncate text-sm text-zinc-600">{userName}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
          <p className="font-semibold">Prep</p>
          <SignOutButton />
        </header>
        <VoiceCommandCenter />
        <StudyAssistant />
        <TimerAlarm />
        <SubjectPickerDialog />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 lg:px-8 lg:py-10 lg:pb-10">
          {children}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 overflow-x-auto border-t border-zinc-200 bg-white lg:hidden">
          <div className="flex min-w-max">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex min-w-20 flex-col items-center gap-1 px-3 py-3 text-[11px]",
                    active ? "text-zinc-950" : "text-zinc-500",
                  )}
                >
                  <Icon className="size-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
