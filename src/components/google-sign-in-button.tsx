"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";

/** Hands the server a fresh ID token plus the refresh token that keeps the login alive. */
async function startSession(user: User) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken(true), refreshToken: user.refreshToken }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Sign-in failed.");
  }
}

export function GoogleSignInButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const busy = useRef(false);
  const configured = isFirebaseClientConfigured();

  // Firebase remembers the Google sign-in on this device. If the server session is gone (cookies
  // cleared, or signed in before refresh tokens were kept), sign back in without a click.
  useEffect(() => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      if (!user || busy.current) return;
      busy.current = true;
      setResuming(true);
      startSession(user)
        .then(() => { router.replace("/dashboard"); router.refresh(); })
        .catch(() => { setResuming(false); busy.current = false; });
    });
  }, [configured, router]);

  async function onSignIn() {
    if (!configured) {
      toast.error("Firebase client configuration is missing.");
      return;
    }

    setLoading(true);
    busy.current = true;
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      await startSession(result.user);
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      busy.current = false;
      toast.error(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={onSignIn} disabled={loading || resuming || !configured} size="lg" className="w-full">
      {resuming ? "Signing you back in…" : loading ? "Signing in..." : "Sign in with Google"}
    </Button>
  );
}
