"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CheckCircle2, Clock, Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { MathText, RichHtml } from "@/components/math-text";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shareTypeLabel } from "@/lib/collaboration";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { OPTION_LETTERS } from "@/lib/preliminary";
import { cn } from "@/lib/utils";
import { getSharePreview, respondShare, type ShareContent } from "@/server/actions/shares";
import { useLive } from "./live-provider";
import { errorMessage } from "@/lib/user-error";

const priorityLabel = { LOW: "কম", MEDIUM: "মাঝারি", HIGH: "বেশি" } as const;

/** The shared item exactly as it will be added, so it can be checked before accepting. */
function ShareBody({ content }: { content: ShareContent }) {
  const place = "subjectName" in content.data && content.data.subjectName ? content.data.subjectName : null;
  const placeLine = [place, "topicName" in content.data && content.type !== "PRELIMINARY_SET" && content.type !== "SHORT_QUESTION_SET" ? content.data.topicName : null].filter(Boolean).join(" › ");

  switch (content.type) {
    case "NOTE":
      return <div className="space-y-2">
        {placeLine ? <p className="text-xs text-indigo-700">{placeLine}</p> : null}
        <h3 className="text-lg font-semibold">{content.data.title}</h3>
        {content.data.content.trim() ? <RichHtml html={content.data.content} className="rounded-xl border border-zinc-200 bg-white" /> : <p className="text-sm text-zinc-500">Note-টা ফাঁকা।</p>}
      </div>;
    case "TASK":
      return <div className="space-y-3">
        {placeLine ? <p className="text-xs text-indigo-700">{placeLine}</p> : null}
        <h3 className="text-lg font-semibold">{content.data.title}</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1"><Clock className="size-3.5" /> {content.data.estimatedMinutes} মিনিট</span>
          <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1"><Flag className="size-3.5" /> গুরুত্ব: {priorityLabel[content.data.priority]}</span>
          {content.data.dueDate ? <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1"><CalendarDays className="size-3.5" /> {formatDate(new Date(content.data.dueDate))}</span> : null}
        </div>
        {content.data.description ? <RichHtml html={content.data.description} className="rounded-xl border border-zinc-200 bg-white" /> : <p className="text-sm text-zinc-500">বিস্তারিত লেখা নেই।</p>}
        <p className="text-xs text-zinc-500">আপনার কাছে “শুরু হয়নি” অবস্থায় যোগ হবে।</p>
      </div>;
    case "PRELIMINARY_SET":
      return <div className="space-y-3">
        <p className="text-sm text-zinc-600">{[place, content.data.topicName, `${content.data.questions.length}টি প্রশ্ন`].filter(Boolean).join(" · ")}</p>
        <ol className="space-y-3">
          {content.data.questions.map((question, index) => <li key={index} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={question.text} /></p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => {
                const right = optionIndex === question.correctIndex;
                return <li key={optionIndex} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm", right ? "bg-emerald-50 font-medium text-emerald-900" : "bg-zinc-50")}>
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", right ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-600")}>{right ? <Check className="size-3" strokeWidth={3} /> : OPTION_LETTERS[optionIndex]}</span>
                  <MathText text={option} />
                </li>;
              })}
            </ul>
          </li>)}
        </ol>
        <p className="text-xs text-zinc-500">আপনার Preliminary-তে Todo হিসেবে যোগ হবে।</p>
      </div>;
    case "SHORT_QUESTION_SET":
      return <div className="space-y-3">
        <p className="text-sm text-zinc-600">{[place, content.data.topicName, `${content.data.questions.length}টি প্রশ্ন`].filter(Boolean).join(" · ")}</p>
        <ol className="space-y-3">
          {content.data.questions.map((question, index) => <li key={index} className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="font-medium leading-relaxed"><span className="mr-1.5 text-zinc-400 tabular-nums">{index + 1}.</span><MathText text={question.text} /></p>
            <p className="mt-2 flex gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm text-emerald-950"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span className="whitespace-pre-line"><MathText text={question.answer} /></span></p>
          </li>)}
        </ol>
        <p className="text-xs text-zinc-500">আপনার Short Question-এ Todo হিসেবে যোগ হবে।</p>
      </div>;
  }
}

/**
 * Look at everything inside a share, then accept or reject it. Accepting happens only here, after
 * seeing the content.
 */
export function SharePreviewDialog({ shareId, onClose }: { shareId: string; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refresh } = useLive();
  const preview = useQuery({ queryKey: ["share-preview", shareId], queryFn: () => getSharePreview(shareId) });
  const [busy, setBusy] = useState(false);

  async function answer(accept: boolean) {
    setBusy(true);
    try {
      const result = await respondShare(shareId, accept);
      if (accept && result.path) toast.success("আপনার কাছে যোগ হলো", { action: { label: "খুলুন", onClick: () => router.push(result.path!) } });
      else toast.success("বাদ দেওয়া হলো");
      for (const key of ["shares", "notifications", "share-preview"]) void queryClient.invalidateQueries({ queryKey: [key] });
      refresh();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "করা গেল না।"));
    } finally {
      setBusy(false);
    }
  }

  const data = preview.data;
  const waiting = data?.status === "PENDING";
  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
    <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-2xl">
      <DialogHeader><DialogTitle>{data ? `${shareTypeLabel[data.content.type]} — দেখে নিন` : "Share"}</DialogTitle></DialogHeader>
      {data ? <p className="text-sm text-zinc-600"><span className="font-semibold text-zinc-900">{data.sender.name}</span> পাঠিয়েছে · {formatDateTime(data.createdAt)}</p> : null}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {preview.isLoading ? <div className="flex justify-center py-12 text-zinc-400"><Loader2 className="size-6 animate-spin" /></div> : null}
        {preview.isError ? <p className="py-8 text-center text-sm text-red-600">{errorMessage(preview.error, "দেখানো গেল না।")} <button type="button" onClick={() => void preview.refetch()} className="underline">আবার চেষ্টা করো</button></p> : null}
        {data ? <ShareBody content={data.content} /> : null}
      </div>

      {data && waiting ? <div className="flex gap-2 border-t border-zinc-100 pt-3">
        <button type="button" disabled={busy} onClick={() => void answer(true)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} ঠিক আছে — নিন</button>
        <button type="button" disabled={busy} onClick={() => void answer(false)} className="flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"><X className="size-4" /> বাদ</button>
      </div> : null}
      {data && !waiting ? <p className="border-t border-zinc-100 pt-3 text-center text-sm text-zinc-500">{data.status === "ACCEPTED" ? "এটা আগেই নেওয়া হয়েছে।" : data.status === "REJECTED" ? "এটা বাদ দেওয়া হয়েছে।" : "পাঠানো মানুষটি share বাতিল করেছে।"}</p> : null}
    </DialogContent>
  </Dialog>;
}
