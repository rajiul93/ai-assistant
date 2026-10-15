"use client";

import Link from "next/link";
import { ACCOUNT_LINKS, NAV_GROUPS, toneOf, type NavLink } from "@/components/nav-links";
import { cn } from "@/lib/utils";

const MAIN = ["/dashboard", "/tasks", "/notes", "/jobs"];

/**
 * The desktop sidebar's page list: the same groups and colours as the phone "More" sheet, with
 * the daily pages first ("মূল"), then account and admin. A page added later lands in "আরো".
 */
export function SideNav({ links, adminLinks, isActive, badge }: { links: NavLink[]; adminLinks: NavLink[]; isActive: (href: string) => boolean; badge: (href: string) => number }) {
  const find = (href: string) => links.find((link) => link.href === href);
  const listed = new Set([...MAIN, ...NAV_GROUPS.flatMap((group) => group.hrefs), ...ACCOUNT_LINKS.map((item) => item.href), "/profile"]);
  const others = links.filter((link) => !listed.has(link.href));
  const sections = [
    { title: "মূল", items: MAIN.map(find) },
    ...NAV_GROUPS.map((group) => ({ title: group.title, items: [...group.hrefs.map(find), ...(group.title === "আরো" ? others : [])] })),
    { title: "অ্যাকাউন্ট", items: [...ACCOUNT_LINKS.map((item) => find(item.href)), find("/profile")] },
    { title: "Admin", items: adminLinks },
  ]
    .map((section) => ({ ...section, items: section.items.filter((link): link is NavLink => Boolean(link)) }))
    .filter((section) => section.items.length);

  return <nav aria-label="Pages" className="flex-1 space-y-3.5 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
    {sections.map((section) => <div key={section.title}>
      <h3 className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{section.title}</h3>
      <ul className="space-y-0.5">
        {section.items.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          const count = badge(link.href);
          return <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-9 items-center gap-3 rounded-xl px-2.5 text-[14px] transition",
                active ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {/* The current page gets a blue bar on the left edge. */}
              {active ? <span aria-hidden className="absolute -left-3 top-1.5 h-6 w-1 rounded-r-full bg-blue-600" /> : null}
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-[0_4px_10px_-6px_rgba(15,23,42,0.7)] transition group-hover:scale-105", toneOf(link.href))}>
                <Icon className="size-4" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
              {count > 0 ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{count}</span> : null}
            </Link>
          </li>;
        })}
      </ul>
    </div>)}
  </nav>;
}
