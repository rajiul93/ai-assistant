"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FREE_VIDEO_LIMIT, parseYouTubeId } from "@/lib/youtube";
import { hasPremium } from "@/server/premium";

/**
 * Video library: YouTube videos a student saves to watch inside the app, so studying doesn't lead
 * into YouTube's feed. Free users keep up to FREE_VIDEO_LIMIT; a running plan removes the limit.
 * Videos already saved stay playable after a plan ends — only adding more is blocked.
 */

const addSchema = z.object({
  url: z.string().trim().min(1, "YouTube link দিন").max(500),
  subjectId: z.string().max(64).nullish(),
});

/** Title and channel from YouTube's public oEmbed (no API key); null when it can't be read. */
async function videoInfo(videoId: string) {
  try {
    const watch = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    // 401/403: embedding is turned off for this video, so it couldn't play here anyway.
    if (response.status === 401 || response.status === 403) throw new Error("এই ভিডিওর মালিক অন্য site-এ চালানো বন্ধ রেখেছেন, তাই এখানে চলবে না।");
    if (response.status === 404 || response.status === 400) throw new Error("ভিডিওটা পাওয়া যায়নি — private বা মুছে ফেলা হতে পারে।");
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string; author_name?: string };
    return { title: data.title?.trim().slice(0, 300) || null, channel: data.author_name?.trim().slice(0, 120) || null };
  } catch (error) {
    if (error instanceof Error && !/abort|timeout|fetch/i.test(error.name + error.message)) throw error;
    return null;
  }
}

/** The user's videos (newest first), how many they may keep, and their subjects for filing. */
export async function listVideos() {
  const user = await requireUser();
  const [videos, premium] = await Promise.all([
    prisma.studyVideo.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, videoId: true, title: true, channel: true, subjectId: true, createdAt: true, subject: { select: { name: true } } },
    }),
    hasPremium(user),
  ]);
  return { videos, limit: premium ? null : FREE_VIDEO_LIMIT };
}

export async function addVideo(input: unknown) {
  const user = await requireUser();
  const data = addSchema.parse(input);
  const videoId = parseYouTubeId(data.url);
  if (!videoId) throw new Error("এটা YouTube ভিডিওর link মনে হচ্ছে না। ভিডিওর Share থেকে link কপি করে দিন।");

  const subjectId = data.subjectId || null;
  if (subjectId && !(await prisma.subject.findFirst({ where: { id: subjectId, userId: user.id }, select: { id: true } }))) throw new Error("Subject পাওয়া যায়নি।");
  if (await prisma.studyVideo.findFirst({ where: { userId: user.id, videoId }, select: { id: true } })) throw new Error("এই ভিডিওটা আগেই যোগ করা আছে।");
  if (!(await hasPremium(user)) && (await prisma.studyVideo.count({ where: { userId: user.id } })) >= FREE_VIDEO_LIMIT) {
    throw new Error(`Free-তে ${FREE_VIDEO_LIMIT}টা ভিডিও রাখা যায়। আরও রাখতে plan নিন, বা একটা মুছে জায়গা করুন।`);
  }

  const info = await videoInfo(videoId);
  try {
    const video = await prisma.studyVideo.create({ data: { userId: user.id, subjectId, videoId, title: info?.title ?? "YouTube ভিডিও", channel: info?.channel ?? null }, select: { id: true } });
    revalidatePath("/videos");
    return video;
  } catch (error) {
    // Two quick taps: the unique (userId, videoId) index keeps one.
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new Error("এই ভিডিওটা আগেই যোগ করা আছে।");
    throw error;
  }
}

export async function deleteVideo(id: string) {
  const user = await requireUser();
  const { count } = await prisma.studyVideo.deleteMany({ where: { id: z.string().max(64).parse(id), userId: user.id } });
  if (!count) throw new Error("ভিডিওটা পাওয়া যায়নি।");
  revalidatePath("/videos");
}
