// Hand-drawn inline SVG icons: UI glyphs, gold, crafting materials, gems and the Cube emblem.
// Every gradient id is static & content-identical so duplicated <defs> across icons are harmless.

import type { ComponentChildren } from 'preact';
import { GEMS } from '@shared/data/items';
import type { MaterialId } from '@shared/types';

// ───────────────────────────── helpers ─────────────────────────────

export const hex = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

export function mixColor(c: number, to: number, t: number): string {
  const r = Math.round(((c >> 16) & 255) * (1 - t) + ((to >> 16) & 255) * t);
  const g = Math.round(((c >> 8) & 255) * (1 - t) + ((to >> 8) & 255) * t);
  const b = Math.round((c & 255) * (1 - t) + (to & 255) * t);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
export const lighten = (c: number, t: number) => mixColor(c, 0xffffff, t);
export const darken = (c: number, t: number) => mixColor(c, 0x000000, t);

interface SvgProps { size?: number; vb?: number; class?: string; children?: ComponentChildren; title?: string }
export function Svg({ size = 16, vb = 32, class: cls, children, title }: SvgProps) {
  return (
    <svg class={cls} width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} xmlns="http://www.w3.org/2000/svg" role={title ? 'img' : 'presentation'} aria-label={title} focusable="false">
      {children}
    </svg>
  );
}

const star4 = (cx: number, cy: number, r: number, k = 0.18) =>
  `M${cx} ${cy - r} Q${cx + r * k} ${cy - r * k} ${cx + r} ${cy} Q${cx + r * k} ${cy + r * k} ${cx} ${cy + r} Q${cx - r * k} ${cy + r * k} ${cx - r} ${cy} Q${cx - r * k} ${cy - r * k} ${cx} ${cy - r} Z`;

// ───────────────────────────── UI glyphs (currentColor) ─────────────────────────────

export function IconClose({ size = 12 }: { size?: number }) {
  return (
    <Svg size={size} vb={12}>
      <path d="M2.4 2.4 L9.6 9.6 M9.6 2.4 L2.4 9.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none" />
    </Svg>
  );
}

export function IconPlus({ size = 12 }: { size?: number }) {
  return <Svg size={size} vb={12}><path d="M6 2 V10 M2 6 H10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" /></Svg>;
}
export function IconMinus({ size = 12 }: { size?: number }) {
  return <Svg size={size} vb={12}><path d="M2 6 H10" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" /></Svg>;
}

export function IconLock({ size = 12 }: { size?: number }) {
  return (
    <Svg size={size} vb={16}>
      <path d="M4.6 7 V5.2 a3.4 3.4 0 0 1 6.8 0 V7" fill="none" stroke="currentColor" stroke-width="1.7" />
      <rect x="2.8" y="7" width="10.4" height="7.4" rx="1.4" fill="currentColor" />
      <circle cx="8" cy="10.2" r="1.2" fill="#0c0907" />
      <rect x="7.5" y="10.4" width="1" height="2.4" fill="#0c0907" />
    </Svg>
  );
}

export function IconCheck({ size = 12 }: { size?: number }) {
  return <Svg size={size} vb={12}><path d="M2 6.4 L4.8 9 L10 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></Svg>;
}

export function IconChevron({ size = 10, dir = 'down' }: { size?: number; dir?: 'down' | 'up' | 'left' | 'right' }) {
  const rot = { down: 0, left: 90, up: 180, right: 270 }[dir];
  return (
    <Svg size={size} vb={10}>
      <path d="M2 3.5 L5 6.8 L8 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform={`rotate(${rot} 5 5)`} />
    </Svg>
  );
}

/** Solid triangle used by the green/red comparison deltas. */
export function IconDelta({ up, size = 9 }: { up: boolean; size?: number }) {
  return (
    <Svg size={size} vb={10}>
      <path d={up ? 'M5 1.2 L9.2 8.6 H0.8 Z' : 'M5 8.8 L9.2 1.4 H0.8 Z'} fill="currentColor" stroke="rgba(0,0,0,.55)" stroke-width=".7" stroke-linejoin="round" />
    </Svg>
  );
}

export function IconStar4({ size = 10, class: cls }: { size?: number; class?: string }) {
  return <Svg size={size} vb={12} class={cls}><path d={star4(6, 6, 6, 0.2)} fill="currentColor" /></Svg>;
}

export function IconDiamond({ size = 8, class: cls }: { size?: number; class?: string }) {
  return (
    <Svg size={size} vb={10} class={cls}>
      <path d="M5 .6 L9.4 5 L5 9.4 L.6 5 Z" fill="currentColor" stroke="rgba(0,0,0,.65)" stroke-width=".8" stroke-linejoin="round" />
    </Svg>
  );
}

export function IconArrowRight({ size = 14 }: { size?: number }) {
  return <Svg size={size} vb={14}><path d="M2 7 H11 M7.5 3.2 L11.4 7 L7.5 10.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></Svg>;
}

export function IconSkull({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size} vb={16}>
      <path d="M8 1.6 C4.4 1.6 2.6 4 2.6 6.8 C2.6 8.6 3.4 9.6 4.4 10.4 V13 H11.6 V10.4 C12.6 9.6 13.4 8.6 13.4 6.8 C13.4 4 11.6 1.6 8 1.6 Z" fill="currentColor" />
      <circle cx="5.9" cy="7.2" r="1.5" fill="#0c0907" /><circle cx="10.1" cy="7.2" r="1.5" fill="#0c0907" />
      <path d="M7.2 9.6 H8.8 L8 8.4 Z M6.4 13 V11 M8 13 V11 M9.6 13 V11" stroke="#0c0907" stroke-width="1" fill="#0c0907" />
    </Svg>
  );
}

// ───────────────────────────── Gold ─────────────────────────────

export function GoldIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size} vb={32} title="Gold">
      <defs>
        <radialGradient id="gd-coin" cx=".35" cy=".3" r=".9">
          <stop offset="0" stop-color="#fff0a8" /><stop offset=".45" stop-color="#e0b53c" /><stop offset="1" stop-color="#8a5a12" />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="18.2" rx="12.4" ry="11" fill="#5a3a0a" />
      <circle cx="16" cy="15.6" r="12.6" fill="url(#gd-coin)" stroke="#3a2406" stroke-width="1.4" />
      <circle cx="16" cy="15.6" r="9" fill="none" stroke="#8a5a12" stroke-width="1.5" />
      <circle cx="16" cy="15.6" r="9" fill="none" stroke="rgba(255,248,200,.55)" stroke-width=".7" transform="translate(-.6 -.6)" />
      <path d="M16 9.6 L20.4 15.6 L16 21.6 L11.6 15.6 Z" fill="#a8741a" stroke="#6a440a" stroke-width=".8" />
      <path d="M16 9.6 L20.4 15.6 L16 15.6 Z" fill="#f6d874" opacity=".85" />
      <path d="M7.6 8 A10.6 10.6 0 0 1 14 4.4" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.4" stroke-linecap="round" />
    </Svg>
  );
}

// ───────────────────────────── Materials ─────────────────────────────

export const MATERIAL_INFO: Record<MaterialId, { name: string; color: string; desc: string; source: string }> = {
  scrap: { name: 'Reusable Parts', color: '#c9d1d8', desc: 'Salvaged metal fittings. Fuel for upgrading plain gear.', source: 'Salvage Normal items' },
  dust: { name: 'Arcane Dust', color: '#c9a8ff', desc: 'Glittering residue of faded enchantments.', source: 'Salvage Magic items' },
  crystal: { name: 'Veiled Crystal', color: '#8fb8ff', desc: 'A shard that bends light around hidden power.', source: 'Salvage Rare items' },
  soul: { name: 'Forgotten Soul', color: '#9ff0c8', desc: 'The lingering will of a legendary relic.', source: 'Salvage Legendary and Set items' },
  deathsBreath: { name: "Death's Breath", color: '#ff8a5a', desc: 'Distilled from the last exhale of a slain elite.', source: 'Dropped by champions, rares and bosses' },
};
export const MATERIAL_ORDER: MaterialId[] = ['scrap', 'dust', 'crystal', 'soul', 'deathsBreath'];

export function MatIcon({ id, size = 22 }: { id: MaterialId; size?: number }) {
  switch (id) {
    case 'scrap': return <ScrapIcon size={size} />;
    case 'dust': return <DustIcon size={size} />;
    case 'crystal': return <CrystalIcon size={size} />;
    case 'soul': return <SoulIcon size={size} />;
    default: return <BreathIcon size={size} />;
  }
}

function ScrapIcon({ size }: { size: number }) {
  return (
    <Svg size={size} title="Reusable Parts">
      <defs>
        <linearGradient id="mt-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e6ebf0" /><stop offset=".45" stop-color="#97a1aa" /><stop offset="1" stop-color="#454c54" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="21" width="15" height="5.5" rx="1" fill="url(#mt-steel)" stroke="#16110d" stroke-width="1" transform="rotate(-12 10 24)" />
      <g transform="translate(17 14.5)">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect x="-2.5" y="-13" width="5" height="6" rx="1" fill="url(#mt-steel)" stroke="#16110d" stroke-width="1" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="9.6" fill="url(#mt-steel)" stroke="#16110d" stroke-width="1.2" />
        <circle r="6.2" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" />
        <circle r="3.5" fill="#15100c" stroke="#050403" stroke-width=".8" />
        <path d="M-7 -4 A8 8 0 0 1 -1 -8.2" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.3" stroke-linecap="round" />
      </g>
    </Svg>
  );
}

function DustIcon({ size }: { size: number }) {
  return (
    <Svg size={size} title="Arcane Dust">
      <defs>
        <linearGradient id="mt-dust" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ead9ff" /><stop offset=".4" stop-color="#a97cf0" /><stop offset="1" stop-color="#4a2a8e" />
        </linearGradient>
      </defs>
      <path d="M2.5 27 C5 24 9 22.4 12 18 C13.6 15.6 14.6 12.6 16 11 C17.4 12.6 18.4 15.6 20 18 C23 22.4 27 24 29.5 27 C24 29.2 8 29.2 2.5 27 Z" fill="url(#mt-dust)" stroke="#1d0f3a" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M16 11 C14.6 12.6 13.6 15.6 12 18 C10.6 20 9 21.2 7.4 22.4" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1" stroke-linecap="round" />
      {[[10, 25], [14, 22.5], [19, 24.5], [22.5, 22.6], [16.5, 19], [12.2, 20], [24.5, 26], [7, 26]].map(([x, y]) => <circle cx={x} cy={y} r=".9" fill="#f6ecff" opacity=".9" />)}
      <path d={star4(21, 8, 4.6)} fill="#fff" opacity=".95" />
      <path d={star4(9, 12, 3.2)} fill="#e6d4ff" opacity=".9" />
      <path d={star4(26.5, 15, 2.4)} fill="#d8c0ff" opacity=".85" />
    </Svg>
  );
}

function CrystalIcon({ size }: { size: number }) {
  return (
    <Svg size={size} title="Veiled Crystal">
      <defs>
        <linearGradient id="mt-cr-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dff0ff" /><stop offset="1" stop-color="#6e9cff" /></linearGradient>
        <linearGradient id="mt-cr-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6c86f0" /><stop offset="1" stop-color="#2a2f9c" /></linearGradient>
      </defs>
      <path d="M5 28 L2.6 17.6 L6.4 11 L10.6 18 L10.6 28 Z" fill="#4c63d8" stroke="#10133a" stroke-width="1" stroke-linejoin="round" />
      <path d="M5 28 L2.6 17.6 L6.4 11 L6.4 28 Z" fill="#8eb0ff" opacity=".7" />
      <path d="M27 29 L22 27 L22.4 17 L26.6 11.4 L29.6 18 Z" fill="#3a46b8" stroke="#10133a" stroke-width="1" stroke-linejoin="round" />
      <path d="M26.6 11.4 L22.4 17 L22 27 L26 28.4 Z" fill="#7d9bff" opacity=".6" />
      <path d="M16 2 L22.6 9 L22 24 L16 30 L10 24 L9.4 9 Z" fill="url(#mt-cr-r)" stroke="#10133a" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M16 2 L9.4 9 L10 24 L16 30 Z" fill="url(#mt-cr-l)" />
      <path d="M16 2 L22.6 9 L16 11 L9.4 9 Z" fill="#fff" opacity=".55" />
      <path d="M16 11 L16 30 M9.4 9 L16 11 L22.6 9" fill="none" stroke="rgba(16,19,58,.55)" stroke-width=".9" />
      <path d="M11.4 12 L11.8 22" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".8" />
    </Svg>
  );
}

function SoulIcon({ size }: { size: number }) {
  return (
    <Svg size={size} title="Forgotten Soul">
      <defs>
        <radialGradient id="mt-soul" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" /><stop offset=".5" stop-color="#b6f8d6" /><stop offset="1" stop-color="#3fbf8c" /></radialGradient>
        <filter id="mt-soul-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <path d="M16 3 C23 3 26.4 9.6 25 17 C24.4 20.4 26.6 24 24.6 28.6 C22.8 26.6 21 28.6 19.2 27 C17.6 29 14.4 29 12.8 27 C11 28.6 9.2 26.6 7.4 28.6 C5.4 24 7.6 20.4 7 17 C5.6 9.6 9 3 16 3 Z" fill="#46ffb4" opacity=".55" filter="url(#mt-soul-glow)" />
      <path d="M16 3 C23 3 26.4 9.6 25 17 C24.4 20.4 26.6 24 24.6 28.6 C22.8 26.6 21 28.6 19.2 27 C17.6 29 14.4 29 12.8 27 C11 28.6 9.2 26.6 7.4 28.6 C5.4 24 7.6 20.4 7 17 C5.6 9.6 9 3 16 3 Z" fill="url(#mt-soul)" stroke="#0f4a36" stroke-width="1.1" stroke-linejoin="round" />
      <ellipse cx="12.4" cy="13" rx="2.1" ry="2.9" fill="#0b3a2a" /><ellipse cx="19.6" cy="13" rx="2.1" ry="2.9" fill="#0b3a2a" />
      <ellipse cx="12" cy="12" rx=".7" ry="1" fill="#c8ffe6" /><ellipse cx="19.2" cy="12" rx=".7" ry="1" fill="#c8ffe6" />
      <ellipse cx="16" cy="19.4" rx="2" ry="2.6" fill="#0b3a2a" />
      <path d="M10.4 6.4 C12 4.8 14 4.2 15.6 4.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".85" />
    </Svg>
  );
}

function BreathIcon({ size }: { size: number }) {
  return (
    <Svg size={size} title="Death's Breath">
      <defs>
        <radialGradient id="mt-br-liq" cx=".4" cy=".35" r=".85"><stop offset="0" stop-color="#ffd0a0" /><stop offset=".35" stop-color="#ff6a3a" /><stop offset="1" stop-color="#7a0e1a" /></radialGradient>
        <linearGradient id="mt-br-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,.55)" /><stop offset=".3" stop-color="rgba(255,255,255,.08)" /><stop offset="1" stop-color="rgba(255,255,255,.22)" /></linearGradient>
        <filter id="mt-br-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>
      <circle cx="16" cy="20" r="9.6" fill="#ff5a2a" opacity=".5" filter="url(#mt-br-glow)" />
      <path d="M12.6 8.6 H19.4 V12.4 C24 14 26.4 17.4 26.4 21 C26.4 25.6 22 29 16 29 C10 29 5.6 25.6 5.6 21 C5.6 17.4 8 14 12.6 12.4 Z" fill="url(#mt-br-liq)" stroke="#2a0a0c" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M9 22 C12 18 14 24 17 20 C19.6 17 22 21 24 18.4 C24.6 20 24.8 22 23.4 24.6 C20 28 12 28 9 24 Z" fill="#2a0408" opacity=".4" />
      <path d="M13 21 C14 17 18 19.4 17.4 15.6 C19.6 17.6 18.6 21.6 16.6 22.8" fill="none" stroke="#ffe0b8" stroke-width="1.1" stroke-linecap="round" opacity=".85" />
      <path d="M12.6 8.6 H19.4 V12.4 C24 14 26.4 17.4 26.4 21 C26.4 25.6 22 29 16 29 C10 29 5.6 25.6 5.6 21 C5.6 17.4 8 14 12.6 12.4 Z" fill="url(#mt-br-glass)" />
      <rect x="11.6" y="3" width="8.8" height="6.2" rx="1.4" fill="#8a5a30" stroke="#2a1a0c" stroke-width="1.1" />
      <path d="M12.4 5 H19.6" stroke="#c89a62" stroke-width="1" />
      <path d="M8.6 17.6 C9.4 15.6 11 14.4 12.4 13.8" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".8" />
    </Svg>
  );
}

// ───────────────────────────── Gems ─────────────────────────────

interface Facet { pts: [number, number][]; k: number }

/** Top-down faceted gem: outer n-gon, inner table, lit from the top-left. */
function brilliant(n: number, rot: number, sx: number, sy: number, R = 13, r = 6.2): { outline: string; facets: Facet[]; table: string } {
  const pt = (rad: number, i: number): [number, number] => {
    const a = rot + (i * Math.PI * 2) / n;
    return [16 + Math.cos(a) * rad * sx, 16 + Math.sin(a) * rad * sy];
  };
  const facets: Facet[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = pt(R, i), a1 = pt(R, i + 1), b1 = pt(r, i + 1), b0 = pt(r, i);
    const mid = rot + ((i + 0.5) * Math.PI * 2) / n;
    const light = Math.cos(mid - (-Math.PI * 0.75)); // light from upper-left
    facets.push({ pts: [a0, a1, b1, b0], k: light });
  }
  const outline = Array.from({ length: n }, (_, i) => pt(R, i).map((v) => v.toFixed(2)).join(',')).join(' ');
  const table = Array.from({ length: n }, (_, i) => pt(r, i).map((v) => v.toFixed(2)).join(',')).join(' ');
  return { outline, facets, table };
}

const GEM_CUTS: Record<string, () => { outline: string; facets: Facet[]; table: string }> = {
  ruby: () => brilliant(4, Math.PI / 4, 1.0, 1.0, 13.4, 6.4),
  emerald: () => brilliant(8, Math.PI / 8, 0.8, 1.06, 13, 6.2),
  topaz: () => brilliant(12, 0, 1, 1, 13.2, 6),
  amethyst: () => brilliant(6, Math.PI / 6, 1, 1, 13.6, 6.4),
};

export function gemColor(gem: string): number {
  return GEMS[gem]?.color ?? 0xcccccc;
}

export function GemIcon({ gem, size = 22 }: { gem: string; size?: number }) {
  const color = gemColor(gem);
  if (gem === 'diamond') return <DiamondIcon size={size} color={color} />;
  const cut = (GEM_CUTS[gem] ?? GEM_CUTS.ruby)();
  return (
    <Svg size={size} title={GEMS[gem]?.name}>
      <defs>
        <filter id="gm-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.8" /></filter>
      </defs>
      <polygon points={cut.outline} fill={hex(color)} opacity=".45" filter="url(#gm-glow)" />
      <polygon points={cut.outline} fill={darken(color, 0.55)} stroke="#0b0807" stroke-width="1.4" stroke-linejoin="round" />
      {cut.facets.map((f) => (
        <polygon points={f.pts.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ')} fill={f.k > 0 ? lighten(color, Math.min(0.62, 0.12 + f.k * 0.5)) : darken(color, Math.min(0.5, 0.05 - f.k * 0.35))} stroke="rgba(0,0,0,.28)" stroke-width=".5" stroke-linejoin="round" />
      ))}
      <polygon points={cut.table} fill={hex(color)} stroke="rgba(0,0,0,.3)" stroke-width=".5" />
      <polygon points={cut.table} fill="url(#gm-sheen)" />
      <defs><linearGradient id="gm-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62" /><stop offset=".55" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".22" /></linearGradient></defs>
      <path d={star4(11.4, 11.2, 3.2, 0.16)} fill="#fff" opacity=".92" />
    </Svg>
  );
}

function DiamondIcon({ size, color }: { size: number; color: number }) {
  const c = color;
  return (
    <Svg size={size} title="Diamond">
      <defs><filter id="gm-glow2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.8" /></filter></defs>
      <path d="M8 6 H24 L30 13 L16 29 L2 13 Z" fill="#aee8ff" opacity=".5" filter="url(#gm-glow2)" />
      <path d="M8 6 H24 L30 13 L16 29 L2 13 Z" fill={darken(c, 0.5)} stroke="#0b0807" stroke-width="1.4" stroke-linejoin="round" />
      <path d="M8 6 L12.5 13 L2 13 Z" fill={lighten(c, 0.1)} />
      <path d="M8 6 H16 L12.5 13 Z" fill="#ffffff" />
      <path d="M16 6 H24 L19.5 13 Z" fill={lighten(c, 0.2)} />
      <path d="M24 6 L30 13 H19.5 Z" fill={darken(c, 0.12)} />
      <path d="M2 13 H12.5 L16 29 Z" fill={darken(c, 0.22)} />
      <path d="M12.5 13 H19.5 L16 29 Z" fill={lighten(c, 0.35)} />
      <path d="M19.5 13 H30 L16 29 Z" fill={darken(c, 0.38)} />
      <path d="M8 6 H24 L30 13 L16 29 L2 13 Z M2 13 H30 M8 6 L12.5 13 L16 6 L19.5 13 L24 6" fill="none" stroke="rgba(20,40,60,.4)" stroke-width=".6" stroke-linejoin="round" />
      <path d={star4(10.5, 9.4, 3.4, 0.16)} fill="#fff" />
    </Svg>
  );
}

export function EmptySocketIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size} title="Empty socket">
      <defs>
        <radialGradient id="sk-well" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#050302" /><stop offset=".7" stop-color="#17100a" /><stop offset="1" stop-color="#3a2a18" /></radialGradient>
        <linearGradient id="sk-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9b46a" /><stop offset=".5" stop-color="#7a5a2a" /><stop offset="1" stop-color="#3a2810" /></linearGradient>
      </defs>
      <circle cx="16" cy="16" r="12.6" fill="url(#sk-ring)" stroke="#0b0807" stroke-width="1.2" />
      <circle cx="16" cy="16" r="9" fill="url(#sk-well)" stroke="#000" stroke-width="1" />
      <path d="M9.4 12.6 A8 8 0 0 1 15 8" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.3" stroke-linecap="round" />
    </Svg>
  );
}

// ───────────────────────────── Cube emblem ─────────────────────────────

export function CubeEmblem({ size = 48, glow = true, class: cls }: { size?: number; glow?: boolean; class?: string }) {
  return (
    <Svg size={size} vb={48} class={cls} title="The Cube">
      <defs>
        <linearGradient id="cb-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1d48a" /><stop offset="1" stop-color="#9a6a2e" /></linearGradient>
        <linearGradient id="cb-left" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8c5f2a" /><stop offset="1" stop-color="#4a2e12" /></linearGradient>
        <linearGradient id="cb-right" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5e3b18" /><stop offset="1" stop-color="#26150a" /></linearGradient>
        <filter id="cb-blur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      {glow && <path d="M24 4 L42 14 V34 L24 44 L6 34 V14 Z" fill="#ffb347" opacity=".55" filter="url(#cb-blur)" class="cube-glow" />}
      <path d="M6 14 L24 24 V44 L6 34 Z" fill="url(#cb-left)" stroke="#120a04" stroke-width="1.4" stroke-linejoin="round" />
      <path d="M24 24 L42 14 V34 L24 44 Z" fill="url(#cb-right)" stroke="#120a04" stroke-width="1.4" stroke-linejoin="round" />
      <path d="M24 4 L42 14 L24 24 L6 14 Z" fill="url(#cb-top)" stroke="#120a04" stroke-width="1.4" stroke-linejoin="round" />
      <path d="M24 9.5 L33 14 L24 18.5 L15 14 Z" fill="none" stroke="#5a3a14" stroke-width="1.1" />
      <path d="M10 18.6 L20 24.2 M10 22.4 L20 28 M10 26 L14.4 28.6" stroke="#ffcf7a" stroke-width="1.3" stroke-linecap="round" fill="none" class="cube-rune" />
      <path d="M38 18.6 L28 24.2 M38 22.6 V30 M33 25 V33.6" stroke="#ffcf7a" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".75" class="cube-rune" />
      <path d="M6 14 L24 24 L42 14 M24 24 V44" stroke="#ffd98a" stroke-width=".9" fill="none" opacity=".7" />
      <path d="M24 4 L42 14 V34 L24 44 L6 34 V14 Z" fill="none" stroke="#d9b46a" stroke-width="1" opacity=".9" stroke-linejoin="round" />
    </Svg>
  );
}

/** A glossy bronze medallion used for Cube / Paragon level badges. */
export function Medallion({ children, size = 44, tone = 'gold' }: { children: ComponentChildren; size?: number; tone?: 'gold' | 'violet' }) {
  return (
    <div class={`medallion ${tone}`} style={{ width: size, height: size }}>
      <span>{children}</span>
    </div>
  );
}
