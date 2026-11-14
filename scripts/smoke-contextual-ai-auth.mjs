import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Use only the isolated demo project and a local app with no provider key.
const auth = 'http://127.0.0.1:9198';
const api = 'http://127.0.0.1:9101/api/contextual-ai/';
const accounts = `${auth}/identitytoolkit.googleapis.com/v1/accounts`;
const email = `smoke-${randomUUID()}@example.test`;
const password = randomUUID();

async function emulatorRequest(operation, body) {
  const response = await fetch(`${accounts}:${operation}?key=demo-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  assert.equal(response.ok, true, value.error?.message || operation);
  return value;
}

async function request(token, method = 'GET', body) {
  const response = await fetch(api, {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const sample = {
  action: 'socratic_inquiry_challenge',
  targetType: 'inquiry',
  targetId: 'smoke-test',
  scope: 'linked_items',
  itemMemory: ['What would count as a fair test?'],
  linkedMemory: [],
};
async function smoke() {
  const initial = await emulatorRequest('signUp', { email, password, returnSecureToken: true });
  try {
    assert.equal((await request(undefined, 'POST', sample)).status, 401);
    assert.equal((await request('invalid', 'POST', sample)).body.code, 'invalid_auth');
    const unverified = await request(initial.idToken, 'POST', sample);
    assert.equal(unverified.status, 403);
    assert.equal(unverified.body.code, 'email_not_verified');

    const emailLink = await emulatorRequest('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: initial.idToken });
    // The emulator records outgoing emails locally instead of sending them.
    const pending = await fetch(`${auth}/emulator/v1/projects/demo-noesis-rules/oobCodes`).then((response) => response.json());
    const oobCode = emailLink.oobCode || pending.oobCodes?.find((entry) => entry.email === email)?.oobCode;
    assert.ok(oobCode, 'Emulator verification code was not found');
    await emulatorRequest('update', { oobCode });
    const verified = await emulatorRequest('signInWithPassword', { email, password, returnSecureToken: true });
    const status = await request(verified.idToken);
    assert.equal(status.status, 200);
    assert.equal(status.body.configured, false, 'Refusing to run: local provider must be disabled');
    assert.equal((await request(verified.idToken, 'POST', {})).body.code, 'invalid_request');
    const oversized = await request(verified.idToken, 'POST', {
      ...sample, itemMemory: Array(9).fill('x'.repeat(4_000)),
    });
    assert.equal(oversized.status, 413);
    assert.equal(oversized.body.code, 'context_too_large');
    const atLimit = await request(verified.idToken, 'POST', {
      ...sample, itemMemory: Array(8).fill('x'.repeat(4_000)), userPrompt: 'What is unresolved?',
    });
    assert.equal(atLimit.status, 503);
    assert.equal(atLimit.body.code, 'ai_not_configured', 'Valid context at the limit must reach the provider-configuration check.');
    const wrongScope = await request(verified.idToken, 'POST', { ...sample, scope: 'selected_period' });
    assert.equal(wrongScope.status, 400);
    assert.equal(wrongScope.body.code, 'invalid_request');
    const disconnected = await request(verified.idToken, 'POST', sample);
    assert.equal(disconnected.status, 503, disconnected.body.error);
    assert.equal(disconnected.body.code, 'ai_not_configured');
    console.log('Contextual AI HTTP smoke passed: auth, verified email, context limit, scope, and disconnected provider.');
  } finally {
    const current = await emulatorRequest('signInWithPassword', { email, password, returnSecureToken: true });
    await emulatorRequest('delete', { idToken: current.idToken });
  }
}

if (process.argv.includes('--serve')) {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-noesis-rules');
  assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'demo-noesis-rules');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9198');
  const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', '9101'], {
    env: { ...process.env, GEMINI_API_KEY: ' ', NOESIS_REQUIRE_APP_CHECK: 'false' },
    stdio: 'inherit',
  });
  const closed = once(server, 'close');
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40 && server.exitCode === null; attempt++) {
      try {
        const response = await fetch(api, { signal: AbortSignal.timeout(500) });
        ready = response.status === 401;
      } catch {
        await delay(250);
      }
      if (ready) break;
    }
    assert.ok(ready && server.exitCode === null, 'The isolated production server did not start.');
    await smoke();
  } finally {
    server.kill();
    await closed;
  }
} else {
  await smoke();
}
