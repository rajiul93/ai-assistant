import { Suspense } from "react";
import { ConfusionBoard } from "@/components/confusions/confusion-board";
import { requireUser } from "@/lib/auth";
import { listConfusions } from "@/server/actions/confusions";
import { getSubjects } from "@/server/queries";

export const metadata = { title: "Confusion — Prep" };

export default async function ConfusionsPage() {
  const user = await requireUser();
  const [items, subjects] = await Promise.all([listConfusions(), getSubjects(user.id)]);
  return <Suspense><ConfusionBoard items={items} subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} /></Suspense>;
}
