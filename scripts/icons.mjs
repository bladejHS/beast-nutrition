// Renders every picture of the mark from its vector geometry (scripts/mark.mjs): node scripts/icons.mjs
// The family's mark (2026-11-08): Inner Beast's "Umbra" wolf with this app's blue light. It replaces the white brush
// wolf on blue, which did not match Inner Beast and lost its outline at the small sizes. Each picture uses the
// optical size it is seen at: medium for the app icons, small for the browser tab and the header, large for the opening.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { svg } from './mark.mjs';

const png = (s) => sharp(Buffer.from(s));

const icons = [
  // file, pixels, optical size, how much of the canvas the head takes
  ['public/icon-512.png', 512, 'medium', 0.76],
  ['public/icon-192.png', 192, 'medium', 0.76],
  ['public/apple-touch-icon.png', 180, 'medium', 0.76],
  ['public/icon-maskable-512.png', 512, 'medium', 0.56], // inside the 80 % circle Android may cut to
  ['public/favicon-32.png', 32, 'small', 0.86],
];
for (const [file, px, size, k] of icons) {
  await png(svg({ px, size, k })).png().toFile(file);
  console.log('wrote', file);
}

// favicon.ico for the browsers that ask for it: one 32 px PNG inside an ICO header
const p32 = await png(svg({ px: 32, size: 'small', k: 0.86 })).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(p32.length, 14); ico.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([ico, p32]));
console.log('wrote public/favicon.ico');

// the browser tab: the real vector, rounded like the app icon
writeFileSync('public/icon.svg', svg({ px: 512, size: 'small', k: 0.84, rx: 52 }));
console.log('wrote public/icon.svg');

// the header (30 px) and the setup screen (72 px): the head alone, no field
writeFileSync('public/ui/mark.svg', svg({ px: 60, size: 'small', bg: false, k: 0.98 }));
console.log('wrote public/ui/mark.svg');

// the opening: the large head on the 680 × 801 canvas the page reserves
await png(svg({ px: 680, w: 680, h: 801, size: 'large', bg: false, k: 1.15 })).webp({ quality: 90, alphaQuality: 100 }).toFile('public/splash/umbra.webp');
console.log('wrote public/splash/umbra.webp');
