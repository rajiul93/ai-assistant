import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { isFirebaseClientConfigured } from "@/lib/firebase/config";

export default function LoginPage() {
  const configured = isFirebaseClientConfigured();

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8">
        <p className="text-sm font-medium text-zinc-500">Prep</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Google is the only sign-in method. Your study data stays private to your account.
        </p>
        <div className="mt-8">
          <GoogleSignInButton />
        </div>
        {!configured ? (
          <p className="mt-4 text-sm text-red-600">
            Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable Google sign-in.
          </p>
        ) : null}
      </div>
    </div>
  );
}
