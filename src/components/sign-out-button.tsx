"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";

export function SignOutButton() {
  const router = useRouter();

  async function onSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    // Also forget the Google sign-in on this device, or the login page would sign straight back in.
    if (isFirebaseClientConfigured()) await signOut(getFirebaseAuth()).catch(() => {});
    toast.success("Signed out");
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onSignOut}>
      Sign out
    </Button>
  );
}
