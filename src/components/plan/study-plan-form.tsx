"use client";

import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, Hourglass, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStudyPlan } from "@/server/actions/plan";
import { studyPlanSchema, type StudyPlanInput } from "@/lib/validations";
import { birthdayAtAge, dayjs, diffParts, formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";

const HOUR_PRESETS = [2, 3, 4, 6];

/** "4 বছর 2 মাস", "35 দিন" — whole units only, for the summary. */
function timeLeft(to: Date | null, nowMs: number) {
  if (!to) return null;
  const parts = diffParts(nowMs, to);
  if (parts.expired) return "পেরিয়ে গেছে";
  if (parts.years) return `${(parts.years + parts.months / 12).toFixed(1).replace(/\.0$/, "")} বছর`;
  if (parts.months) return `${parts.months} মাস ${parts.days} দিন`;
  return `${parts.days} দিন`;
}

/** One number in the "at a glance" strip. */
function Glance({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0 px-2 text-center first:pl-0 last:pr-0">
    <p className={cn("truncate text-base font-semibold tabular-nums leading-tight", tone)}>{value}</p>
    <p className="truncate text-[10.5px] text-zinc-500">{label}</p>
  </div>;
}

/** A one-line "where this shows" note under a field. */
const Hint = ({ children }: { children: ReactNode }) => <p className="text-[11px] leading-snug text-zinc-500">{children}</p>;

/**
 * The study plan: the dates and daily target the rest of the app measures against. Explains what
 * each field is for and where it shows, and previews the result live while the user types.
 */
export function StudyPlanForm({
  saved,
  updatedAt,
  longTermDeadline,
  preparationDeadline,
  dailyStudyTargetMinutes,
  dateOfBirth,
  ageLimitYears,
}: {
  saved: boolean;
  updatedAt: Date | null;
  longTermDeadline?: Date | null;
  preparationDeadline?: Date | null;
  dailyStudyTargetMinutes?: number | null;
  dateOfBirth?: Date | null;
  ageLimitYears?: number | null;
}) {
  const [nowMs] = useState(() => Date.now());
  const form = useForm<StudyPlanInput>({
    resolver: zodResolver(studyPlanSchema),
    defaultValues: {
      longTermDeadline: longTermDeadline ? dayjs(longTermDeadline).format("YYYY-MM-DD") : "",
      preparationDeadline: preparationDeadline ? dayjs(preparationDeadline).format("YYYY-MM-DD") : "",
      dailyStudyTargetHours: dailyStudyTargetMinutes ? dailyStudyTargetMinutes / 60 : 3,
      dateOfBirth: dateOfBirth ? dayjs(dateOfBirth).format("YYYY-MM-DD") : "",
      ageLimitYears: ageLimitYears ?? 34,
    },
  });
  const errors = form.formState.errors;
  const [birth, ageLimit, longTerm, prep, hours] = useWatch({ control: form.control, name: ["dateOfBirth", "ageLimitYears", "longTermDeadline", "preparationDeadline", "dailyStudyTargetHours"] });
  const ageLimitNumber = Number(ageLimit);
  const hoursNumber = Number(hours) || 0;
  const valid = (value?: string) => (value && dayjs(value).isValid() ? dayjs(value).toDate() : null);
  const ageLimitDate = valid(birth) && ageLimitNumber > 0 ? birthdayAtAge(birth, ageLimitNumber).toDate() : null;
  const longTermDate = valid(longTerm);
  const prepDate = valid(prep);
  // The dashboard countdown runs to the age limit when a birth date is given, otherwise to the long-term date.
  const countdownTo = ageLimitDate ?? longTermDate;
  const prepDays = prepDate ? Math.max(0, Math.ceil((prepDate.getTime() - nowMs) / 86_400_000)) : null;
  const prepAfterFinal = prepDate && countdownTo && prepDate > countdownTo;

  const mutation = useMutation({
    mutationFn: saveStudyPlan,
    onSuccess: () => toast.success("Study plan saved — the dashboard now counts down from it."),
    onError: (error: Error) => toast.error(error.message),
  });

  // Everything fits one phone screen: short header, a folded "why", a one-row summary, paired fields.
  return (
    <div className="mx-auto max-w-2xl space-y-2.5">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Study plan</h1>
        {saved
          ? <span title={updatedAt ? `Last saved ${formatDate(updatedAt)}` : undefined} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100"><CheckCircle2 className="size-3.5" /> সেট করা আছে</span>
          : <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100"><AlertTriangle className="size-3.5" /> এখনো সেট হয়নি</span>}
      </header>

      <details className="group rounded-xl bg-zinc-950 text-white [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm">
          <span><span className="font-semibold">তোমার প্রস্তুতির মানচিত্র।</span> <span className="text-white/70">কেন সবার আগে?</span></span>
          <ChevronDown className="size-4 shrink-0 text-white/60 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="space-y-1.5 px-3 pb-3 text-[13px] text-white/80">
          <li className="flex gap-2"><Hourglass className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> বয়সসীমা পেরোলে সরকারি চাকরিতে আবেদন করা যায় না — বাকি সময় চোখে থাকলে পড়া নিয়মিত হয়।</li>
          <li className="flex gap-2"><Target className="mt-0.5 size-3.5 shrink-0 text-emerald-300" /> দৈনিক লক্ষ্য দিয়ে app প্রতিদিন মেলায় “আজ যথেষ্ট পড়লাম কি না”।</li>
          <li className="flex gap-2"><TrendingUp className="mt-0.5 size-3.5 shrink-0 text-sky-300" /> Dashboard-এর countdown, আজকের লক্ষ্য আর Progress — সব এই পাতা থেকে। পরে যেকোনো সময় বদলানো যায়।</li>
        </ul>
      </details>

      <section aria-label="এক নজরে" className="grid grid-cols-4 divide-x divide-zinc-100 rounded-xl border border-zinc-200 bg-white px-2 py-2">
        <Glance label={ageLimitDate ? `${ageLimitNumber} বছর হতে` : "লক্ষ্য পর্যন্ত"} value={timeLeft(countdownTo, nowMs) ?? "—"} tone={countdownTo && countdownTo.getTime() - nowMs < 365 * 86_400_000 ? "text-red-600" : undefined} />
        <Glance label="প্রস্তুতি শেষ" value={prepDays === null ? "—" : `${prepDays} দিন`} />
        <Glance label="প্রতিদিন" value={hoursNumber ? `${hoursNumber} ঘণ্টা` : "—"} />
        <Glance label="মোট সুযোগ" value={prepDays !== null && hoursNumber ? `${Math.round(prepDays * hoursNumber).toLocaleString("en-US")}h` : "—"} tone="text-emerald-700" />
      </section>

      <form className="space-y-2.5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="grid grid-cols-[1fr_6.5rem] gap-2">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="dateOfBirth" className="text-xs">জন্মতারিখ</Label>
              <Input id="dateOfBirth" type="date" max={dayjs().format("YYYY-MM-DD")} className="compact-date h-10 px-2" {...form.register("dateOfBirth")} />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="ageLimitYears" className="text-xs">বয়সসীমা</Label>
              <Input id="ageLimitYears" type="number" inputMode="numeric" min={1} max={100} className="h-10" {...form.register("ageLimitYears")} />
            </div>
          </div>
          {errors.dateOfBirth || errors.ageLimitYears ? <p className="text-xs text-red-600">{errors.dateOfBirth?.message ?? errors.ageLimitYears?.message}</p> : null}
          <Hint>{ageLimitDate ? <>{ageLimitNumber} বছর হবে <b className="text-zinc-800">{formatDate(ageLimitDate)}</b> · Dashboard countdown</> : "সরকারি চাকরিতে সাধারণত ৩২ · Dashboard countdown এখান থেকে"}</Hint>

          <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2.5">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="preparationDeadline" className="text-xs">প্রস্তুতি শেষের তারিখ</Label>
              <Input id="preparationDeadline" type="date" className="compact-date h-10 px-2" {...form.register("preparationDeadline")} />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor="longTermDeadline" className="text-xs">চূড়ান্ত লক্ষ্যের তারিখ</Label>
              <Input id="longTermDeadline" type="date" className="compact-date h-10 px-2" {...form.register("longTermDeadline")} />
            </div>
          </div>
          {errors.preparationDeadline || errors.longTermDeadline ? <p className="text-xs text-red-600">দুটো তারিখই দাও।</p> : null}
          {prepAfterFinal
            ? <p className="flex items-start gap-1 text-[11px] text-amber-700"><AlertTriangle className="mt-px size-3.5 shrink-0" /> প্রস্তুতি শেষের তারিখ চূড়ান্ত লক্ষ্যের আগে হওয়া উচিত।</p>
            : <Hint>প্রস্তুতি = সিলেবাস একবার শেষ · চূড়ান্ত = শেষ বড় পরীক্ষা</Hint>}

          <div className="space-y-1.5 border-t border-zinc-100 pt-2.5">
            <Label htmlFor="dailyStudyTargetHours" className="text-xs">দৈনিক লক্ষ্য (ঘণ্টা)</Label>
            <div className="flex items-center gap-1.5">
              {HOUR_PRESETS.map((preset) => <button
                key={preset}
                type="button"
                onClick={() => form.setValue("dailyStudyTargetHours", preset, { shouldDirty: true })}
                className={cn("h-10 flex-1 rounded-lg border text-sm font-medium transition", hoursNumber === preset ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300")}
              >{preset}h</button>)}
              <Input id="dailyStudyTargetHours" type="number" inputMode="decimal" step="0.5" min={0.5} max={16} aria-label="Other number of hours" className="h-10 w-18 shrink-0 px-2 text-center" {...form.register("dailyStudyTargetHours")} />
            </div>
            {errors.dailyStudyTargetHours ? <p className="text-xs text-red-600">০.৫ থেকে ১৬ ঘণ্টার মধ্যে দাও।</p> : <Hint>Dashboard-এর “আজকের লক্ষ্য” আর Progress এর সাথে মেলায়</Hint>}
          </div>
        </div>

        {/* Right padding on phones keeps the row clear of the floating assistant button. */}
        <div className="flex gap-2 pr-16 sm:pr-0">
          <Button type="submit" disabled={mutation.isPending} className="h-11 flex-1 sm:flex-none sm:px-6">
            {mutation.isPending ? "Saving…" : saved ? "Save changes" : "Save my plan"}
          </Button>
          <VoiceFormAssistant compact title="Study plan voice form" steps={[
            { key: "longTermDeadline", label: "Long deadline", question: "Long term deadline তারিখটি বলুন" },
            { key: "preparationDeadline", label: "Preparation deadline", question: "Preparation deadline তারিখটি বলুন" },
            { key: "dailyStudyTargetHours", label: "Daily hours", question: "প্রতিদিন কত ঘণ্টা পড়বেন?" },
          ]} onComplete={(answers) => {
            form.setValue("longTermDeadline", answers.longTermDeadline);
            form.setValue("preparationDeadline", answers.preparationDeadline);
            const parsed = Number.parseFloat(answers.dailyStudyTargetHours.replace(",", ".").replace(/[^0-9.]/g, ""));
            if (parsed > 0) form.setValue("dailyStudyTargetHours", parsed);
          }} />
        </div>
      </form>
    </div>
  );
}
