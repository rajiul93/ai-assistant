import { Suspense } from "react";
import { VocabularyView } from "@/components/vocabulary/vocabulary-view";
import { requireUser } from "@/lib/auth";
import { listAffixes, listLearned, listNouns, listVerbs } from "@/server/actions/vocabulary";
import { can } from "@/server/roles";

export const metadata = { title: "Vocabulary — Prep" };

export default async function VocabularyPage() {
  const user = await requireUser();
  // Everyone reads the tables and ticks what they have learned; only admins and the super admin add to them.
  const [verbs, affixes, nouns, learnedKeys, canEdit] = await Promise.all([listVerbs(), listAffixes(), listNouns(), listLearned(), can(user, "vocabulary")]);
  return <Suspense><VocabularyView verbs={verbs} affixes={affixes} nouns={nouns} learnedKeys={learnedKeys} canEdit={canEdit} /></Suspense>;
}
