"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2, ShieldCheck, UserMinus, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { STAFF_PERMISSIONS, type StaffPermission } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { addStaff, removeStaff, setStaffPermissions } from "@/server/actions/staff";

type Row = { id: string; name: string | null; email: string; image: string | null; superAdmin: boolean; me: boolean; permissions: StaffPermission[] };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<unknown>, done: string, after?: () => void) => start(async () => {
    try { await action(); toast.success(done); after?.(); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "করা গেল না।"); }
  });
  return { pending, run };
}

/** Tappable permission chips; ones the viewer doesn't hold can't be changed by them. */
function PermissionChips({ value, mine, disabled, onChange }: { value: StaffPermission[]; mine: StaffPermission[]; disabled?: boolean; onChange?: (next: StaffPermission[]) => void }) {
  return <div className="flex flex-wrap gap-1.5">
    {STAFF_PERMISSIONS.map((item) => {
      const on = value.includes(item.id);
      const locked = disabled || !onChange || !mine.includes(item.id);
      return <button
        key={item.id}
        type="button"
        role="switch"
        aria-checked={on}
        disabled={locked}
        title={item.hint}
        onClick={() => onChange?.(on ? value.filter((id) => id !== item.id) : [...value, item.id])}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1 transition",
          on ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-zinc-600 ring-zinc-200",
          locked ? "cursor-default opacity-70" : "active:scale-95",
        )}
      >{on ? <Check className="size-3.5" strokeWidth={3} /> : null}{item.label}</button>;
    })}
  </div>;
}

function Avatar({ row }: { row: Row }) {
  return row.image
    // eslint-disable-next-line @next/next/no-img-element -- Google profile photos; next/image would need their host configured.
    ? <img src={row.image} alt="" referrerPolicy="no-referrer" className="size-10 shrink-0 rounded-full object-cover" />
    : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><UserRound className="size-5" /></span>;
}

/**
 * Staff and their permissions. Customers (block, AI pause, cancel) moved to the Customers page;
 * here only who is staff and what each may do.
 */
export function StaffManager({ rows, mine }: { rows: Row[]; mine: StaffPermission[] }) {
  const { pending, run } = useRun();
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<StaffPermission[]>([]);
  const [removing, setRemoving] = useState<Row | null>(null);

  function add() {
    if (!email.trim()) { toast.error("Email দিন"); return; }
    run(() => addStaff({ email, permissions: picked }), `${email.trim()} এখন staff`, () => { setEmail(""); setPicked([]); });
  }

  return <div className="space-y-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Staff</h1>
      <p className="text-xs text-zinc-500 sm:text-sm">আমাদের staff আর কে কী করতে পারবে। কাস্টমারদের block, AI বন্ধ বা subscription cancel এখন Customers পেজে।</p>
    </div>

    <section className="space-y-2.5 rounded-2xl border border-zinc-200 bg-white p-3.5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><UserPlus className="size-4 text-blue-600" /> নতুন staff যোগ করুন</h2>
      <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="off" placeholder="তার Prep account-এর email" aria-label="Staff email" className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400" />
      <PermissionChips value={picked} mine={mine} onChange={setPicked} />
      <button type="button" onClick={add} disabled={pending} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-950 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Staff বানাও</button>
      <p className="text-[11px] text-zinc-500">তাকে আগে একবার Prep-এ sign in করতে হবে। Staff হলে AI-এর limit থাকে না আর সব exam খোলা থাকে; permission ঠিক করে কোন admin কাজ পারবে।</p>
    </section>

    <ul className="space-y-2">
      {rows.map((row) => {
        const editable = !row.superAdmin && !row.me;
        return <li key={row.id} className={cn("rounded-2xl border bg-white p-3.5", row.superAdmin ? "border-violet-200" : "border-zinc-200")}>
          <div className="flex items-center gap-3">
            <Avatar row={row} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-1.5 font-semibold"><span className="truncate">{row.name || row.email}</span>{row.me ? <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-600">আপনি</span> : null}</p>
              <p className="truncate text-xs text-zinc-500">{row.email}</p>
            </div>
            {row.superAdmin
              ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800"><Crown className="size-3.5" /> Super admin</span>
              : editable ? <button type="button" disabled={pending} onClick={() => setRemoving(row)} aria-label={`${row.email} কে staff থেকে বাদ দাও`} className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"><UserMinus className="size-3.5" /> বাদ দাও</button> : null}
          </div>
          <div className="mt-3">
            {row.superAdmin
              ? <p className="flex items-center gap-1.5 text-xs text-violet-800"><ShieldCheck className="size-4" /> সব permission — বদলানো যায় না</p>
              : <PermissionChips value={row.permissions} mine={mine} disabled={pending || !editable} onChange={editable ? (next) => run(() => setStaffPermissions({ userId: row.id, permissions: next }), "Permission বদলানো হলো") : undefined} />}
            {!row.superAdmin && !row.permissions.length ? <p className="mt-1.5 text-[11px] text-amber-700">কোনো permission নেই — admin পেজ খুলতে পারবে না, শুধু AI limit ছাড়া চলবে।</p> : null}
          </div>
        </li>;
      })}
    </ul>

    <AlertDialog open={Boolean(removing)} onOpenChange={(value) => !value && setRemoving(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>{removing?.name || removing?.email} কে staff থেকে বাদ দেবেন?</AlertDialogTitle>
        <AlertDialogDescription>সে সাধারণ user হয়ে যাবে: কোনো admin পেজ খুলবে না, আর AI ব্যবহারে plan লাগবে। তার নিজের ডেটা থাকবে। পরে আবার staff করা যায়।</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>রাখো</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => { const row = removing; setRemoving(null); if (row) run(() => removeStaff({ userId: row.id }), `${row.name || row.email} এখন আর staff নন`); }} className="bg-red-600 hover:bg-red-700">বাদ দাও</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
