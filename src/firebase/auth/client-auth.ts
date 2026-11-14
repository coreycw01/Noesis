'use client';

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigComplete, missingFirebaseConfigKeys } from '../config';
import { useLocalFirebaseEmulators } from '../local-emulators';

let firebaseApp: FirebaseApp;
let auth: Auth;

export function initializeFirebaseAuth() {
  if (!isFirebaseConfigComplete) {
    throw new Error(`Missing Firebase environment variables: ${missingFirebaseConfigKeys.join(', ')}`);
  }
  firebaseApp ??= initializeApp(firebaseConfig);
  if (!auth) {
    auth = initializeAuth(firebaseApp, {
      persistence: Capacitor.isNativePlatform()
        ? indexedDBLocalPersistence
        : [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
    if (useLocalFirebaseEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9198');
  }
  return { firebaseApp, auth };
}
