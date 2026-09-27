"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, browserPopupRedirectResolver, getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirebasePublicConfig, isFirebaseClientConfigured } from "@/lib/firebase/config";

export { isFirebaseClientConfigured };

export function getFirebaseApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp(getFirebasePublicConfig());
}

let auth: Auth | null = null;

/**
 * Firebase Auth with a sign-in that survives closing the browser: kept in IndexedDB (localStorage
 * if that's unavailable) until the user signs out. The login page reads it back with
 * onAuthStateChanged to restore the server session when its cookies are gone.
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  try {
    auth = initializeAuth(getFirebaseApp(), {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialised (e.g. after a hot reload): use that instance.
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}
