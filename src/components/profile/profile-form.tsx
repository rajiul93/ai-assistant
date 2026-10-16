"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialOf } from "@/lib/collaboration";
import { formatBdPhone, normalizeBdPhone } from "@/lib/phone";
import { updateProfile } from "@/server/actions/profile";

type Profile = { name: string | null; phone: string | null; email: string; image: string | null };

/** /profile: the user's name (shown to friends and in groups) and private phone number. */
export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [phone, setPhone] = useState(initial.phone ? formatBdPhone(initial.phone) : "");
  const [pending, startTransition] = useTransition();
  const phoneInvalid = phone.trim() !== "" && !normalizeBdPhone(phone);

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const saved = await updateProfile({ name, phone });
        setName(saved.name);
        setPhone(saved.phone ? formatBdPhone(saved.phone) : "");
        toast.success("প্রোফাইল সেভ হলো");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "সেভ করা গেল না।");
      }
    });
  }

  const shownName = name.trim() || initial.email;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">প্রোফাইল</h1>
      <form onSubmit={save} className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-4">
          {initial.image
            // eslint-disable-next-line @next/next/no-img-element -- Google avatar, any host
            ? <img src={initial.image} alt="" className="size-14 rounded-full object-cover" referrerPolicy="no-referrer" />
            : <span className="flex size-14 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-600">{initialOf(shownName)}</span>}
          <div className="min-w-0">
            <p className="truncate font-medium">{shownName}</p>
            <p className="truncate text-sm text-zinc-500">{initial.email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-name">নাম</Label>
          <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required autoComplete="name" />
          <p className="text-xs text-zinc-500">Friend-রা আর গ্রুপের সদস্যরা এই নাম দেখবে।</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">মোবাইল নম্বর</Label>
          <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="01712345678" aria-invalid={phoneInvalid} className={phoneInvalid ? "border-rose-400 focus:border-rose-500" : undefined} />
          <p className={phoneInvalid ? "text-xs text-rose-600" : "text-xs text-zinc-500"}>
            {phoneInvalid ? "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01 দিয়ে শুরু, ১১ সংখ্যা)।" : "শুধু আপনি আর admin দেখতে পাবেন — অন্য কেউ না।"}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-email">ইমেইল</Label>
          <Input id="profile-email" value={initial.email} readOnly disabled />
        </div>

        <Button type="submit" disabled={pending || phoneInvalid || name.trim().length < 2} className="w-full sm:w-auto">
          {pending ? "সেভ হচ্ছে…" : "সেভ করুন"}
        </Button>
      </form>
    </div>
  );
}
