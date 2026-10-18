"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ACCOUNT_LINKS as ACCOUNT, NAV_GROUPS as GROUPS, toneOf, type NavLink } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Tile({ link, active, badge, onClose }: { link: NavLink; active: boolean; badge: number; onClose: () => void }) {
  const Icon = link.icon;
  return <Link
    href={link.href}
    onClick={onClose}
    aria-current={active ? "page" : undefined}
    className={cn("group flex w-1/4 min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 transition active:scale-95", active ? "bg-white shadow-[0_6px_18px_-10px_rgba(37,99,235,0.6)] ring-2 ring-blue-500" : "hover:bg-white/70")}
  >
    <span className={cn("relative flex size-11 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-[0_8px_16px_-10px_rgba(15,23,42,0.6)]", toneOf(link.href))}>
      <Icon className="size-5" strokeWidth={2.1} />
      {badge > 0 ? <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{badge}</span> : null}
    </span>
    <span className={cn("w-full text-center text-[11.5px] font-semibold leading-tight [overflow-wrap:anywhere]", active ? "text-blue-700" : "text-slate-700")}>{link.short}</span>
  </Link>;
}

/**
 * The phone "More" sheet: a profile card, then every other page in coloured groups (study,
 * practice, chat and plans, and the admin pages this user may open).
 */
export function MoreSheet({ links, adminLinks, userName, userImage, isActive, badge, onClose }: {
  links: NavLink[];
  adminLinks: NavLink[];
  userName: string;
  userImage: string | null;
  isActive: (href: string) => boolean;
  badge: (href: string) => number;
  onClose: () => void;
}) {
  const grouped = new Set(GROUPS.flatMap((group) => group.hrefs));
  const skip = new Set(["/profile", ...ACCOUNT.map((item) => item.href)]);
  // "রেফার করে আয়" is a tile under "আরো" here (owner, 2026-10-18), not a button on the profile card.
  const accountButtons = ACCOUNT.filter((item) => item.href !== "/affiliate");
  const refer = links.filter((link) => link.href === "/affiliate");
  // A page added later shows up under "আরো" until it is given a group.
  const others = links.filter((link) => !grouped.has(link.href) && !skip.has(link.href));
  const sections = [
    ...GROUPS.map((group) => ({ title: group.title, items: [...group.hrefs.map((href) => links.find((link) => link.href === href)).filter((link): link is NavLink => Boolean(link)), ...(group.title === "আরো" ? [...refer, ...others] : [])] })),
    { title: "Admin", items: adminLinks },
  ].filter((section) => section.items.length);

  return <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-12 sm:pb-5">
    <DialogTitle className="sr-only">More</DialogTitle>

    {/* Who is signed in, and the way to their profile. */}
    <div className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-3.5 text-white shadow-[0_14px_30px_-16px_rgba(37,99,235,0.9)]">
    <Link href="/profile" onClick={onClose} className="flex items-center gap-3 active:scale-[0.99]">
      <span className="size-12 shrink-0 overflow-hidden rounded-2xl bg-white/25 ring-2 ring-white/70">
        {userImage
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar, any host
          ? <img src={userImage} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          : <span className="flex size-full items-center justify-center text-lg font-bold">{(userName.trim()[0] ?? "?").toUpperCase()}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">{userName}</span>
        <span className="block text-[12px] text-white/85">প্রোফাইল দেখো</span>
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20"><ChevronRight className="size-5" /></span>
    </Link>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {accountButtons.map((item) => <Link key={item.href} href={item.href} onClick={onClose} aria-current={isActive(item.href) ? "page" : undefined} className={cn("flex h-9 items-center justify-center rounded-xl text-[13px] font-semibold ring-1 transition active:scale-95", isActive(item.href) ? "bg-white text-blue-700 ring-white" : "bg-white/15 text-white ring-white/30 hover:bg-white/25")}>{item.label}</Link>)}
    </div>
    </div>

    <div className="mt-3 space-y-2.5">
      {sections.map((section) => <section key={section.title} className="rounded-3xl bg-white/60 p-2 ring-1 ring-white">
        <h3 className="px-2 pt-1 text-[12px] font-bold uppercase tracking-wide text-slate-500">{section.title}</h3>
        {/* Four to a row; a shorter last row sits in the middle instead of hanging on the left. */}
        <nav aria-label={section.title} className="flex flex-wrap justify-center">
          {section.items.map((link) => <Tile key={link.href} link={link} active={isActive(link.href)} badge={badge(link.href)} onClose={onClose} />)}
        </nav>
      </section>)}
    </div>

    <div className="mt-3 flex justify-center"><SignOutButton /></div>
  </div>;
}
