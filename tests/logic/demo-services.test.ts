import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteApp, getApps } from 'firebase/app';
import { doc, getDocFromServer, terminate } from 'firebase/firestore';
import { localDemoFirebase } from '../../src/firebase/demo-services';

test('the local demo can initialize without a default Firebase app and its Firestore is offline', async () => {
  const [first, second] = await Promise.all([localDemoFirebase(), localDemoFirebase()]);
  try {
    assert.equal(first, second);
    assert.equal(first.firebaseApp.options.projectId, 'demo-noesis-local');
    assert.equal(first.auth.currentUser, null);
    assert.equal(getApps().some((app) => app.name === '[DEFAULT]'), false);
    await assert.rejects(getDocFromServer(doc(first.firestore, 'users', 'demo')), { code: 'unavailable' });
  } finally {
    await terminate(first.firestore);
    await deleteApp(first.firebaseApp);
  }
});
