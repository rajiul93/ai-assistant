import { Suspense } from "react";
import { VocabularyView } from "@/components/vocabulary/vocabulary-view";
import { requireUser } from "@/lib/auth";
import { listAffixes, listVerbs } from "@/server/actions/vocabulary";

export const metadata = { title: "Vocabulary — Prep" };

export default async function VocabularyPage() {
  await requireUser();
  const [verbs, affixes] = await Promise.all([listVerbs(), listAffixes()]);
  return <Suspense><VocabularyView verbs={verbs} affixes={affixes} /></Suspense>;
}
