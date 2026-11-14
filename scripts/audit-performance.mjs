import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const nextDir = process.env.NOESIS_BUILD_DIST_DIR || '.next';
const legacyManifestPath = path.join(nextDir, 'app-build-manifest.json');
const manifestPath = existsSync(legacyManifestPath) ? legacyManifestPath : path.join(nextDir, 'build-manifest.json');

if (!existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}. Run npm run build before npm run audit:performance.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const routeMapPath = path.join(nextDir, 'app-path-routes-manifest.json');
const routeMap = existsSync(routeMapPath) ? JSON.parse(readFileSync(routeMapPath, 'utf8')) : {};
const routeBudgets = {
  '/home/page': 400,
  '/atlas/page': 400,
  '/library/page': 400,
  '/positions/page': 400,
  '/works/page': 400,
  '/p/[slug]/page': 450,
};

function assetPaths(files) {
  return new Set(files.map((reference) => {
    const file = reference.replace(/^\/_next\//, '');
    const literalPath = path.join(nextDir, file);
    return existsSync(literalPath) ? literalPath : path.join(nextDir, decodeURIComponent(file));
  }));
}

function measureAssets(files) {
  const assets = [...assetPaths(files)].map((assetPath) => ({
    name: path.relative(nextDir, assetPath).split(path.sep).join('/'),
    bytes: statSync(assetPath).size,
  }));
  return { assets, bytes: assets.reduce((total, asset) => total + asset.bytes, 0) };
}

function documentAssetSizes(route) {
  const file = path.join(nextDir, 'server', 'app', `${route.slice(1).replace(/\/page$/, '')}.html`);
  if (!existsSync(file)) return null;
  const html = readFileSync(file, 'utf8');
  const modern = [];
  const legacy = [];
  // Next emits double-quoted asset attributes in its generated HTML.
  for (const tag of html.matchAll(/<(?:script|link)\b[^>]+>/gi)) {
    const markup = tag[0];
    const asset = markup.match(/\b(?:src|href)="\/_next\/(static\/[^"?#]+\.(?:js|css))(?:[?#][^"]*)?"/i)?.[1];
    if (asset) (/\bnomodule(?:\s|=|>)/i.test(markup) ? legacy : modern).push(asset);
  }
  if (!modern.length) throw new Error('No generated JS or CSS references were found.');
  const { assets, bytes } = measureAssets(modern);
  let gzipBytes = 0;
  for (const asset of assetPaths(modern)) {
    const content = readFileSync(asset);
    gzipBytes += gzipSync(content).length;
  }
  const legacyBytes = [...assetPaths(legacy)].reduce((total, asset) => total + statSync(asset).size, 0);
  return { assets, bytes, gzipBytes, legacyBytes };
}

function routeFiles(route) {
  const legacyFiles = manifest.pages?.[route];
  if (legacyFiles?.length) return legacyFiles;

  const routeKey = Object.keys(routeMap).find((key) => routeMap[key] === route.replace(/\/page$/, '')) || route;
  const routePath = routeKey.replace(/^\//, '').replace(/\/page$/, '');
  const referencePath = path.join(nextDir, 'server', 'app', routePath, 'page_client-reference-manifest.js');
  if (!existsSync(referencePath)) return null;

  const source = readFileSync(referencePath, 'utf8');
  const marker = `globalThis.__RSC_MANIFEST[${JSON.stringify(routeKey)}]`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;

  try {
    const assignment = source.slice(markerIndex + marker.length).trimStart();
    if (!assignment.startsWith('=')) return null;
    const routeManifest = JSON.parse(assignment.slice(1).trim().replace(/;$/, ''));
    const chunks = Object.values(routeManifest.clientModules || {}).flatMap((module) => module.chunks || [])
      .filter((chunk) => {
        if (typeof chunk !== 'string' || /^\d+$/.test(chunk)) return false;
        // Webpack can include explicit app entries from sibling route groups.
        // Keep unnamed/shared chunks; filter only entries with identifiable ownership.
        const entry = chunk.replace(/^\/_next\//, '').match(/^static\/chunks\/app\/(.*?)(page|layout)-[^/]+\.js$/);
        if (!entry) return true;
        const segment = decodeURIComponent(entry[1]).replace(/\/$/, '');
        return entry[2] === 'page' ? segment === routePath
          : !segment || routePath === segment || routePath.startsWith(`${segment}/`);
      });
    // Next can list entries from sibling routes in the same client manifest.
    // Only the current page and its ancestor segments supply document CSS.
    const css = Object.entries(routeManifest.entryCSSFiles || {}).flatMap(([entry, files]) => {
      const appEntry = entry.replace(/\\/g, '/').split('/app/').at(-1);
      const lastSlash = appEntry.lastIndexOf('/');
      const segment = appEntry.slice(0, Math.max(0, lastSlash));
      const name = appEntry.slice(lastSlash + 1);
      const onRoute = name === 'page'
        ? appEntry === `${routePath}/page`
        : (!segment || routePath === segment || routePath.startsWith(`${segment}/`));
      return onRoute ? files.filter((file) => !file.inlined).map((file) => file.path) : [];
    });
    return [...new Set([...(manifest.rootMainFiles || []), ...chunks, ...css])];
  } catch {
    return null;
  }
}

let failed = false;
if (manifest.rootMainFiles?.length) {
  try {
    const baseline = measureAssets(manifest.rootMainFiles);
    console.log(`Shared framework startup: ${Math.round(baseline.bytes / 1024)} KB raw before route assets`);
  } catch (error) {
    console.error(`Cannot measure shared framework startup: ${error.message}`);
    failed = true;
  }
}
for (const [route, budgetKb] of Object.entries(routeBudgets)) {
  const files = routeFiles(route);
  if (!files) {
    console.error(`Missing route ${route} in ${manifestPath}.`);
    failed = true;
    continue;
  }

  let manifestAssets;
  let sizes;
  try {
    manifestAssets = measureAssets(files);
    sizes = documentAssetSizes(route);
  } catch (error) {
    console.error(`Cannot measure ${route}: ${error.message}`);
    failed = true;
    continue;
  }
  const measured = sizes && sizes.bytes > manifestAssets.bytes ? sizes : manifestAssets;
  const startupKb = measured.bytes / 1024;
  const overBudget = startupKb > budgetKb;
  const status = overBudget ? 'FAIL' : 'PASS';
  console.log(`${status} ${route}: ${Math.round(startupKb)} KB / ${budgetKb} KB`);
  if (overBudget) {
    failed = true;
    const source = measured === sizes ? 'document' : 'manifest';
    const largest = [...measured.assets].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
    console.log(`  Largest ${source} assets: ${largest.map(({ name, bytes }) => `${name} (${Math.round(bytes / 1024)} KB)`).join(', ')}`);
  }
  if (sizes) {
    const kib = (bytes) => Math.round(bytes / 1024);
    console.log(`  Prerendered document assets: ${kib(sizes.bytes)} KB modern raw / ${kib(sizes.gzipBytes)} KB estimated gzip; ${kib(sizes.legacyBytes)} KB legacy-only raw`);
  }
}

if (failed) process.exit(1);
