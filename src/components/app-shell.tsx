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
import { PageFinder } from "@/components/page-finder";
import { QuickCreate } from "@/components/quick-create";
import type { AiLock } from "@/lib/ai-limits";
import { SignOutButton } from "@/components/sign-out-button";
import { StudyAssistant } from "@/components/study-assistant";
import { SessionBar } from "@/components/timer/session-bar";
import { SubjectPickerDialog } from "@/components/timer/subject-picker-dialog";
import { TimerAlarm } from "@/components/timer/timer-alarm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Phones get the four daily pages in the tab bar, around a "+" for adding; the rest is under "More".
// The study timer lives on the Tasks page and in the session bar, so it has no page of its own.
const tabHrefs = ["/dashboard", "/tasks", "/notes", "/jobs"];
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
  superAdmin,
  pendingPayments,
}: {
  children: React.ReactNode;
  userName: string;
  userImage: string | null;
  aiLock: AiLock;
  admin: boolean;
  superAdmin: boolean;
  pendingPayments: number;
}) {
  const pathname = usePathname();
  // Voice features are admin-only; switched on here, in the browser only (never shared on the server).
  useEffect(() => { setVoiceAllowed(admin); }, [admin]);
  const adminLinks = adminLinksFor(admin, superAdmin);
  const sideLinks = [...links, ...adminLinks];
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
    <div className="min-h-full bg-[#f4f6fb]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200/80 bg-white lg:flex lg:flex-col">
        <div className="flex items-start justify-between gap-2 px-5 py-6">
          <Logo />
          <NotificationBell className="-mr-1 shrink-0" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {sideLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  active ? "bg-blue-600 font-medium text-white shadow-sm shadow-blue-600/30" : "text-slate-700 hover:bg-blue-50 hover:text-blue-700",
                )}
              >
                <Icon className="size-4" />
                {link.label}
                {badge(link.href) > 0 ? <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{badge(link.href)}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-slate-200 p-4">
          <Avatar name={userName} image={userImage} />
          <div className="min-w-0 flex-1 space-y-1">
            <Link href="/profile" className="block truncate text-sm font-medium text-slate-700 hover:text-blue-700">{userName}</Link>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        {/* Phone header, as on the home page design. Voice lives in the assistant's message box. */}
        <header className="sticky top-0 z-30 flex items-center gap-2 bg-[#f4f6fb]/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
          <div className="min-w-0 flex-1"><Logo /></div>
          <PageFinder admin={admin} superAdmin={superAdmin} />
          <NotificationBell className="size-10 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200" />
          <Avatar name={userName} image={userImage} />
        </header>
        <StudyAssistant aiLock={aiLock} />
        <TimerAlarm />
        <SubjectPickerDialog />
        <SessionBar />
        {/* Bottom padding leaves room for the tab bar and a running session bar. */}
        <main className="mx-auto w-full max-w-6xl px-4 pt-2 sm:pt-4 pb-[calc(11rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-10 lg:pb-28">
          {children}
        </main>

        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-6 items-center">
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
          <DialogContent>
            <DialogTitle className="mb-3">More</DialogTitle>
            <nav aria-label="More pages" className="grid grid-cols-3 gap-2">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-xs font-medium transition active:scale-95",
                      active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-700",
                    )}
                  >
                    <span className="relative">
                      <Icon className="size-5" />
                      {badge(link.href) > 0 ? <span className="absolute -right-2.5 -top-1.5 rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{badge(link.href)}</span> : null}
                    </span>
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <Link href="/profile" onClick={() => setMoreOpen(false)} className="truncate text-sm text-slate-600 hover:text-blue-700">{userName}</Link>
              <SignOutButton />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
