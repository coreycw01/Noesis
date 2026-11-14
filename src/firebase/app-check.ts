'use client';

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { initializeFirebaseAuth } from './auth/client-auth';

let appCheck: AppCheck | null = null;

export function initializeNoesisAppCheck() {
  if (appCheck || typeof window === 'undefined') return appCheck;
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return null;

  if (
    process.env.NODE_ENV !== 'production'
    && process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN
  ) {
    (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
  }

  const { firebaseApp } = initializeFirebaseAuth();
  appCheck = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheck;
}
