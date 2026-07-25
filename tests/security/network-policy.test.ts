import assert from 'node:assert/strict';
import test from 'node:test';
import { isBlockedHostname, isPublicInternetAddress } from '../../src/lib/security/network-policy';

test('blocks private, metadata, mapped, multicast, and reserved addresses', () => {
  [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '224.0.0.1',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
  ].forEach((address) => assert.equal(isPublicInternetAddress(address), false, address));
});

test('allows ordinary public addresses', () => {
  assert.equal(isPublicInternetAddress('8.8.8.8'), true);
  assert.equal(isPublicInternetAddress('2606:4700:4700::1111'), true);
});

test('blocks internal hostname forms', () => {
  ['localhost', 'api.localhost', 'printer.local', 'service.internal', 'metadata.google.internal']
    .forEach((hostname) => assert.equal(isBlockedHostname(hostname), true, hostname));
  assert.equal(isBlockedHostname('example.com'), false);
});
