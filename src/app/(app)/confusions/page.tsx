import { Suspense } from "react";
import { ConfusionBoard } from "@/components/confusions/confusion-board";
import { requireUser } from "@/lib/auth";
import { listConfusions } from "@/server/actions/confusions";
import { getSubjects, getTopicNodes } from "@/server/queries";

export const metadata = { title: "Confusion — Prep" };

export default async function ConfusionsPage() {
  const user = await requireUser();
  const [items, subjects, topics] = await Promise.all([listConfusions(), getSubjects(user.id), getTopicNodes(user.id)]);
  return <Suspense><ConfusionBoard items={items} subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} topics={topics} /></Suspense>;
}
