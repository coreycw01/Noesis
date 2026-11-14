import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'demo-noesis-rules';
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/, 'Run inside the loopback Firestore emulator.');
assert.equal(process.env.GCLOUD_PROJECT, projectId, 'Use the isolated demo project.');
assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, projectId, 'Build and run with the emulator project ID.');
const base = 'http://127.0.0.1:9103';
const app = initializeApp({ projectId });
const profile = getFirestore(app).collection('publicProfiles').doc('release-check');
const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', '9103'], {
  env: { ...process.env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId },
  stdio: 'inherit',
});
const closed = once(server, 'close');
const path = '/p/release-check/';

async function readProfile() {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.ok, true);
  assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
  return response.text();
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40 && server.exitCode === null; attempt++) {
    try {
      ready = (await fetch(base, { signal: AbortSignal.timeout(500) })).ok;
    } catch {
      await delay(250);
    }
    if (ready) break;
  }
  assert.ok(ready && server.exitCode === null, 'The isolated production server did not start.');

  const identity = 'Release smoke profile';
  const selected = 'Deliberately published concept';
  const privateText = 'Private workspace sentinel';
  await getFirestore(app).doc('users/release-owner/concepts/private').set({ name: privateText });
  assert.match(await readProfile(), /Profile unavailable/);

  await profile.set({
    ownerId: 'release-owner',
    shareSlug: 'release-check',
    enabled: true,
    displayName: identity,
    concepts: [{ id: 'published', name: selected }],
  });
  const published = await readProfile();
  assert.ok(published.includes(identity) && published.includes(selected), 'The visitor did not receive selected public content.');
  assert.ok(!published.includes(privateText), 'Private workspace content leaked.');

  await profile.set({ ownerId: 'release-owner', shareSlug: 'release-check', enabled: false });
  const withdrawn = await readProfile();
  assert.match(withdrawn, /Profile unavailable/);
  assert.ok(!withdrawn.includes(identity) && !withdrawn.includes(selected), 'Withdrawn content remained available.');
  console.log('Public profile HTTP smoke passed: unpublished, published, private content excluded, and withdrawn.');
} finally {
  server.kill();
  await closed;
  await deleteApp(app);
}
