import { BookOpen } from "lucide-react";
import { SubjectManager } from "@/components/subjects/subject-manager";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubjects } from "@/server/queries";

export default async function SubjectsPage() {
  const user = await requireUser();
  const [subjects, openByTopic] = await Promise.all([
    getSubjects(user.id),
    // Which topics already have an unfinished task, so the page can show them as added.
    prisma.task.groupBy({ by: ["topicId"], where: { userId: user.id, topicId: { not: null }, status: { not: "FINISHED" } }, _count: { _all: true } }),
  ]);
  const openTasks = Object.fromEntries(openByTopic.map((row) => [row.topicId as string, row._count._all]));
  const topicCount = subjects.reduce((sum, subject) => sum + subject.topics.length, 0);
  const stats = [
    { label: "Subject", value: subjects.length },
    { label: "Topic", value: topicCount },
    { label: "Tasks-এ", value: Object.keys(openTasks).length },
  ];

  return (
    <div className="space-y-4">
      {/* The home page's banner style: what this page is, and the numbers at a glance. */}
      <section className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-5 text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.6)] sm:p-7">
        <BookOpen aria-hidden className="pointer-events-none absolute -right-4 -top-4 size-32 rotate-12 text-white/10" />
        <h1 className="text-[clamp(22px,6.4vw,32px)] font-bold leading-tight tracking-tight">বিষয় ও টপিক</h1>
        <p className="mt-1 text-[clamp(12.5px,3.6vw,16px)] text-white/90">পড়ার বিষয় সাজান, এক চাপে topic থেকে task বানান।</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map((stat) => <div key={stat.label} className="rounded-2xl bg-white/15 px-2 py-2 text-center ring-1 ring-white/20">
            <p className="text-xl font-bold tabular-nums leading-tight sm:text-2xl">{stat.value}</p>
            <p className="text-[11px] text-white/85 sm:text-xs">{stat.label}</p>
          </div>)}
        </div>
      </section>
      <SubjectManager subjects={subjects} openTasks={openTasks} />
    </div>
  );
}
