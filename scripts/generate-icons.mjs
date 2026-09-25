// Rasterises public/icon.svg into the PNG sizes the PWA manifest and iOS need.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const svg = readFileSync(resolve(root, 'public/icon.svg'));

const targets = [
  ['pwa-64x64.png', 64],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon-180x180.png', 180],
];

for (const [name, size] of targets) {
  await sharp(svg).resize(size, size).png().toFile(resolve(root, 'public', name));
  console.log('wrote', name);
}

// Maskable icons are cropped to a circle/squircle by the OS: keep the artwork inside the safe zone
const maskable = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b1220' } })
  .composite([{ input: maskable, gravity: 'centre' }])
  .png()
  .toFile(resolve(root, 'public/maskable-icon-512x512.png'));
console.log('wrote maskable-icon-512x512.png');
