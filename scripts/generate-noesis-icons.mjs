import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const path = name => fileURLToPath(new URL('../' + name, import.meta.url));
const mark = (await readFile(path('public/noesis-favicon.svg'), 'utf8'))
  .replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const paper = '#fcf2e2';

function svg(size, inset = 0, background = 'none', round = false) {
  const scale = 1 - inset * 2 / 64;
  const back = round ? `<circle cx="32" cy="32" r="32" fill="${background}"/>`
    : `<rect width="64" height="64" fill="${background}"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${back}<g transform="translate(${inset} ${inset}) scale(${scale})">${mark}</g></svg>`);
}
const png = (destination, ...options) => sharp(svg(...options)).png().toFile(path(destination));

await png('src/app/icon.png', 48);
await png('public/noesis-install-icon.png', 512, 2);
await png('public/noesis-maskable-icon.png', 512, 12, paper);
await png('public/noesis-apple-icon.png', 180, 7, paper);

for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  const folder = 'android/app/src/main/res/mipmap-' + density + '/';
  await png(folder + 'ic_launcher.png', size, 7, paper);
  await png(folder + 'ic_launcher_round.png', size, 10, paper, true);
  await png(folder + 'ic_launcher_foreground.png', size * 2.25, 14.5);
}
