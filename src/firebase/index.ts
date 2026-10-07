
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigComplete, missingFirebaseConfigKeys } from './config';

let firebaseApp: FirebaseApp;
let firestore: Firestore;
let auth: Auth;
let firestoreInitialized = false;

export function initializeFirebase() {
  try {
    if (!isFirebaseConfigComplete) {
      throw new Error(`Missing Firebase environment variables: ${missingFirebaseConfigKeys.join(', ')}`);
    }

    if (getApps().length > 0) {
      firebaseApp = getApp();
    } else {
      firebaseApp = initializeApp(firebaseConfig);
    }
    
    if (!firestoreInitialized) {
      try {
        // Keeps recently opened workspace data available through brief mobile
        // disconnects and lets Firestore safely reconcile when the user returns.
        firestore = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
      } catch {
        // Another client module may have initialized Firestore first. It remains
        // usable even when the browser cannot provide persistent storage.
        firestore = getFirestore(firebaseApp);
      }
      firestoreInitialized = true;
    }
    auth = getAuth(firebaseApp);

    return { firebaseApp, firestore, auth };
  } catch (error) {
    console.error('Firebase initialization failed', error);
    throw error;
  }
}

export { isFirebaseConfigComplete, missingFirebaseConfigKeys };
export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
