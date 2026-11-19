import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const image = await sharp(Buffer.from('<svg width="800" height="110"><rect width="800" height="110" fill="white"/><text x="20" y="70" font-size="44">Ideas need evidence.</text></svg>')).png().toBuffer();
const worker = await createWorker('eng', 1, { langPath: 'public/ocr', cacheMethod: 'none' });
try {
  const { data } = await worker.recognize(image);
  assert.match(data.text, /ideas need evidence/i);
  console.log('Recognized the synthetic page using the bundled English model.');
} finally { await worker.terminate(); }

