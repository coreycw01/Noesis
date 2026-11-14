
'use client';

import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { initializeFirebaseAuth } from './auth/client-auth';
import { isFirebaseConfigComplete, missingFirebaseConfigKeys } from './config';
import { useLocalFirebaseEmulators } from './local-emulators';

let firestore: Firestore;
let firestoreInitialized = false;

export function initializeFirebase() {
  try {
    const { firebaseApp, auth } = initializeFirebaseAuth();
    
    if (!firestoreInitialized) {
      try {
        // Keeps recently opened workspace data available through brief mobile
        // disconnects and lets Firestore safely reconcile when the user returns.
        firestore = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          ignoreUndefinedProperties: true,
        });
      } catch {
        // Another client module may have initialized Firestore first. It remains
        // usable even when the browser cannot provide persistent storage.
        firestore = getFirestore(firebaseApp);
      }
      if (useLocalFirebaseEmulators) connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
      firestoreInitialized = true;
    }
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
