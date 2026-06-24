
const requiredFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const missingFirebaseConfigKeys = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigComplete = missingFirebaseConfigKeys.length === 0;

export const firebaseConfig = {
  apiKey: requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: requiredFirebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};
