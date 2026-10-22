"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { setVoiceAllowed } from "@/lib/voice-access";
import { useLive } from "@/components/collaboration/live-provider";
import { NotificationBell } from "@/components/collaboration/notification-bell";
import { adminLinksFor, billingAdminLink, links } from "@/components/nav-links";
import type { StaffPermission } from "@/lib/staff";
import { QuickCreate } from "@/components/quick-create";
import type { AiLock } from "@/lib/ai-limits";
import { SignOutButton } from "@/components/sign-out-button";
import { StudyAssistant } from "@/components/study-assistant";
import { Calculator } from "@/components/calculator";
import { CalendarSheet } from "@/components/calendar-sheet";
import { LcmHcfSheet } from "@/components/lcm-hcf-sheet";
import { ScratchPadSheet } from "@/components/scratch-pad-sheet";
import { ToolDock } from "@/components/tool-dock";
import { SessionBar } from "@/components/timer/session-bar";
import { SubjectPickerDialog } from "@/components/timer/subject-picker-dialog";
import { TimerAlarm } from "@/components/timer/timer-alarm";
import { TimerSync } from "@/components/timer/timer-sync";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MoreSheet } from "@/components/more-sheet";
import { JobsReminder } from "@/components/jobs/jobs-reminder";
import { SideNav } from "@/components/side-nav";

// Phones get five items in the tab bar — Home, Tasks, "+", Notes, More (owner, 2026-10-18: Jobs moved
// under More); the rest is under "More". The study timer lives on the Tasks page and in the session
// bar, so it has no page of its own.
const tabHrefs = ["/dashboard", "/tasks", "/notes"];
const tabs = tabHrefs.map((href) => links.find((link) => link.href === href)!);
const baseMoreLinks = links.filter((link) => !tabHrefs.includes(link.href));

/** "Prep" with its cap, as on the home page design. */
function Logo() {
  return <Link href="/dashboard" className="block min-w-0">
    <span className="flex items-center gap-1 text-[clamp(22px,6.4vw,28px)] font-extrabold leading-none tracking-tight text-slate-950">Prep<GraduationCap className="size-[clamp(18px,5vw,24px)] -translate-y-1.5 text-blue-600" strokeWidth={2.5} /></span>
    <span className="mt-1 block text-[clamp(11.5px,3.3vw,14px)] leading-snug text-slate-500 lg:text-xs">চাকরির প্রস্তুতি, এখন আরও সহজ</span>
  </Link>;
}

/** The user's Google photo, or their initial; opens the profile. */
function Avatar({ name, image }: { name: string; image: string | null }) {
  return <Link href="/profile" aria-label="প্রোফাইল" className="block size-10 shrink-0 overflow-hidden rounded-full bg-blue-100 ring-2 ring-white">
    {image
      // eslint-disable-next-line @next/next/no-img-element -- Google avatar, any host
      ? <img src={image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      : <span className="flex size-full items-center justify-center text-sm font-bold text-blue-700">{(name.trim()[0] ?? "?").toUpperCase()}</span>}
  </Link>;
}

export function AppShell({
  children,
  userName,
  userImage,
  aiLock,
  admin,
  permissions,
  pendingPayments,
  quickItems,
}: {
  children: React.ReactNode;
  userName: string;
  userImage: string | null;
  aiLock: AiLock;
  admin: boolean;
  /** Staff permissions: which admin pages show in the menu. */
  permissions: StaffPermission[];
  pendingPayments: number;
  /** The dock's shortcuts after AI chat (src/lib/quick-items.ts). */
  quickItems: string[];
}) {
  const pathname = usePathname();
  // Voice features are admin-only; switched on here, in the browser only (never shared on the server).
  useEffect(() => { setVoiceAllowed(admin); }, [admin]);
  const adminLinks = adminLinksFor(permissions);
  const moreLinks = [...baseMoreLinks, ...adminLinks];
  const { counts } = useLive();
  const badge = (href: string) => (href === billingAdminLink.href ? pendingPayments : href === "/messages" ? counts.messagesUnread : 0);
  const [moreOpen, setMoreOpen] = useState(false);
  // A page's own sub-pages (e.g. /preliminary/new) keep its link highlighted.
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = moreLinks.some((link) => isActive(link.href));
  const tabClass = (active: boolean) => cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-95", active ? "text-blue-600" : "text-slate-500");

  const tab = (link: (typeof tabs)[number]) => {
    const Icon = link.icon;
    const active = isActive(link.href);
    return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      <Icon className={cn("size-6", active && "stroke-[2.25]")} />
      {link.short}
    </Link>;
  };

  return (
    <div className="min-h-full bg-[#f3f3ef]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200/70 bg-white lg:flex lg:flex-col">
        <div className="flex items-start justify-between gap-2 px-5 pb-4 pt-6">
          <Logo />
          <NotificationBell className="-mr-1 shrink-0" />
        </div>
        <SideNav links={links} adminLinks={adminLinks} isActive={isActive} badge={badge} />
        {/* Who is signed in, on the home page's blue. */}
        <div className="p-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-2.5 text-white shadow-[0_10px_24px_-14px_rgba(37,99,235,0.9)]">
            <Avatar name={userName} image={userImage} />
            <Link href="/profile" className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{userName}</span>
              <span className="block text-[11px] text-white/80">প্রোফাইল</span>
            </Link>
            <SignOutButton compact />
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Phone header, as on the home page design. Voice lives in the assistant's message box. */}
        <header className="sticky top-0 z-30 flex items-center gap-2 bg-[#f3f3ef]/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
          <div className="min-w-0 flex-1"><Logo /></div>
          {/* A running study session: its time, tap for the controls. */}
          <SessionBar variant="chip" />
          <NotificationBell className="size-10 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200" />
          <Avatar name={userName} image={userImage} />
        </header>
        <StudyAssistant aiLock={aiLock} />
        {/* One tools button (calendar, calculator) above the assistant's; the sheets open from it. */}
        <ToolDock quickItems={quickItems} />
        <Calculator />
        <CalendarSheet />
        <LcmHcfSheet />
        <ScratchPadSheet />
        <TimerAlarm />
        {/* One timer across the user's devices (see TimerSync). */}
        <TimerSync />
        <SubjectPickerDialog />
        {/* Once a day: check the job applications' links. */}
        <JobsReminder />
        {/* Desktop only; phones have the chip in the top bar. */}
        <div className="hidden lg:block"><SessionBar /></div>
        {/* Bottom padding leaves room for the tab bar and a running session bar. */}
        {/* Every page sits in Tailwind's container: as wide as the screen's breakpoint allows (up to
            1536px), centred (owner, 2026-10-16). */}
        <main className="container mx-auto w-full px-4 pt-2 sm:pt-4 pb-[calc(11rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-10 lg:pb-28">
          {children}
        </main>

        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5 items-center">
            {tabs.slice(0, 2).map(tab)}
            <QuickCreate />
            {tabs.slice(2).map(tab)}
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={tabClass(moreActive)}>
              <span className="relative">
                <Menu className="size-6" />
                {/* Unread chats live under "More" on phones. */}
                {counts.messagesUnread ? <span className="absolute -right-1.5 -top-1 size-2.5 rounded-full bg-rose-500 ring-2 ring-white" /> : null}
              </span>
              More
            </button>
          </div>
        </nav>

        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogContent className="bg-[#f3f3ef] p-0 pt-0 pb-0 sm:max-w-md sm:rounded-3xl sm:pb-0 sm:pt-0">
            <MoreSheet links={baseMoreLinks} adminLinks={adminLinks} userName={userName} userImage={userImage} isActive={isActive} badge={badge} onClose={() => setMoreOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
