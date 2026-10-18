import { Suspense } from "react";
import { VocabularyView } from "@/components/vocabulary/vocabulary-view";
import { requireUser } from "@/lib/auth";
import { getVocabState, listAffixes, listNouns, listVerbs } from "@/server/actions/vocabulary";
import { can } from "@/server/roles";

export const metadata = { title: "Vocabulary — Prep" };

export default async function VocabularyPage() {
  const user = await requireUser();
  // Everyone reads the tables, ticks what they have learned (it moves to Done) and takes the exams; only staff add words.
  const [verbs, affixes, nouns, state, canEdit] = await Promise.all([listVerbs(), listAffixes(), listNouns(), getVocabState(), can(user, "vocabulary")]);
  return <Suspense><VocabularyView verbs={verbs} affixes={affixes} nouns={nouns} state={state} canEdit={canEdit} /></Suspense>;
}
