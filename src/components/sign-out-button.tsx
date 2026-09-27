"use client";

import { signOut } from "firebase/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { stopSpeaking } from "@/lib/voice";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    stopSpeaking();
    // Server session first (cookies, token cache, refresh tokens)...
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    // ...then the Google sign-in kept on this device, or the login page would sign straight back in.
    if (isFirebaseClientConfigured()) await signOut(getFirebaseAuth()).catch(() => {});
    // A full page load wipes everything held in memory (query cache, chat history) with it.
    window.location.replace("/login");
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void onSignOut()} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
