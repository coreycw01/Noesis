import { copyFile, mkdir } from 'node:fs/promises';
const target = new URL('../public/ocr/', import.meta.url);
await mkdir(target, { recursive: true });
for (const [source, name] of [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'core.wasm.js'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]) await copyFile(new URL('../node_modules/' + source, import.meta.url), new URL(name, target));

