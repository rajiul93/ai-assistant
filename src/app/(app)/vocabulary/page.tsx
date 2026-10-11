import { Suspense } from "react";
import { VocabularyView } from "@/components/vocabulary/vocabulary-view";
import { requireUser } from "@/lib/auth";
import { listAffixes, listNouns, listVerbs } from "@/server/actions/vocabulary";
import { isAdminUser } from "@/server/roles";

export const metadata = { title: "Vocabulary — Prep" };

export default async function VocabularyPage() {
  const user = await requireUser();
  // Everyone reads the tables; only admins and the super admin add to them.
  const [verbs, affixes, nouns, canEdit] = await Promise.all([listVerbs(), listAffixes(), listNouns(), isAdminUser(user)]);
  return <Suspense><VocabularyView verbs={verbs} affixes={affixes} nouns={nouns} canEdit={canEdit} /></Suspense>;
}
