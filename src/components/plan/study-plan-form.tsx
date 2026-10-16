"use client";

import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Check, Clock, Hourglass, Minus, Plus, Sparkles, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { saveStudyPlan } from "@/server/actions/plan";
import { studyPlanSchema, type StudyPlanInput } from "@/lib/validations";
import { APP_TIMEZONE, birthdayAtAge, dayjs, diffParts, formatDate } from "@/lib/dayjs";
import { cn } from "@/lib/utils";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";
import { errorMessage } from "@/lib/user-error";

const HOUR_PRESETS = [2, 3, 4, 6];
const card = "rounded-3xl bg-white p-3.5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:p-5";

/** "4.2 বছর", "3 মাস 5 দিন", "35 দিন" — whole units only. */
function timeLeft(to: Date | null, nowMs: number) {
  if (!to) return null;
  const parts = diffParts(nowMs, to);
  if (parts.expired) return "পেরিয়ে গেছে";
  if (parts.years) return `${(parts.years + parts.months / 12).toFixed(1).replace(/\.0$/, "")} বছর`;
  if (parts.months) return `${parts.months} মাস ${parts.days} দিন`;
  return `${parts.days} দিন`;
}

/** A date `amount` units after `nowMs` (today), as the date input wants it. */
const fromToday = (nowMs: number, amount: number, unit: "month" | "year") => dayjs(nowMs).tz(APP_TIMEZONE).add(amount, unit).format("YYYY-MM-DD");

/** One numbered step card; the number turns into a green tick once the step is filled. */
function Step({ n, done, tone, icon, title, hint, children }: { n: number; done: boolean; tone: string; icon: ReactNode; title: string; hint?: ReactNode; children: ReactNode }) {
  return <section className={card}>
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-2xl transition-colors", done ? "bg-emerald-500 text-white" : tone)}>
        {done ? <Check className="size-5" strokeWidth={3} /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-400">ধাপ {n}</p>
        <h2 className="-mt-0.5 truncate text-[15px] font-bold text-slate-900">{title}</h2>
      </div>
    </div>
    {children}
    {hint ? <div className="mt-2 text-[11.5px] leading-snug text-slate-500">{hint}</div> : null}
  </section>;
}

/** Small pill button that fills a field in one tap. */
function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("h-7 shrink-0 rounded-full px-2.5 text-[11.5px] font-semibold transition active:scale-95", active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700")}>{children}</button>;
}

const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: ReactNode }) => <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-slate-600">{children}</label>;
const fieldClass = "h-11 rounded-xl border-slate-200 bg-slate-50 px-2.5 text-[15px] focus-visible:bg-white";

/**
 * The study plan: the dates and daily target the dashboard countdown, today's goal and Progress
 * measure against. Three short steps with one-tap choices; the banner shows the result live, so
 * the user sees what filling it in gives them. Fits one phone screen.
 */
export function StudyPlanForm({
  saved,
  updatedAt,
  preparationDeadline,
  dailyStudyTargetMinutes,
  dateOfBirth,
  ageLimitYears,
}: {
  saved: boolean;
  updatedAt: Date | null;
  preparationDeadline?: Date | null;
  dailyStudyTargetMinutes?: number | null;
  dateOfBirth?: Date | null;
  ageLimitYears?: number | null;
}) {
  const [nowMs] = useState(() => Date.now());
  const [savedNow, setSavedNow] = useState(saved);
  const form = useForm<StudyPlanInput>({
    resolver: zodResolver(studyPlanSchema),
    defaultValues: {
      preparationDeadline: preparationDeadline ? dayjs(preparationDeadline).format("YYYY-MM-DD") : "",
      dailyStudyTargetHours: dailyStudyTargetMinutes ? dailyStudyTargetMinutes / 60 : 3,
      dateOfBirth: dateOfBirth ? dayjs(dateOfBirth).format("YYYY-MM-DD") : "",
      ageLimitYears: ageLimitYears ?? 34,
    },
  });
  const errors = form.formState.errors;
  const [birth, ageLimit, prep, hours] = useWatch({ control: form.control, name: ["dateOfBirth", "ageLimitYears", "preparationDeadline", "dailyStudyTargetHours"] });
  const set = (name: keyof StudyPlanInput, value: string | number) => form.setValue(name, value as never, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });

  const ageLimitNumber = Number(ageLimit) || 0;
  const hoursNumber = Number(hours) || 0;
  const valid = (value?: string) => (value && dayjs(value).isValid() ? dayjs(value).toDate() : null);
  const ageLimitDate = valid(birth) && ageLimitNumber > 0 ? birthdayAtAge(birth, ageLimitNumber).toDate() : null;
  const prepDate = valid(prep);
  const ageLeft = timeLeft(ageLimitDate, nowMs);
  const ageUrgent = ageLimitDate && ageLimitDate.getTime() - nowMs < 365 * 86_400_000;
  // Whole days until the preparation deadline (calendar days, app timezone); negative once passed.
  const prepDays = prepDate ? dayjs(prepDate).tz(APP_TIMEZONE).startOf("day").diff(dayjs(nowMs).tz(APP_TIMEZONE).startOf("day"), "day") : null;
  const prepLabel = prepDays === null ? null : prepDays < 0 ? "পেরিয়ে গেছে" : prepDays === 0 ? "আজ শেষ" : `${prepDays} দিন`;
  const totalHours = prepDays !== null && prepDays > 0 && hoursNumber ? Math.round(prepDays * hoursNumber) : null;
  const prepAfterAgeLimit = prepDate && ageLimitDate && prepDate > ageLimitDate;

  // Step 1 is optional (birth date); steps 2 and 3 are what saving needs.
  const steps = [Boolean(ageLimitDate), Boolean(prepDate), hoursNumber >= 0.5 && hoursNumber <= 16];
  const doneCount = steps.filter(Boolean).length;
  const missing = (steps[1] ? 0 : 1) + (steps[2] ? 0 : 1);

  const mutation = useMutation({
    mutationFn: saveStudyPlan,
    onSuccess: () => {
      setSavedNow(true);
      toast.success("প্ল্যান সেভ হয়েছে — Dashboard এখন এখান থেকে গুনবে।");
    },
    onError: (error: Error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-6">
      {/* The result, live and compact: what the plan gives you, before you even save it. */}
      <section aria-label="এক নজরে" className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] px-4 py-3 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)] sm:px-5 sm:py-4 lg:sticky lg:top-10">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 size-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-2">
          <h1 className="text-base font-bold tracking-tight sm:text-lg">স্টাডি প্ল্যান</h1>
          <span title={savedNow && updatedAt ? `শেষ সেভ ${formatDate(updatedAt)}` : undefined} className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
            {savedNow ? <><Check className="size-3.5" strokeWidth={3} /> সেট করা আছে</> : <><Sparkles className="size-3.5" /> {doneCount}/3 ধাপ</>}
          </span>
        </div>
        <div className="relative mt-2 grid grid-cols-2 divide-x divide-white/25">
          <div className="min-w-0 pr-3">
            <p className={cn("truncate text-[clamp(20px,6vw,28px)] font-extrabold leading-tight tabular-nums", prepDays !== null && prepDays <= 30 && "text-amber-200")}>{prepLabel ?? "—"}</p>
            <p className="truncate text-[11.5px] text-white/85">প্রস্তুতি শেষ হতে বাকি</p>
          </div>
          <div className="min-w-0 pl-3">
            <p className={cn("truncate text-[clamp(20px,6vw,28px)] font-extrabold leading-tight tabular-nums", ageUrgent && "text-amber-200")}>{ageLeft ?? "—"}</p>
            <p className="truncate text-[11.5px] text-white/85">{ageLimitDate ? `${ageLimitNumber} বছর হতে বাকি` : "বয়সসীমা (জন্মতারিখ দিন)"}</p>
          </div>
        </div>
        <p className="relative mt-2 truncate text-[11.5px] text-white/85">
          প্রতিদিন <b className="font-semibold text-white">{hoursNumber ? `${hoursNumber} ঘণ্টা` : "—"}</b>
          {totalHours ? <> · প্রস্তুতি শেষ পর্যন্ত মোট <b className="font-semibold text-white">{totalHours.toLocaleString("en-US")} ঘণ্টা</b></> : null}
        </p>
      </section>

      <form className="mt-3 space-y-2.5 lg:mt-0 lg:space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Step n={1} done={steps[0]} tone="bg-blue-50 text-blue-600" icon={<UserRound className="size-5" />} title="তোমার বয়স" hint={
          errors.dateOfBirth || errors.ageLimitYears
            ? <span className="text-red-600">{errors.dateOfBirth ? "জন্মতারিখ আজকের আগের হতে হবে।" : "বয়সসীমা ১ থেকে ১০০ এর মধ্যে দাও।"}</span>
            : ageLimitDate ? <>{ageLimitNumber} বছর হবে <b className="text-slate-800">{formatDate(ageLimitDate)}</b> — Dashboard-এ এ দিন পর্যন্ত গুনবে</> : "ঐচ্ছিক · দিলে বয়সসীমা পর্যন্ত countdown হবে (সরকারি চাকরিতে সাধারণত ৩২)"
        }>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="min-w-0">
              <FieldLabel htmlFor="dateOfBirth">জন্মতারিখ</FieldLabel>
              <Input id="dateOfBirth" type="date" max={dayjs().format("YYYY-MM-DD")} className={cn("compact-date", fieldClass)} {...form.register("dateOfBirth")} />
            </div>
            <div>
              <FieldLabel htmlFor="ageLimitYears">বয়সসীমা</FieldLabel>
              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50">
                <button type="button" aria-label="এক বছর কম" onClick={() => set("ageLimitYears", Math.max(1, ageLimitNumber - 1))} className="flex h-full w-9 items-center justify-center text-slate-500 active:scale-90"><Minus className="size-4" /></button>
                <input id="ageLimitYears" type="number" inputMode="numeric" min={1} max={100} className="h-full w-9 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" {...form.register("ageLimitYears")} />
                <button type="button" aria-label="এক বছর বেশি" onClick={() => set("ageLimitYears", Math.min(100, ageLimitNumber + 1))} className="flex h-full w-9 items-center justify-center text-slate-500 active:scale-90"><Plus className="size-4" /></button>
              </div>
            </div>
          </div>
        </Step>

        <Step n={2} done={steps[1]} tone="bg-violet-50 text-violet-600" icon={<CalendarDays className="size-5" />} title="প্রস্তুতি কবে শেষ করবে?" hint={
          errors.preparationDeadline
            ? <span className="text-red-600">তারিখ দাও — নিচের বোতামে এক চাপেও দেওয়া যায়।</span>
            : prepAfterAgeLimit ? <span className="text-amber-700">এই তারিখ বয়সসীমা পেরোনোর পরে — একটু আগে রাখো।</span>
              : prepDate ? <>সিলেবাস একবার শেষ করার দিন · <b className="text-slate-800">{formatDate(prepDate)}</b></>
                : "সিলেবাস একবার শেষ করার দিন — Dashboard-এ বাকি দিন দেখাবে"
        }>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input id="preparationDeadline" type="date" aria-label="প্রস্তুতি শেষের তারিখ" className={cn("compact-date sm:max-w-52", fieldClass)} {...form.register("preparationDeadline")} />
            <div className="flex gap-1.5 overflow-x-auto">
              {([[3, "month", "৩ মাস"], [6, "month", "৬ মাস"], [1, "year", "১ বছর"], [2, "year", "২ বছর"]] as const).map(([amount, unit, label]) => {
                const value = fromToday(nowMs, amount, unit);
                return <Chip key={label} active={prep === value} onClick={() => set("preparationDeadline", value)}>{label}</Chip>;
              })}
            </div>
          </div>
        </Step>

        <Step n={3} done={steps[2]} tone="bg-emerald-50 text-emerald-600" icon={<Clock className="size-5" />} title="প্রতিদিন কত ঘণ্টা পড়বে?" hint={
          errors.dailyStudyTargetHours
            ? <span className="text-red-600">০.৫ থেকে ১৬ ঘণ্টার মধ্যে দাও।</span>
            : totalHours ? <>প্রস্তুতি শেষ পর্যন্ত মোট <b className="text-emerald-700">{totalHours.toLocaleString("en-US")} ঘণ্টা</b> পাবে · Dashboard-এর “আজকের লক্ষ্য”</>
              : "Dashboard-এর “আজকের লক্ষ্য” আর Progress এর সাথে মেলায়"
        }>
          <div className="flex items-center gap-1.5">
            <div role="radiogroup" aria-label="দৈনিক ঘণ্টা" className="grid flex-1 grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1">
              {HOUR_PRESETS.map((preset) => <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={hoursNumber === preset}
                onClick={() => set("dailyStudyTargetHours", preset)}
                className={cn("h-9 rounded-xl text-sm font-semibold transition", hoursNumber === preset ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >{preset}h</button>)}
            </div>
            <Input id="dailyStudyTargetHours" type="number" inputMode="decimal" step="0.5" min={0.5} max={16} aria-label="অন্য সংখ্যা (ঘণ্টা)" className="h-11 w-16 shrink-0 rounded-xl border-slate-200 bg-slate-50 px-1 text-center text-[15px] font-semibold" {...form.register("dailyStudyTargetHours")} />
          </div>
        </Step>

        {/* Right padding on phones keeps the row clear of the floating assistant button. */}
        <div className="flex items-center gap-2 pr-16 pt-0.5 sm:pr-0">
          <button
            type="submit"
            disabled={mutation.isPending}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-70",
              missing ? "bg-slate-400" : "bg-linear-to-r from-[#3f6ef3] to-[#5a87f8] shadow-[0_10px_24px_-12px_rgba(37,99,235,0.8)]",
            )}
          >
            {mutation.isPending ? "সেভ হচ্ছে…" : missing ? <><Hourglass className="size-4" /> আর {missing}টি ধাপ বাকি</> : savedNow ? "পরিবর্তন সেভ করো" : <><Check className="size-4" strokeWidth={3} /> প্ল্যান সেভ করো</>}
          </button>
          <VoiceFormAssistant compact title="Study plan voice form" steps={[
            { key: "preparationDeadline", label: "Preparation deadline", question: "Preparation deadline তারিখটি বলুন" },
            { key: "dailyStudyTargetHours", label: "Daily hours", question: "প্রতিদিন কত ঘণ্টা পড়বেন?" },
          ]} onComplete={(answers) => {
            form.setValue("preparationDeadline", answers.preparationDeadline);
            const parsed = Number.parseFloat(answers.dailyStudyTargetHours.replace(",", ".").replace(/[^0-9.]/g, ""));
            if (parsed > 0) form.setValue("dailyStudyTargetHours", parsed);
          }} />
        </div>
      </form>
    </div>
  );
}
