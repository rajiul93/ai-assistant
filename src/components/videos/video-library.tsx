"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Crown, Loader2, MonitorPlay, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { youTubeThumbnail } from "@/lib/youtube";
import { addVideo, deleteVideo } from "@/server/actions/videos";
import { YouTubePlayer } from "./youtube-player";

type Video = { id: string; videoId: string; title: string; channel: string | null; subjectId: string | null; subject: { name: string } | null };
type Subject = { id: string; name: string };

const card = "rounded-3xl bg-white shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)]";

/**
 * /videos: paste a YouTube link, watch it here (?v=<id> opens the player at the top), delete it.
 * `limit` is null with a running plan; free users see how many of their slots are used.
 */
export function VideoLibrary({ videos, limit, subjects }: { videos: Video[]; limit: number | null; subjects: Subject[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Video | null>(null);

  const playing = videos.find((video) => video.id === searchParams.get("v")) ?? null;
  const full = limit !== null && videos.length >= limit;
  const open = (id: string | null) => {
    router.replace(id ? `${pathname}?v=${id}` : pathname, { scroll: false });
    if (id) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const add = useMutation({
    mutationFn: () => addVideo({ url, subjectId: subjectId || null }),
    onSuccess: ({ id }) => { toast.success("ভিডিও যোগ হলো"); setUrl(""); router.refresh(); open(id); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (video: Video) => deleteVideo(video.id),
    onSuccess: (_, video) => { toast.success("ভিডিও মুছে ফেলা হলো"); if (playing?.id === video.id) open(null); router.refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  // Subjects that have videos, for the filter chips.
  const filed = subjects.filter((subject) => videos.some((video) => video.subjectId === subject.id));
  const shown = filter ? videos.filter((video) => video.subjectId === filter) : videos;

  return <div className="space-y-4">
    <section className="rounded-3xl bg-linear-to-br from-[#3f6ef3] via-[#5a87f8] to-[#8fa6fb] p-4 text-white shadow-[0_14px_32px_-18px_rgba(37,99,235,0.6)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">ভিডিও লাইব্রেরি</h1>
          <p className="mt-0.5 text-[13px] leading-snug text-white/90">YouTube-এর ভিডিও এখানেই দেখুন — অন্য ভিডিওর সাজেশন ছাড়া, মন দিয়ে।</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold tabular-nums ring-1 ring-white/30">{limit === null ? `${videos.length}টি` : `${videos.length}/${limit}`}</span>
      </div>

      {full ? <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 text-slate-700">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Crown className="size-5" /></span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug">Free-তে {limit}টা ভিডিও রাখা যায়। আরও রাখতে plan নিন, বা একটা মুছে জায়গা করুন।</p>
        <Link href="/billing" className="shrink-0 rounded-full bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white">Plan দেখুন</Link>
      </div> : <form onSubmit={(event) => { event.preventDefault(); if (url.trim()) add.mutate(); }} className="mt-3 space-y-2">
        <div className="flex gap-2">
          <input value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" autoCapitalize="off" placeholder="YouTube link পেস্ট করুন" aria-label="YouTube link" className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-white/30" />
          <button type="submit" disabled={add.isPending || !url.trim()} className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60">{add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} যোগ</button>
        </div>
        {subjects.length ? <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} aria-label="Subject" className="h-9 w-full rounded-full bg-white/20 px-3 text-[13px] text-white outline-none ring-1 ring-white/30 sm:w-auto [&>option]:text-slate-900">
          <option value="">Subject (ইচ্ছা হলে)</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select> : null}
      </form>}
    </section>

    {playing ? <section className={cn(card, "overflow-hidden")}>
      <YouTubePlayer key={playing.id} videoId={playing.videoId} title={playing.title} />
      <div className="flex items-start gap-2 p-3.5 sm:p-4">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900">{playing.title}</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">{[playing.channel, playing.subject?.name].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" onClick={() => open(null)} aria-label="ভিডিও বন্ধ করুন" className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
      </div>
    </section> : null}

    {filed.length ? <nav aria-label="Subject" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
      {[{ id: null, name: "সব" }, ...filed].map((subject) => <button key={subject.id ?? "all"} type="button" aria-pressed={filter === subject.id} onClick={() => setFilter(subject.id)} className={cn("h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition", filter === subject.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)]")}>{subject.name}</button>)}
    </nav> : null}

    {!videos.length ? <div className={cn(card, "px-5 py-10 text-center")}>
      <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-blue-50"><MonitorPlay className="size-7 text-blue-500" /></span>
      <p className="font-semibold text-slate-800">এখনো কোনো ভিডিও নেই</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">YouTube-এ ভিডিওর নিচে Share চেপে link কপি করুন, তারপর উপরের বক্সে পেস্ট করুন।</p>
    </div> : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((video) => <li key={video.id} className={cn(card, "flex gap-3 p-2.5 sm:block sm:p-0", playing?.id === video.id && "ring-2 ring-blue-500")}>
        <button type="button" onClick={() => open(video.id)} className="relative block aspect-video w-36 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:w-full sm:rounded-b-none sm:rounded-t-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail host */}
          <img src={youTubeThumbnail(video.videoId)} alt="" loading="lazy" className="size-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/10"><span className="flex size-9 items-center justify-center rounded-full bg-white/90 text-blue-700 shadow sm:size-11"><Play className="size-4 translate-x-px fill-current sm:size-5" /></span></span>
        </button>
        <div className="flex min-w-0 flex-1 items-start gap-1 sm:p-3">
          <button type="button" onClick={() => open(video.id)} className="min-w-0 flex-1 text-left">
            <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-900">{video.title}</span>
            <span className="mt-1 block truncate text-xs text-slate-500">{video.channel}</span>
            {video.subject ? <span className="mt-1.5 inline-block max-w-full truncate rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{video.subject.name}</span> : null}
          </button>
          <button type="button" onClick={() => setPendingDelete(video)} aria-label={`“${video.title}” মুছুন`} className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
        </div>
      </li>)}
    </ul>}

    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(value) => !value && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>ভিডিওটা মুছে ফেলবেন?</AlertDialogTitle>
        <AlertDialogDescription>“{pendingDelete?.title}” তালিকা থেকে চলে যাবে। পরে আবার link দিয়ে যোগ করা যাবে।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখো</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => pendingDelete && remove.mutate(pendingDelete)}>মুছে ফেলো</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
