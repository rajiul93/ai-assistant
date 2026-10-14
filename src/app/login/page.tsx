import Link from "next/link";
import { BookOpenText, GraduationCap, ListChecks, Lock, MonitorPlay, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { HeroIllustration } from "@/components/dashboard/hero-illustration";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { isFirebaseClientConfigured } from "@/lib/firebase/config";

export const metadata = { title: "Sign in — Prep" };

const highlights = [
  { icon: BookOpenText, text: "BCS, প্রাইমারি, ১১–২০ গ্রেডের প্রশ্ন ব্যাংক" },
  { icon: ListChecks, text: "সময় ধরে MCQ পরীক্ষা, সাথে সাথে ফলাফল" },
  { icon: MonitorPlay, text: "সাজেশন ছাড়া মনোযোগী ভিডিও ক্লাস" },
  { icon: UsersRound, text: "বন্ধুদের সাথে গ্রুপে পড়া" },
];

/**
 * Sign in: the landing page's blue banner (on phones it sits above the card like a sheet; on wide
 * screens it fills the left half) and one Google button.
 */
export default function LoginPage() {
  const configured = isFirebaseClientConfigured();

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6fb] lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Banner */}
      <section className="relative overflow-hidden bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] px-6 pb-20 pt-[calc(1.5rem+env(safe-area-inset-top))] text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-indigo-400/30 blur-3xl" />

        <Link href="/" aria-label="Prep home" className="relative inline-flex w-fit items-center gap-1 text-[26px] font-extrabold leading-none tracking-tight">
          Prep<GraduationCap className="size-6 -translate-y-1.5" strokeWidth={2.5} />
        </Link>

        <div className="relative mt-6 lg:mt-0">
          <HeroIllustration className="pointer-events-none absolute -right-6 -top-4 w-[clamp(120px,36vw,170px)] lg:hidden" />
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium ring-1 ring-white/30"><Sparkles className="size-3.5" /> চাকরির প্রস্তুতি, এখন আরও সহজ</p>
          <h1 className="mt-4 max-w-[62%] text-[clamp(28px,8vw,52px)] font-bold leading-[1.12] tracking-tight lg:max-w-none">লক্ষ্য সরকারি চাকরি</h1>
          <p className="mt-2 max-w-[62%] text-[15px] leading-snug text-white/90 lg:max-w-md lg:text-lg">পরিকল্পিত প্রস্তুতি, নিশ্চিত অগ্রগতি — সব এক অ্যাপে।</p>

          <ul className="mt-10 hidden max-w-md space-y-3 lg:block">
            {highlights.map((item) => <li key={item.text} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20"><item.icon className="size-5" /></span>
              <span className="text-[15px] font-medium">{item.text}</span>
            </li>)}
          </ul>
        </div>

        <div className="relative hidden items-end justify-between lg:flex">
          <p className="text-sm text-white/75">© {new Date().getFullYear()} Prep</p>
          <HeroIllustration className="w-56 opacity-95" />
        </div>
      </section>

      {/* Card */}
      <main className="relative z-10 -mt-12 flex flex-1 justify-center px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] lg:mt-0 lg:items-center lg:px-12 lg:py-12">
        <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] sm:p-8 lg:shadow-[0_30px_80px_-30px_rgba(37,99,235,0.35)]">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><GraduationCap className="size-7" strokeWidth={2.2} /></span>
          <h2 className="mt-5 text-[26px] font-bold leading-tight tracking-tight text-slate-900">স্বাগতম 👋</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-slate-500">আপনার Google account দিয়ে ঢুকুন। নতুন হলে এক চাপেই account তৈরি হয়ে যাবে।</p>

          <div className="mt-7">
            <GoogleSignInButton />
          </div>
          {!configured ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable Google sign-in.</p> : null}

          <ul className="mt-7 space-y-2.5 border-t border-slate-100 pt-6 text-[13.5px] text-slate-600">
            <li className="flex items-center gap-2.5"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><ShieldCheck className="size-4" /></span> কোনো password মনে রাখতে হবে না</li>
            <li className="flex items-center gap-2.5"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Lock className="size-4" /></span> আপনার নোট আর প্রশ্ন শুধু আপনারই</li>
            <li className="flex items-center gap-2.5"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Sparkles className="size-4" /></span> বেশিরভাগ feature free, কোনো card লাগবে না</li>
          </ul>

          <p className="mt-6 text-center text-[13px] text-slate-500"><Link href="/" className="font-semibold text-blue-700 hover:underline">← Prep-এ কী কী আছে দেখুন</Link></p>
        </div>
      </main>
    </div>
  );
}
