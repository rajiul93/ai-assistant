"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";

type Device = { id: string; label: string; lastSeenAt: string };

/** The user is already signed in on two devices: these, to pick one to remove. */
class DeviceLimitError extends Error {
  constructor(message: string, readonly devices: Device[]) { super(message); }
}

/**
 * Hands the server a fresh ID token plus the refresh token that keeps the login alive.
 * `replaceDeviceId` signs that other device out to make room for this one.
 */
async function startSession(user: User, replaceDeviceId?: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken(true), refreshToken: user.refreshToken, replaceDeviceId }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string; devices?: Device[] };
    if (payload.code === "DEVICE_LIMIT" && payload.devices) throw new DeviceLimitError(payload.error ?? "", payload.devices);
    throw new Error(payload.error || "Sign-in failed.");
  }
}

const seen = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return "এই মাত্র ব্যবহার হয়েছে";
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} ঘণ্টা আগে ব্যবহার` : `${Math.round(hours / 24)} দিন আগে ব্যবহার`;
};

export function GoogleSignInButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const busy = useRef(false);
  // Over the device limit: the signed-in Google user and the devices to pick from.
  const [limit, setLimit] = useState<{ user: User; devices: Device[] } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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
        .catch((error: unknown) => {
          setResuming(false);
          busy.current = false;
          if (error instanceof DeviceLimitError) setLimit({ user, devices: error.devices });
        });
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
      try {
        await startSession(result.user);
      } catch (error) {
        if (error instanceof DeviceLimitError) { setLimit({ user: result.user, devices: error.devices }); busy.current = false; return; }
        throw error;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      busy.current = false;
      toast.error(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function replace(device: Device) {
    if (!limit) return;
    setRemoving(device.id);
    try {
      await startSession(limit.user, device.id);
      toast.success(`${device.label} থেকে বের করে দেওয়া হলো`);
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      if (error instanceof DeviceLimitError) setLimit({ user: limit.user, devices: error.devices });
      else toast.error(error instanceof Error ? error.message : "করা গেল না");
    } finally {
      setRemoving(null);
    }
  }

  // Already on two devices: pick one to sign out, then this one comes in.
  if (limit) {
    return <div className="space-y-3 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
      <p className="text-[14px] font-semibold leading-snug text-amber-950">আপনি এখন ২টা device-এ লগইন আছেন। একসাথে ২টার বেশি চলে না — এখানে ঢুকতে একটা সরিয়ে দিন:</p>
      <ul className="space-y-2">
        {limit.devices.map((device) => <li key={device.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-amber-100">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-slate-900">{device.label}</span>
            <span className="block text-xs text-slate-500">{seen(device.lastSeenAt)}</span>
          </span>
          <button type="button" onClick={() => void replace(device)} disabled={Boolean(removing)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-3 text-[13px] font-semibold text-red-700 ring-1 ring-red-200 disabled:opacity-50">
            {removing === device.id ? <Loader2 className="size-4 animate-spin" /> : null} সরাও
          </button>
        </li>)}
      </ul>
      <button type="button" onClick={() => setLimit(null)} className="w-full text-center text-[13px] font-medium text-slate-500 underline underline-offset-4">বাতিল</button>
    </div>;
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
