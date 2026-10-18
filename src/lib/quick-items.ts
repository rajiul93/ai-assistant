import { Calculator, CalendarDays, type LucideIcon } from "lucide-react";
import { links, toneOf } from "@/components/nav-links";

/**
 * The floating dock's shortcuts (owner, 2026-10-18). AI chat is always first and can't be removed;
 * after it the user picks up to five tools or pages on /settings, in their own order
 * (`User.quickItems`). A tool opens its sheet; a page is opened.
 */

export type QuickItem = { id: string; label: string; icon: LucideIcon; tone: string; href?: string };

/** Shortcuts after the fixed AI chat: six rows at most. */
export const QUICK_MAX = 5;
/** What the dock showed before it could be changed (also the column's default). */
export const DEFAULT_QUICK_ITEMS = ["calendar", "calculator"];

export const QUICK_CATALOG: QuickItem[] = [
  { id: "calendar", label: "ক্যালেন্ডার", icon: CalendarDays, tone: "from-emerald-400 to-teal-600" },
  { id: "calculator", label: "ক্যালকুলেটর", icon: Calculator, tone: "from-[#3f6ef3] to-[#7f9cfa]" },
  ...links.map((link) => ({ id: link.href, label: link.label, icon: link.icon, tone: toneOf(link.href), href: link.href })),
];

/** Known ids only, each once, in the given order, at most `QUICK_MAX`. */
export function cleanQuickItems(ids: readonly string[]) {
  const known = new Set(QUICK_CATALOG.map((item) => item.id));
  return [...new Set(ids)].filter((id) => known.has(id)).slice(0, QUICK_MAX);
}

export const quickItemsFrom = (ids: readonly string[]) => cleanQuickItems(ids).map((id) => QUICK_CATALOG.find((item) => item.id === id)!);
