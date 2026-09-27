import { redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Where a blocked account lands: a notice and a way to sign out. Nothing else in the app is reachable. */
export default async function BlockedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } });
  if (row?.status !== "BLOCKED") redirect("/dashboard");
  return <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-6">
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600"><Ban className="size-6" /></span>
      <h1 className="mt-4 text-lg font-semibold">Account বন্ধ করা হয়েছে</h1>
      <p className="mt-1 text-sm text-zinc-600">তোমার account ({user.email}) admin বন্ধ রেখেছে। জানতে বা আবার চালু করতে admin-এর সাথে যোগাযোগ করো।</p>
      <div className="mt-5 flex justify-center"><SignOutButton /></div>
    </div>
  </main>;
}
