import { Suspense } from "react";
import { VideoLibrary } from "@/components/videos/video-library";
import { requireUser } from "@/lib/auth";
import { listVideos } from "@/server/actions/videos";
import { getSubjects } from "@/server/queries";

export const metadata = { title: "ভিডিও লাইব্রেরি — Prep" };

export default async function VideosPage() {
  const user = await requireUser();
  const [{ videos, limit }, subjects] = await Promise.all([listVideos(), getSubjects(user.id)]);
  return <Suspense><VideoLibrary videos={videos} limit={limit} subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))} /></Suspense>;
}
