import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { BANK_EXAMS } from "@/lib/question-bank";

/**
 * The Question Bank is nested pages of card grids: exams → sections → sets → one set. Sections are
 * free text from the sheet, so they travel in the URL encoded.
 */

export const examBySlug = (slug: string) => BANK_EXAMS.find((exam) => exam.slug === slug);
export const sectionHref = (examSlug: string, section: string) => `/question-bank/${examSlug}/${encodeURIComponent(section)}`;

/** A route param back to the section text (Next may hand it over still encoded). */
export function sectionFromParam(param: string) {
  try { return decodeURIComponent(param); } catch { return param; }
}

/** "প্রশ্ন ব্যাংক › ১১–২০ গ্রেড › বিগত সালের প্রশ্ন": every level but the last is a link back. */
export function BankBreadcrumb({ trail }: { trail: Array<{ label: string; href?: string }> }) {
  return <nav aria-label="প্রশ্ন ব্যাংকে কোথায় আছেন" className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
    {trail.map((item, index) => <span key={index} className="flex min-w-0 items-center gap-1">
      {index ? <ChevronRight className="size-3.5 shrink-0 text-zinc-300" /> : null}
      {item.href ? <Link href={item.href} className="truncate hover:text-zinc-900">{item.label}</Link> : <span className="truncate font-medium text-zinc-800">{item.label}</span>}
    </span>)}
  </nav>;
}

/** One card of a grid level: an icon, the name, and what's inside. */
export function BankTile({ href, icon: Icon, title, detail, tone = "bg-indigo-50 text-indigo-700" }: { href: string; icon: LucideIcon; title: string; detail: string; tone?: string }) {
  return <Link href={href} className="group flex min-h-36 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm">
    <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
    <span className="mt-4 block">
      <span className="block text-base font-semibold leading-snug group-hover:underline group-hover:underline-offset-2">{title}</span>
      <span className="mt-0.5 block text-xs text-zinc-500">{detail}</span>
    </span>
  </Link>;
}

export const tileGrid = "grid grid-cols-2 gap-3 sm:grid-cols-3";
