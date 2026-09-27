import { Briefcase, GraduationCap } from "lucide-react";
import type { PaymentMethod, PlanType } from "@prisma/client";

// Plain values shared by server pages (Plans, admin Billing) and the client purchase flow. They live
// outside the "use client" component file: a server component can't read values exported from one.

export const taka = (amount: number) => `৳${amount.toLocaleString("en-US")}`;
export const methodNames: Record<PaymentMethod, string> = { BKASH: "bKash", NAGAD: "Nagad" };

export const planInfo: Record<PlanType, { label: string; blurb: string; icon: typeof GraduationCap; card: string; accent: string; chip: string }> = {
  STUDENT: {
    label: "Student",
    blurb: "পড়াশোনার জন্য — কম দামে",
    icon: GraduationCap,
    card: "border-sky-200 bg-sky-50/60",
    accent: "text-sky-700",
    chip: "bg-sky-600 text-white",
  },
  PROFESSIONAL: {
    label: "Professional",
    blurb: "বেশি ব্যবহারের জন্য — অনেক বেশি AI ব্যবহার",
    icon: Briefcase,
    card: "border-amber-200 bg-amber-50/60",
    accent: "text-amber-800",
    chip: "bg-zinc-950 text-white",
  },
};
