import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * The Question Bank is nested pages of card grids (docs/question-bank-v2-plan.md):
 * General → subjects → chapters → one chapter, and বিগত বছরের প্রশ্ন → categories → years/sets → one set.
 */

export const BANK_HOME = { label: "প্রশ্ন ব্যাংক", href: "/question-bank" };
export const GENERAL = { label: "General", href: "/question-bank/general" };
export const PREVIOUS = { label: "বিগত বছরের প্রশ্ন", href: "/question-bank/previous" };

/** "প্রশ্ন ব্যাংক › ১১–২০ গ্রেড › বিগত সালের প্রশ্ন": every level but the last is a link back. */
export function BankBreadcrumb({ trail }: { trail: Array<{ label: string; href?: string }> }) {
  return <nav aria-label="প্রশ্ন ব্যাংকে কোথায় আছেন" className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
    {trail.map((item, index) => <span key={index} className="flex min-w-0 items-center gap-1">
      {index ? <ChevronRight className="size-3.5 shrink-0 text-zinc-300" /> : null}
      {item.href ? <Link href={item.href} className="truncate hover:text-zinc-900">{item.label}</Link> : <span className="truncate font-medium text-zinc-800">{item.label}</span>}
    </span>)}
  </nav>;
}

/** One card of a grid level: an icon, the name, and what's inside; staff controls sit top-right. */
export function BankTile({ href, icon: Icon, title, detail, tone = "bg-indigo-50 text-indigo-700", actions }: { href: string; icon: LucideIcon; title: string; detail: string; tone?: string; actions?: ReactNode }) {
  return <div className="relative">
    <Link href={href} className="group flex h-full min-h-36 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm">
      <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></span>
      <span className="mt-4 block">
        <span className="block text-base font-semibold leading-snug group-hover:underline group-hover:underline-offset-2">{title}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{detail}</span>
      </span>
    </Link>
    {actions ? <div className="absolute right-2 top-2 flex gap-0.5">{actions}</div> : null}
  </div>;
}

/** An empty level, with what to do about it. */
export function BankEmpty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">
    <Icon className="mx-auto mb-2 size-8 text-zinc-300" />{text}
  </div>;
}

export const tileGrid = "grid grid-cols-2 gap-3 sm:grid-cols-3";
