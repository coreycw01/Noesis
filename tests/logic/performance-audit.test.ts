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
    writeFileSync(path.join(fixture, 'app-path-routes-manifest.json'), JSON.stringify({ '/(workspace)/home/page': '/home' }));
    for (const name of ['home', 'atlas', 'library', 'positions', 'works', 'p/[slug]']) {
      const internalRoute = name === 'home' ? '(workspace)/home' : name;
      const directory = path.join(fixture, 'server/app', internalRoute);
      mkdirSync(directory, { recursive: true });
      const assets = name === 'p/[slug]' ? ['42', 'public/%5Bslug%5D.js'] : [];
      writeFileSync(path.join(directory, 'page_client-reference-manifest.js'), `globalThis.__RSC_MANIFEST[${JSON.stringify(`/${internalRoute}/page`)}]=${JSON.stringify({ clientModules: { page: { chunks: assets } }, entryCSSFiles: {} })};`);
    }
    mkdirSync(path.join(fixture, 'public'));
    mkdirSync(path.join(fixture, 'static'));
    writeFileSync(path.join(fixture, 'static', 'modern.js'), 'x'.repeat(60 * 1024));
    writeFileSync(path.join(fixture, 'static', 'legacy.js'), 'x'.repeat(12 * 1024));
    writeFileSync(path.join(fixture, 'server/app/home.html'), [
      '<link rel="preload" as="script" href="/_next/static/modern.js">',
      '<script src="/_next/static/modern.js" async=""></script>',
      '<script src="/_next/static/legacy.js" noModule=""></script>',
    ].join(''));
    const asset = path.join(fixture, 'public', '[slug].js');
    writeFileSync(asset, 'x'.repeat(10 * 1024));
    const result = spawnSync(process.execPath, ['scripts/audit-performance.mjs'], { encoding: 'utf8', env: { ...process.env, NOESIS_BUILD_DIST_DIR: fixture } });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /FAIL \/home\/page: 500 KB \/ 400 KB/);
    assert.match(result.stdout, /Largest manifest assets: runtime\.js \(500 KB\)/);
    assert.match(result.stdout, /Prerendered document assets: 60 KB modern raw \/ \d+ KB estimated gzip; 12 KB legacy-only raw/);
    assert.match(result.stdout, /FAIL \/p\/\[slug\]\/page: 510 KB \/ 450 KB/);
    assert.doesNotMatch(result.stderr, /Missing/);
    rmSync(asset);
    const missing = spawnSync(process.execPath, ['scripts/audit-performance.mjs'], { encoding: 'utf8', env: { ...process.env, NOESIS_BUILD_DIST_DIR: fixture } });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Cannot measure \/p\/\[slug\]\/page/);

    writeFileSync(path.join(fixture, 'runtime.js'), 'x'.repeat(350 * 1024));
    writeFileSync(path.join(fixture, 'static', 'modern.js'), 'x'.repeat(401 * 1024));
    writeFileSync(path.join(fixture, 'server/app/p/[slug]/page_client-reference-manifest.js'),
      `globalThis.__RSC_MANIFEST["/p/[slug]/page"] = ${JSON.stringify({
        clientModules: { page: { chunks: ['/_next/static/legacy.js'] } },
        entryCSSFiles: {
          'C:\\repo\\src\\app\\layout': [{ path: 'static/public.css' }],
          'C:\\repo\\src\\app\\(workspace)\\layout': [{ path: 'static/workspace.css' }],
          'C:\\repo\\src\\app\\p\\[slug]\\page': [{ path: 'static/profile.css' }],
        },
      })};`);
    writeFileSync(path.join(fixture, 'static/public.css'), 'x'.repeat(8 * 1024));
    writeFileSync(path.join(fixture, 'static/profile.css'), 'x'.repeat(5 * 1024));
    writeFileSync(path.join(fixture, 'static/workspace.css'), 'x'.repeat(180 * 1024));
    const spaced = spawnSync(process.execPath, ['scripts/audit-performance.mjs'], { encoding: 'utf8', env: { ...process.env, NOESIS_BUILD_DIST_DIR: fixture } });
    assert.equal(spaced.status, 1);
    assert.match(spaced.stdout, /FAIL \/home\/page: 401 KB \/ 400 KB/);
    assert.match(spaced.stdout, /Largest document assets: static\/modern\.js \(401 KB\)/);
    assert.match(spaced.stdout, /Prerendered document assets: 401 KB modern raw/);
    assert.match(spaced.stdout, /PASS \/p\/\[slug\]\/page: 375 KB \/ 450 KB/);
    assert.equal(spaced.stderr, '');
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(tmpdir()));
    rmSync(fixture, { recursive: true, force: true });
  }
});
