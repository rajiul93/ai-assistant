"use client";

import { signOut } from "firebase/auth";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { stopSpeaking } from "@/lib/voice";

/** `compact`: an icon button for a coloured card (the sidebar's profile card). */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    stopSpeaking();
    // Server session first (cookies, token cache, refresh tokens)...
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    // ...then the Google sign-in kept on this device, or the login page would sign straight back in.
    if (isFirebaseClientConfigured()) await signOut(getFirebaseAuth()).catch(() => {});
    // A full page load wipes everything held in memory (query cache, chat history) with it.
    window.location.replace("/");
  }

  if (compact) {
    return <button type="button" onClick={() => void onSignOut()} disabled={busy} aria-label="Sign out" title="Sign out" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white transition hover:bg-white/30 disabled:opacity-50"><LogOut className="size-4" /></button>;
  }
  return (
    <Button variant="outline" size="sm" onClick={() => void onSignOut()} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
