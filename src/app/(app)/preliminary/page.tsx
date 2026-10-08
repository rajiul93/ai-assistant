import { Suspense } from "react";
import { PreliminaryBoard } from "@/components/preliminary/preliminary-board";
import { requireUser } from "@/lib/auth";
import { listQuestionSets } from "@/server/actions/preliminary";
import { getSubjects } from "@/server/queries";

export default async function PreliminaryPage() {
  const user = await requireUser();
  const [sets, subjects] = await Promise.all([listQuestionSets(), getSubjects(user.id)]);
  return <Suspense><PreliminaryBoard sets={sets} subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} /></Suspense>;
}
