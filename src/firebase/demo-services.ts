import { initializeApp } from 'firebase/app';
import { inMemoryPersistence, initializeAuth } from 'firebase/auth';
import { disableNetwork, getFirestore } from 'firebase/firestore';

async function createDemoServices() {
  const firebaseApp = initializeApp({
    projectId: 'demo-noesis-local',
    apiKey: 'local-demo-only',
  }, 'noesis-local-demo');
  const firestore = getFirestore(firebaseApp);
  await disableNetwork(firestore);
  const auth = initializeAuth(firebaseApp, { persistence: inMemoryPersistence });
  return { firebaseApp, firestore, auth };
}

let services: ReturnType<typeof createDemoServices> | undefined;

export function localDemoFirebase() {
  return services ??= createDemoServices();
}
