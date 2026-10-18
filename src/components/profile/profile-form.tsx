"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronRight, Crown, Gauge, Loader2, Lock, Mail, Phone, Share2, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { initialOf } from "@/lib/collaboration";
import { formatDate } from "@/lib/dayjs";
import { formatBdPhone, normalizeBdPhone } from "@/lib/phone";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { updateProfile } from "@/server/actions/profile";

type Profile = { name: string | null; phone: string | null; email: string; image: string | null; createdAt: Date };
type Plan = { active: boolean; hadPlan: boolean; daysLeft: number; endsAt: Date | null };

const card = "rounded-3xl bg-white p-4 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";

/** One field: an icon in a soft square, the label, the input, and a hint (or the error) under it. */
function Field({ icon: Icon, tone, label, htmlFor, hint, error, children }: { icon: LucideIcon; tone: string; label: string; htmlFor: string; hint: string; error?: string | null; children: React.ReactNode }) {
  return <div className="flex gap-3">
    <span className={cn("mt-6 flex size-10 shrink-0 items-center justify-center rounded-2xl", tone)}><Icon className="size-5" /></span>
    <div className="min-w-0 flex-1 space-y-1">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-slate-700">{label}</label>
      {children}
      <p className={cn("text-xs", error ? "text-rose-600" : "text-slate-500")}>{error ?? hint}</p>
    </div>
  </div>;
}

/** A row to another account page. */
function AccountLink({ href, icon: Icon, tone, title, detail }: { href: string; icon: LucideIcon; tone: string; title: string; detail: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-slate-50">
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-[0_6px_14px_-8px_rgba(15,23,42,0.6)]", tone)}><Icon className="size-5" /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-slate-900">{title}</span>
      <span className="block truncate text-xs text-slate-500">{detail}</span>
    </span>
    <ChevronRight className="size-4 shrink-0 text-slate-400" />
  </Link>;
}

const input = "h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:text-slate-500";

/**
 * /profile: who you are at a glance (photo, name, plan, member since), the other account pages,
 * and the name friends and groups see and the private phone number.
 */
export function ProfileForm({ initial, plan, staff }: { initial: Profile; plan: Plan; staff: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [phone, setPhone] = useState(initial.phone ? formatBdPhone(initial.phone) : "");
  const [pending, startTransition] = useTransition();
  const phoneInvalid = phone.trim() !== "" && !normalizeBdPhone(phone);
  const changed = name.trim() !== (initial.name ?? "").trim() || (normalizeBdPhone(phone) ?? "") !== (initial.phone ?? "");

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const saved = await updateProfile({ name, phone });
        setName(saved.name);
        setPhone(saved.phone ? formatBdPhone(saved.phone) : "");
        toast.success("প্রোফাইল সেভ হলো");
        router.refresh();
      } catch (error) {
        toast.error(errorMessage(error, "সেভ করা গেল না।"));
      }
    });
  }

  const shownName = name.trim() || initial.email;
  const planChip = staff
    ? { label: "Staff · সব খোলা", tone: "bg-white/25 text-white ring-white/40", icon: ShieldCheck }
    : plan.active
      ? { label: `Plan চালু · আর ${plan.daysLeft} দিন`, tone: "bg-emerald-400/30 text-white ring-emerald-200/60", icon: Crown }
      : { label: plan.hadPlan ? "Plan-এর মেয়াদ শেষ" : "Free", tone: "bg-white/20 text-white ring-white/30", icon: UserRound };
  const ChipIcon = planChip.icon;

  return <div className="space-y-4">
    {/* Who you are, at a glance. */}
    <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#6a5af9] to-[#a77bf3] p-5 text-white shadow-[0_14px_32px_-18px_rgba(79,70,229,0.7)]">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 right-16 size-32 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-4">
        {initial.image
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar, any host
          ? <img src={initial.image} alt="" className="size-20 shrink-0 rounded-full object-cover ring-4 ring-white/40" referrerPolicy="no-referrer" />
          : <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-white/25 text-3xl font-bold ring-4 ring-white/40">{initialOf(shownName)}</span>}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{shownName}</h1>
          <p className="truncate text-[13px] text-white/85">{initial.email}</p>
          <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", planChip.tone)}><ChipIcon className="size-3.5" />{planChip.label}</span>
        </div>
      </div>
      <p className="relative mt-4 flex items-center gap-1.5 text-xs text-white/80"><CalendarDays className="size-3.5" /> Prep-এ আছ {formatDate(initial.createdAt)} থেকে</p>
    </section>

    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <section className={cn(card, "h-fit space-y-1")}>
        <h2 className="px-2 pb-1 text-base font-bold text-slate-900">অ্যাকাউন্ট</h2>
        <AccountLink href="/billing" icon={Crown} tone="from-yellow-400 to-amber-500" title="আমার প্ল্যান" detail={plan.active && plan.endsAt ? `চলবে ${formatDate(plan.endsAt)} পর্যন্ত` : "Plan দেখো ও নাও"} />
        <AccountLink href="/usage" icon={Gauge} tone="from-orange-400 to-amber-600" title="AI ব্যবহার" detail="আজ আর মোট কতটা খরচ হলো" />
        <AccountLink href="/affiliate" icon={Share2} tone="from-emerald-400 to-teal-600" title="রেফার করে আয়" detail="বন্ধুদের link দাও, তারা plan কিনলে তুমি পাবে" />
      </section>

      <form onSubmit={save} className={cn(card, "space-y-5")}>
        <h2 className="text-base font-bold text-slate-900">তোমার তথ্য</h2>
        <Field icon={UserRound} tone="bg-blue-50 text-blue-600" label="নাম" htmlFor="profile-name" hint="Friend-রা আর গ্রুপের সদস্যরা এই নাম দেখবে।">
          <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required autoComplete="name" className={input} />
        </Field>
        <Field icon={Phone} tone="bg-emerald-50 text-emerald-600" label="মোবাইল নম্বর" htmlFor="profile-phone" hint="শুধু তুমি আর admin দেখতে পাবে — অন্য কেউ না।" error={phoneInvalid ? "সঠিক বাংলাদেশি মোবাইল নম্বর দাও (01 দিয়ে শুরু, ১১ সংখ্যা)।" : null}>
          <input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01712345678" aria-invalid={phoneInvalid} className={cn(input, phoneInvalid && "border-rose-400 focus:border-rose-500 focus:ring-rose-50")} />
        </Field>
        <Field icon={Mail} tone="bg-violet-50 text-violet-600" label="ইমেইল" htmlFor="profile-email" hint="Google account-এর ইমেইল — এখান থেকে বদলানো যায় না।">
          <div className="relative">
            <input id="profile-email" value={initial.email} readOnly disabled className={cn(input, "pr-10")} />
            <Lock className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </Field>
        <button type="submit" disabled={pending || phoneInvalid || name.trim().length < 2 || !changed}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-slate-950 text-[15px] font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:px-8">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {pending ? "সেভ হচ্ছে…" : changed ? "সেভ করো" : "সব সেভ করা আছে"}
        </button>
      </form>
    </div>
  </div>;
}
