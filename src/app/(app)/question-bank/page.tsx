import Link from "next/link";
import { ArrowRight, BookOpenText, History, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { bankHome } from "@/server/actions/question-bank";

export const metadata = { title: "প্রশ্ন ব্যাংক — Prep" };

function HalfCard({ href, icon: Icon, title, text, detail, tone }: { href: string; icon: LucideIcon; title: string; text: string; detail: string; tone: string }) {
  return <Link href={href} className={`group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-3xl p-5 ring-1 transition hover:shadow-md ${tone}`}>
    <span className="flex size-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm"><Icon className="size-6" /></span>
    <span className="mt-6 block">
      <span className="flex items-center gap-2 text-xl font-semibold tracking-tight">{title}<ArrowRight className="size-5 transition group-hover:translate-x-1" /></span>
      <span className="mt-1 block text-sm opacity-80">{text}</span>
      <span className="mt-3 inline-block rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium">{detail}</span>
    </span>
  </Link>;
}

/** Level 1 (docs/question-bank-v2-plan.md): the two halves. */
export default async function QuestionBankPage() {
  await requireUser();
  const { general, previous } = await bankHome();
  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">প্রশ্ন ব্যাংক</h1>
      <p className="mt-1 text-sm text-zinc-500">বিষয় ধরে পড়া, আর বিগত বছরের প্রশ্ন — যা লাগে, নিজের Preliminary / Short Question-এ পাঠাও।</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <HalfCard href="/question-bank/general" icon={BookOpenText} title="General" text="Subject › Chapter › Article, MCQ, Short Question"
        detail={`${general.subjects}টি subject · ${general.chapters}টি chapter`} tone="bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-950 ring-indigo-200" />
      <HalfCard href="/question-bank/previous" icon={History} title="বিগত বছরের প্রশ্ন" text="BCS, প্রাইমারি, ১১–২০ গ্রেড আর অন্যান্য — সাল ধরে"
        detail={`${previous.categories}টি পরীক্ষা · ${previous.sets}টি set`} tone="bg-gradient-to-br from-amber-50 to-orange-100 text-amber-950 ring-amber-200" />
    </div>
  </div>;
}
