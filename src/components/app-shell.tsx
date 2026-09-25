"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Menu,
  NotebookPen,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";
import { StudyAssistant } from "@/components/study-assistant";
import { SessionBar } from "@/components/timer/session-bar";
import { SubjectPickerDialog } from "@/components/timer/subject-picker-dialog";
import { TimerAlarm } from "@/components/timer/timer-alarm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VoiceCommandCenter } from "@/components/voice-command-center";

const links = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  { href: "/subjects", label: "Subjects", short: "Subjects", icon: BookOpen },
  { href: "/progress", label: "Progress", short: "Progress", icon: TrendingUp },
  { href: "/plan", label: "Study Plan", short: "Plan", icon: CalendarClock },
  { href: "/notes", label: "Notes", short: "Notes", icon: NotebookPen },
  { href: "/jobs", label: "Jobs", short: "Jobs", icon: BriefcaseBusiness },
  { href: "/usage", label: "AI Usage", short: "AI Usage", icon: Gauge },
];

// Phones get the four daily pages in the tab bar; everything else lives under "More".
// The study timer lives on the Tasks page and in the session bar, so it has no page of its own.
const tabHrefs = ["/dashboard", "/tasks", "/notes", "/jobs"];
const tabs = links.filter((link) => tabHrefs.includes(link.href));
const moreLinks = links.filter((link) => !tabHrefs.includes(link.href));

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreLinks.some((link) => link.href === pathname);

  return (
    <div className="min-h-full bg-zinc-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-zinc-200 bg-white lg:flex lg:flex-col">
        <div className="px-6 py-6">
          <p className="text-lg font-semibold tracking-tight">Prep</p>
          <p className="mt-1 text-sm text-zinc-500">Job preparation</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
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
        {/* Phone header: the voice controls sit on its right (see VoiceCommandCenter). */}
        <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-end border-b border-zinc-200 bg-white/90 px-4 pb-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
          <p className="text-lg font-semibold tracking-tight">Prep</p>
        </header>
        <VoiceCommandCenter />
        <StudyAssistant />
        <TimerAlarm />
        <SubjectPickerDialog />
        <SessionBar />
        {/* Bottom padding leaves room for the tab bar and a running session bar. */}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-[calc(11rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-10 lg:pb-28">
          {children}
        </main>

        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5">
            {tabs.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95", active ? "text-zinc-950" : "text-zinc-500")}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.25]")} />
                  {link.short}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95", moreActive ? "text-zinc-950" : "text-zinc-500")}
            >
              <Menu className="size-5" />
              More
            </button>
          </div>
        </nav>

        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogContent>
            <DialogTitle className="mb-3">More</DialogTitle>
            <nav aria-label="More pages" className="grid grid-cols-3 gap-2">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-xs font-medium transition active:scale-95",
                      active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 text-zinc-700",
                    )}
                  >
                    <Icon className="size-5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4">
              <p className="truncate text-sm text-zinc-600">{userName}</p>
              <SignOutButton />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
