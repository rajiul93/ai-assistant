import { Suspense } from "react";
import { PreliminaryBoard } from "@/components/preliminary/preliminary-board";
import { requireUser } from "@/lib/auth";
import { listQuestionSets } from "@/server/actions/preliminary";

export default async function PreliminaryPage() {
  await requireUser();
  const sets = await listQuestionSets();
  return <Suspense><PreliminaryBoard sets={sets} /></Suspense>;
}
