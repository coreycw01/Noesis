
'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

let firebaseApp;
let firestore: Firestore;
let auth: Auth;

export function initializeFirebase() {
  if (getApps().length > 0) {
    firebaseApp = getApp();
  } else {
    firebaseApp = initializeApp(firebaseConfig);
  }
  
  firestore = getFirestore(firebaseApp);
  auth = getAuth(firebaseApp);

  return { firebaseApp, firestore, auth };
}

// Initialize immediately on the client
const instances = typeof window !== 'undefined' ? initializeFirebase() : null;

export const db = instances?.firestore;
export const firebaseAuth = instances?.auth;
export const app = instances?.firebaseApp;

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
