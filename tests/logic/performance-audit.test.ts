import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('performance audit reads current build manifests and counts shared runtime bytes', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'noesis-build-audit-'));
  try {
    writeFileSync(path.join(fixture, 'build-manifest.json'), JSON.stringify({ rootMainFiles: ['runtime.js'] }));
    writeFileSync(path.join(fixture, 'runtime.js'), 'x'.repeat(500 * 1024));
    for (const name of ['home', 'atlas', 'library', 'positions', 'works', 'p/[slug]']) {
      const directory = path.join(fixture, 'server/app', name);
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, 'page_client-reference-manifest.js'), `globalThis.__RSC_MANIFEST[${JSON.stringify(`/${name}/page`)}]={"clientModules":{},"entryCSSFiles":{}};`);
    }
    const result = spawnSync(process.execPath, ['scripts/audit-performance.mjs'], { encoding: 'utf8', env: { ...process.env, NOESIS_BUILD_DIST_DIR: fixture } });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /FAIL \/home\/page: 500 KB \/ 400 KB/);
    assert.doesNotMatch(result.stderr, /Missing/);
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(tmpdir()));
    rmSync(fixture, { recursive: true, force: true });
  }
});
