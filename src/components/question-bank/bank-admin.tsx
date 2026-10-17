"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Search, Unlock } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/user-error";

/**
 * Small pieces the Question Bank's staff controls share (docs/question-bank-v2-plan.md): a name
 * dialog, a "move to" picker, a delete confirmation, and the Free/Paid pill. Every change goes to a
 * server action that checks the `question_bank` permission itself.
 */

/** Runs a server action with a toast and a refresh; `busy` while it runs. */
export function useBankRun() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  function run<T>(action: () => Promise<T>, done: string | ((result: T) => string), after?: (result: T) => void) {
    startTransition(async () => {
      try {
        const result = await action();
        toast.success(typeof done === "function" ? done(result) : done);
        after?.(result);
        router.refresh();
      } catch (error) {
        toast.error(errorMessage(error, "করা গেল না।"));
      }
    });
  }
  return { busy, run };
}

export const adminButton = "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-violet-900 ring-1 ring-violet-200 hover:bg-white disabled:opacity-50";
export const iconButton = "flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40";

/** "Free" or "Paid" — staff tap it to switch. */
export function FreePill({ free, onToggle, busy }: { free: boolean; onToggle?: () => void; busy?: boolean }) {
  const pill = cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ring-1", free ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-900 ring-amber-200");
  const content = <>{free ? <Unlock className="size-3" /> : <Lock className="size-3" />}{free ? "Free" : "Paid"}</>;
  if (!onToggle) return <span className={pill}>{content}</span>;
  return <button type="button" disabled={busy} onClick={onToggle} title={free ? "Paid করো" : "Free করো"} className={cn(pill, "hover:brightness-95 disabled:opacity-50")}>{content}</button>;
}

/** A name to add or rename something; `withDescription` adds a short description under it (chapters). */
export function NameDialog({ open, onOpenChange, title, label, initial = "", initialDescription = "", withDescription = false, busy, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initial?: string;
  initialDescription?: string;
  withDescription?: boolean;
  busy?: boolean;
  onSubmit: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [description, setDescription] = useState(initialDescription);
  return <Dialog open={open} onOpenChange={(next) => { if (next) { setName(initial); setDescription(initialDescription); } onOpenChange(next); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSubmit(name.trim(), description.trim()); }} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">{label}</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder={withDescription ? "ছোট নাম, যেমন: বাংলা ভাষার উৎপত্তি" : undefined} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-400" />
        </label>
        {withDescription ? <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">ছোট বর্ণনা <span className="font-normal text-zinc-400">(ইচ্ছা হলে)</span></span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 300))} rows={3} placeholder="এই chapter-এ কী আছে, এক-দুই লাইনে" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-zinc-400" />
          <span className="block text-right text-xs text-zinc-400 tabular-nums">{description.length}/300</span>
        </label> : null}
        <button type="submit" disabled={busy || !name.trim()} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} সেভ
        </button>
      </form>
    </DialogContent>
  </Dialog>;
}

/** Pick where to move something: a searchable list of targets. */
export function MoveDialog({ open, onOpenChange, title, targets, loading, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; targets: Array<{ id: string; label: string }>; loading?: boolean; busy?: boolean; onSubmit: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const shown = targets.filter((target) => target.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <Dialog open={open} onOpenChange={(next) => { setQuery(""); onOpenChange(next); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      {targets.length > 6 ? <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="খুঁজুন" aria-label="খুঁজুন" className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400" />
      </label> : null}
      {loading ? <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> লোড হচ্ছে…</p>
        : shown.length ? <ul className="max-h-[50dvh] divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200">
          {shown.map((target) => <li key={target.id}>
            <button type="button" disabled={busy} onClick={() => onSubmit(target.id)} className="flex w-full items-center px-3 py-3 text-left text-sm hover:bg-zinc-50 disabled:opacity-50">{target.label}</button>
          </li>)}
        </ul> : <p className="py-8 text-center text-sm text-zinc-500">কোথাও সরানোর জায়গা নেই।</p>}
    </DialogContent>
  </Dialog>;
}

export function ConfirmDelete({ open, onOpenChange, title, description, busy, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; busy?: boolean; onConfirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>{description}</AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>বাতিল</AlertDialogCancel>
        <button type="button" disabled={busy} onClick={onConfirm} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} মুছে ফেলো
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
