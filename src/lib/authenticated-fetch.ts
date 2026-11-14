'use client';

import { getToken } from 'firebase/app-check';
import { initializeFirebaseAuth } from '@/firebase/auth/client-auth';
import { initializeNoesisAppCheck } from '@/firebase/app-check';
import { abortableOperation } from '@/lib/abortable-operation';
import { noesisApiUrl } from '@/lib/noesis-api-url';

export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  const signal = init.signal ?? undefined;
  signal?.throwIfAborted();
  const url = noesisApiUrl(input, window.location.origin);
  const { auth } = initializeFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in is required.');

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${await abortableOperation(() => user.getIdToken(), signal)}`);
  signal?.throwIfAborted();
  const appCheck = initializeNoesisAppCheck();
  if (appCheck) {
    const token = await abortableOperation(() => getToken(appCheck, false), signal);
    headers.set('x-firebase-appcheck', token.token);
  }
  signal?.throwIfAborted();
  headers.set('x-request-id', crypto.randomUUID());
  return fetch(url, { ...init, headers, redirect: 'error' });
}
