"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirebasePublicConfig, isFirebaseClientConfigured } from "@/lib/firebase/config";

export { isFirebaseClientConfigured };

export function getFirebaseApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp(getFirebasePublicConfig());
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
