"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { unlockBankSet } from "@/server/actions/question-bank";
import { errorMessage } from "@/lib/user-error";

/**
 * Without a plan: open this past-year set as one of the user's free picks (any 3, kept for good —
 * owner, 2026-10-16). Once they are used up, it points to the plans.
 */
export function UnlockSet({ setId, used, limit, hidden }: { setId: string; used: number; limit: number; hidden: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const left = Math.max(0, limit - used);

  async function unlock() {
    setBusy(true);
    try {
      const result = await unlockBankSet(setId);
      toast.success(`Set খোলা হলো — বিনা plan-এ আর ${Math.max(0, limit - result.used)}টা খোলা যাবে`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "খোলা গেল না।"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
    <p className="flex items-center gap-2 font-semibold"><Lock className="size-4" /> আরও {hidden}টি প্রশ্ন বন্ধ আছে</p>
    {left ? <>
      <p className="mt-1 text-sm">বিনা plan-এ যেকোনো {limit}টা set পুরো খুলে পড়া যায় (সমাধানসহ) — তোমার আর <b>{left}টা</b> বাকি। একবার খুললে সবসময় খোলা থাকবে।</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void unlock()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} এই set খোলো ({used + 1}/{limit})
        </button>
        <Link href="/billing" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold ring-1 ring-amber-300 hover:bg-amber-100">Plan দেখো</Link>
      </div>
    </> : <>
      <p className="mt-1 text-sm">বিনা plan-এর {limit}টা set খোলা হয়ে গেছে। এই পরীক্ষাসহ একটা plan নিলে সব set, সমাধান আর ব্যাখ্যা খুলে যাবে।</p>
      <Link href="/billing" className="mt-3 inline-flex h-10 items-center rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950">Plan দেখো</Link>
    </>}
  </div>;
}
