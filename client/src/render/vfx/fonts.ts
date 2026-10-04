// Bitmap fonts for world-space labels (loot labels, nameplates): installed once, rendered as batched
// glyph quads. Baked at 2× the display size and drawn at half scale so they stay crisp on HiDPI.

import { BitmapFont } from 'pixi.js';

/** Alegreya Sans Bold, white, soft shadow — labels on a dark backdrop (tint per rarity). */
export const LABEL_FONT = 'HF-Label';
/** Alegreya Sans Bold, white with a dark outline — floating names over the world (tint per class / tier). */
export const PLATE_FONT = 'HF-Plate';

const FAMILY = '"Alegreya Sans", "Trebuchet MS", "Segoe UI", sans-serif';
const CHARS: (string | string[])[] = [[' ', '~'], 'ÀÁÂÄÆÇÈÉÊËÌÍÎÏÑÒÓÔÖÙÚÛÜßàáâäæçèéêëìíîïñòóôöùúûüÿ’‘“”·•—–…'];

let installed = false;

export function ensureFonts(): void {
  if (installed) return;
  installed = true;
  BitmapFont.install({
    name: LABEL_FONT,
    chars: CHARS,
    resolution: 1,
    padding: 4,
    style: {
      fontFamily: FAMILY, fontWeight: '700', fontSize: 26, fill: '#ffffff',
      dropShadow: { color: '#000000', alpha: 0.7, blur: 2, distance: 2, angle: Math.PI / 2 },
    },
  });
  BitmapFont.install({
    name: PLATE_FONT,
    chars: CHARS,
    resolution: 1,
    padding: 6,
    style: {
      fontFamily: FAMILY, fontWeight: '700', fontSize: 26, fill: '#ffffff',
      stroke: { color: '#140c08', width: 6, join: 'round' },
    },
  });
}
