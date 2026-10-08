import { Suspense } from "react";
import { PreliminaryBoard } from "@/components/preliminary/preliminary-board";
import { requireUser } from "@/lib/auth";
import { listShortQuestionSets } from "@/server/actions/short-questions";
import { getSubjects } from "@/server/queries";

export const metadata = { title: "Short Question — Prep" };

export default async function ShortQuestionsPage() {
  const user = await requireUser();
  const [sets, subjects] = await Promise.all([listShortQuestionSets(), getSubjects(user.id)]);
  return <Suspense><PreliminaryBoard kind="short" sets={sets} subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} /></Suspense>;
}
