"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
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

  const working = loading || resuming;
  return (
    <button type="button" onClick={onSignIn} disabled={working || !configured} className="group relative flex h-14 w-full items-center gap-3 overflow-hidden rounded-2xl bg-linear-to-r from-[#3f6ef3] via-[#4f7cf6] to-[#6f8ff9] pl-2 pr-5 text-[16px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(37,99,235,0.75)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-12px_rgba(37,99,235,0.85)] active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-75">
      {/* A soft shine that sweeps across on hover. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 opacity-0 blur-md transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100" />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        {working ? <Loader2 className="size-5 animate-spin text-blue-600" /> : <GoogleMark />}
      </span>
      <span className="flex-1 text-center">{resuming ? "আবার ঢোকানো হচ্ছে…" : loading ? "ঢোকা হচ্ছে…" : "Google দিয়ে চালিয়ে যান"}</span>
      <ArrowRight className="size-5 shrink-0 transition group-hover:translate-x-1" />
    </button>
  );
}

/** Google's "G", as its sign-in button guidelines ask for. */
function GoogleMark() {
  return <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>;
}
