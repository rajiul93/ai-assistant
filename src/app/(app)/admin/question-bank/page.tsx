import { notFound } from "next/navigation";
import { BankUpload } from "@/components/question-bank/bank-upload";
import { requireUser } from "@/lib/auth";
import { listAllBankSets } from "@/server/actions/question-bank";
import { isSuperAdminEmail } from "@/server/roles";

export const metadata = { title: "প্রশ্ন ব্যাংক আপলোড — Prep" };

export default async function BankUploadPage() {
  const me = await requireUser();
  if (!isSuperAdminEmail(me.email)) notFound();
  return <BankUpload sets={await listAllBankSets()} />;
}
