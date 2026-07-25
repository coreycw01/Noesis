'use client';

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { initializeFirebase } from './index';

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

  const { firebaseApp } = initializeFirebase();
  appCheck = initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheck;
}
