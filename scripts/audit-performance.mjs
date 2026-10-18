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

let failed = false;
for (const [route, budgetKb] of Object.entries(routeBudgets)) {
  const files = manifest.pages?.[route];
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
