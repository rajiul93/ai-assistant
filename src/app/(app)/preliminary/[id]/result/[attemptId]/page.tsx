import { notFound } from "next/navigation";
import { ResultView } from "@/components/preliminary/question-set-views";
import { requireUser } from "@/lib/auth";
import { getAttempt } from "@/server/actions/preliminary";

export default async function TestResultPage(props: PageProps<"/preliminary/[id]/result/[attemptId]">) {
  const { id, attemptId } = await props.params;
  await requireUser();
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.setId !== id) notFound();
  return <ResultView attempt={attempt} setId={attempt.setId} status={attempt.set.status} topicName={attempt.set.topicName} subjectName={attempt.set.subject?.name ?? null} />;
}
