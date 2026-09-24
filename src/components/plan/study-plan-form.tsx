"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStudyPlan } from "@/server/actions/plan";
import { studyPlanSchema, type StudyPlanInput } from "@/lib/validations";
import { birthdayAtAge, dayjs, formatDate } from "@/lib/dayjs";
import { VoiceFormAssistant } from "@/components/voice-form-assistant";

export function StudyPlanForm({
  longTermDeadline,
  preparationDeadline,
  dailyStudyTargetMinutes,
  dateOfBirth,
  ageLimitYears,
}: {
  longTermDeadline?: Date | null;
  preparationDeadline?: Date | null;
  dailyStudyTargetMinutes?: number | null;
  dateOfBirth?: Date | null;
  ageLimitYears?: number | null;
}) {
  const form = useForm<StudyPlanInput>({
    resolver: zodResolver(studyPlanSchema),
    defaultValues: {
      longTermDeadline: longTermDeadline ? dayjs(longTermDeadline).format("YYYY-MM-DD") : "",
      preparationDeadline: preparationDeadline
        ? dayjs(preparationDeadline).format("YYYY-MM-DD")
        : "",
      dailyStudyTargetHours: dailyStudyTargetMinutes ? dailyStudyTargetMinutes / 60 : 3,
      dateOfBirth: dateOfBirth ? dayjs(dateOfBirth).format("YYYY-MM-DD") : "",
      ageLimitYears: ageLimitYears ?? 34,
    },
  });
  const watchedBirth = useWatch({ control: form.control, name: "dateOfBirth" });
  const watchedAgeLimit = Number(useWatch({ control: form.control, name: "ageLimitYears" }));
  const ageLimitDate = watchedBirth && watchedAgeLimit > 0 && dayjs(watchedBirth).isValid()
    ? birthdayAtAge(watchedBirth, watchedAgeLimit).toDate()
    : null;

  const mutation = useMutation({
    mutationFn: saveStudyPlan,
    onSuccess: () => toast.success("Study plan saved"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <VoiceFormAssistant title="Study plan voice form" steps={[
        { key: "longTermDeadline", label: "Long deadline", question: "Long term deadline তারিখটি বলুন" },
        { key: "preparationDeadline", label: "Preparation deadline", question: "Preparation deadline তারিখটি বলুন" },
        { key: "dailyStudyTargetHours", label: "Daily hours", question: "প্রতিদিন কত ঘণ্টা পড়বেন?" },
      ]} onComplete={(answers) => {
        form.setValue("longTermDeadline", answers.longTermDeadline);
        form.setValue("preparationDeadline", answers.preparationDeadline);
        const hours = Number.parseFloat(answers.dailyStudyTargetHours.replace(",", ".").replace(/[^0-9.]/g, ""));
        if (hours > 0) form.setValue("dailyStudyTargetHours", hours);
      }} />
    <form
      className="max-w-lg space-y-5"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" type="date" max={dayjs().format("YYYY-MM-DD")} {...form.register("dateOfBirth")} />
          {form.formState.errors.dateOfBirth && (
            <p className="text-sm text-red-600">{form.formState.errors.dateOfBirth.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ageLimitYears">Age limit</Label>
          <Input id="ageLimitYears" type="number" min={1} max={100} {...form.register("ageLimitYears")} />
          {form.formState.errors.ageLimitYears && (
            <p className="text-sm text-red-600">{form.formState.errors.ageLimitYears.message}</p>
          )}
        </div>
        <p className="text-sm text-zinc-500 sm:col-span-2">
          {ageLimitDate
            ? <>You turn {watchedAgeLimit} on <span className="font-medium text-zinc-900">{formatDate(ageLimitDate)}</span> — the dashboard counts down to this day.</>
            : "Add your date of birth to count down to your age limit on the dashboard."}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="longTermDeadline">Long-term deadline</Label>
        <Input id="longTermDeadline" type="date" {...form.register("longTermDeadline")} />
        {form.formState.errors.longTermDeadline && (
          <p className="text-sm text-red-600">{form.formState.errors.longTermDeadline.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="preparationDeadline">Job preparation deadline</Label>
        <Input id="preparationDeadline" type="date" {...form.register("preparationDeadline")} />
        {form.formState.errors.preparationDeadline && (
          <p className="text-sm text-red-600">
            {form.formState.errors.preparationDeadline.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="dailyStudyTargetHours">Daily study target (hours)</Label>
        <Input
          id="dailyStudyTargetHours"
          type="number"
          step="0.5"
          min={0.5}
          {...form.register("dailyStudyTargetHours")}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Save plan"}
      </Button>
    </form>
    </>
  );
}
