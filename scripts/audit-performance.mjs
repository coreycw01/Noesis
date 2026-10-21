import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const nextDir = process.env.NOESIS_BUILD_DIST_DIR || '.next';
const manifestPath = path.join(nextDir, 'app-build-manifest.json');

if (!existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}. Run npm run build before npm run audit:performance.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const routeBudgets = {
  '/home/page': 400,
  '/atlas/page': 400,
  '/library/page': 400,
  '/positions/page': 400,
  '/works/page': 400,
  '/p/[slug]/page': 450,
};

function routeSizeKb(files = []) {
  const bytes = [...new Set(files)].reduce((total, file) => {
    const assetPath = path.join(nextDir, file);
    return total + (existsSync(assetPath) ? statSync(assetPath).size : 0);
  }, 0);
  return Math.round(bytes / 1024);
}

function routeFiles(route) {
  const legacyFiles = manifest.pages?.[route];
  if (legacyFiles?.length) return legacyFiles;

  const routePath = route.replace(/^\//, '').replace(/\/page$/, '');
  const referencePath = path.join(nextDir, 'server', 'app', routePath, 'page_client-reference-manifest.js');
  if (!existsSync(referencePath)) return null;

  const source = readFileSync(referencePath, 'utf8');
  const marker = `globalThis.__RSC_MANIFEST[${JSON.stringify(route)}]=`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;

  try {
    const routeManifest = JSON.parse(source.slice(markerIndex + marker.length));
    const chunks = Object.values(routeManifest.clientModules || {}).flatMap((module) => module.chunks || []);
    const css = Object.values(routeManifest.entryCSSFiles || {}).flatMap((entries) => entries.map((entry) => entry.path));
    return [...new Set([...chunks, ...css])];
  } catch {
    return null;
  }
}

let failed = false;
for (const [route, budgetKb] of Object.entries(routeBudgets)) {
  const files = routeFiles(route);
  if (!files) {
    console.error(`Missing route ${route} in ${manifestPath}.`);
    failed = true;
    continue;
  }

  const sizeKb = routeSizeKb(files);
  const status = sizeKb <= budgetKb ? 'PASS' : 'FAIL';
  console.log(`${status} ${route}: ${sizeKb} KB / ${budgetKb} KB`);
  if (sizeKb > budgetKb) failed = true;
}

if (failed) process.exit(1);
