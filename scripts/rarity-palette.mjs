// Colour-vision rarity palettes (F-SET-03): measured, not picked by eye. For each simulated colour-vision type
// (Machado, Oliveira & Fernandes 2009, severity 1.0 — the model the lead used in docs/rework/TOOLTIP.md §4) this
// searches OKLCH colours inside each rarity's hue family for the set whose worst pair is most separated (OKLab ΔE×100),
// keeping every colour ≥ 4.5:1 against the tooltip ink and the normal-vision worst pair ≥ 15 (the dataviz floor).
// "Normal" may move only among near-neutral light colours. Deterministic (seeded). Prints CSS token overrides and a table.
//
//   node scripts/rarity-palette.mjs            search and print
//   node scripts/rarity-palette.mjs --check    only measure the palettes in client/src/game/colorVision.ts values below

const INK = '#0f0c09';
const BASE = { normal: '#e6dfd0', magic: '#7a9cff', rare: '#f2d43c', legendary: '#ef6c2a', set: '#34c79a' };
const FAMILY = { normal: [0, 360], magic: [215, 300], rare: [75, 112], legendary: [25, 62], set: [135, 205] };
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = x => Math.min(1, Math.max(0, x));
const lin = h => hex2rgb(h).map(toLin);
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklchToLin(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const inGamut = rgb => rgb.every(c => c >= -0.0005 && c <= 1.0005);
const linToHex = rgb => '#' + rgb.map(c => Math.round(clamp01(toSrgb(clamp01(c))) * 255).toString(16).padStart(2, '0')).join('');
const sim = (rgbLin, type) => (type === 'normal' ? rgbLin : MACHADO[type].map(row => clamp01(row[0] * rgbLin[0] + row[1] * rgbLin[1] + row[2] * rgbLin[2])));
const dE = (a, b, type) => { const p = oklab(sim(lin(a), type)), q = oklab(sim(lin(b), type)); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100; };
const lum = h => { const [r, g, b] = lin(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const KEYS = ['normal', 'magic', 'rare', 'legendary', 'set'];
export function worst(p, type) {
  let w = Infinity, pair = '';
  for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++) { const d = dE(p[KEYS[i]], p[KEYS[j]], type); if (d < w) { w = d; pair = `${KEYS[i]}–${KEYS[j]}`; } }
  return { w, pair };
}
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32; }

function search(type) {
  const r = rng(type.length * 7919 + 17);
  const cand = key => {
    for (let t = 0; t < 200; t++) {
      const [h0, h1] = FAMILY[key], h = h0 + r() * (h1 - h0);
      // Normal stays a near-neutral light text colour; the rarities keep their hue family.
      const L = key === 'normal' ? 0.86 + r() * 0.1 : 0.62 + r() * 0.3, C = key === 'normal' ? r() * 0.025 : 0.07 + r() * 0.16;
      const rgb = oklchToLin(L, C, h);
      if (!inGamut(rgb)) continue;
      const hex = linToHex(rgb);
      if (contrast(hex, INK) >= 4.5) return hex;
    }
    return BASE[key];
  };
  // Full-colour readers must still tell every pair apart (dataviz normal-vision floor 15).
  const valid = p => worst(p, 'normal').w >= 15;
  let best = null, score = -1;
  for (let start = 0; start < 40; start++) {           // multi-start hill climb
    let cur;
    do { cur = Object.fromEntries(KEYS.map(k => [k, cand(k)])); } while (!valid(cur));
    let s = worst(cur, type).w;
    for (let it = 0; it < 3000; it++) {
      const next = { ...cur }, key = KEYS[Math.floor(r() * 5)];
      next[key] = cand(key);
      if (!valid(next)) continue;
      const ns = worst(next, type).w;
      if (ns > s) { cur = next; s = ns; }
    }
    if (s > score) { best = cur; score = s; }
  }
  return best;
}

const fmt = n => n.toFixed(1);
const report = (name, p) => {
  const cols = ['normal', 'protan', 'deutan', 'tritan'].map(t => `${fmt(worst(p, t).w)} (${worst(p, t).pair})`);
  const minContrast = Math.min(...KEYS.map(k => contrast(p[k], INK)));
  console.log(`${name.padEnd(9)} ${KEYS.map(k => p[k]).join(' ')}  contrast≥${minContrast.toFixed(1)}  worst ΔE: normal ${cols[0]} · protan ${cols[1]} · deutan ${cols[2]} · tritan ${cols[3]}`);
};
report('default', BASE);
const out = {};
for (const type of ['protan', 'deutan', 'tritan']) { out[type] = search(type); report(type, out[type]); }
console.log('\nPalettes:', JSON.stringify(out, null, 2));
