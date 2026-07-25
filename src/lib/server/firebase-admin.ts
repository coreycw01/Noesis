import 'server-only';

import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function adminApp() {
  return getApps()[0] || initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminAppCheck() {
  return getAppCheck(adminApp());
}

export function adminFirestore() {
  return getFirestore(adminApp());
}
