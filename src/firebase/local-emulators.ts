import { firebaseConfig } from './config';

export const useLocalFirebaseEmulators = process.env.NODE_ENV === 'development'
  && process.env.NEXT_PUBLIC_NOESIS_LOCAL_EMULATORS === 'true'
  && firebaseConfig.projectId.startsWith('demo-');
