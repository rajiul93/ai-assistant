import { notFound } from "next/navigation";
import { ShortResultView } from "@/components/short-questions/short-question-views";
import { requireUser } from "@/lib/auth";
import { getShortAttempt } from "@/server/actions/short-questions";

export default async function ShortTestResultPage(props: PageProps<"/short-questions/[id]/result/[attemptId]">) {
  const { id, attemptId } = await props.params;
  await requireUser();
  const attempt = await getShortAttempt(attemptId);
  if (!attempt || attempt.setId !== id) notFound();
  return <ShortResultView attempt={attempt} setId={attempt.setId} status={attempt.set.status} topicName={attempt.set.topicName} subjectName={attempt.set.subject?.name ?? null} />;
}
