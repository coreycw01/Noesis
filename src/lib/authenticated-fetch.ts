'use client';

import { getToken } from 'firebase/app-check';
import { initializeFirebase } from '@/firebase';
import { initializeNoesisAppCheck } from '@/firebase/app-check';

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { auth } = initializeFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in is required.');

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${await user.getIdToken()}`);
  const appCheck = initializeNoesisAppCheck();
  if (appCheck) {
    const token = await getToken(appCheck, false);
    headers.set('x-firebase-appcheck', token.token);
  }
  headers.set('x-request-id', crypto.randomUUID());
  return fetch(input, { ...init, headers });
}
