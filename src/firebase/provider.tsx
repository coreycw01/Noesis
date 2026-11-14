
'use client';

import React, { createContext, useContext } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

interface FirebaseContextType {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);
const AuthContext = createContext<Auth | null>(null);

export function FirebaseAuthProvider({ auth, children }: { auth: Auth; children: React.ReactNode }) {
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function FirebaseProvider({ 
  children, 
  firebaseApp, 
  firestore, 
  auth 
}: { 
  children: React.ReactNode; 
  firebaseApp: FirebaseApp; 
  firestore: Firestore; 
  auth: Auth;
}) {
  return (
    <FirebaseContext.Provider value={{ firebaseApp, firestore, auth }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return {
    firebaseApp: context.firebaseApp,
    db: context.firestore,
    auth: context.auth,
  };
};

export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useFirestore = () => useFirebase().db;
export function useAuth() {
  const authOnly = useContext(AuthContext);
  const firebase = useContext(FirebaseContext);
  const auth = firebase?.auth ?? authOnly;
  if (!auth) throw new Error('useAuth must be used within a Firebase provider');
  return auth;
}
