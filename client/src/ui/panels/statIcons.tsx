// Original icon set for character stats (24-unit grid, same drawing language as hud/UiIcons: a filled silhouette in
// currentColor with a warm-ink outline, dark detail strokes and a light highlight). Used by Paragon and any panel that
// lists stats.
import type { JSX } from 'preact';

const INK = '#120b06';
type Shape = { f: string[]; d?: string[]; l?: string[] };

const HEART = 'M12 21C5 15.6 2.8 11.6 2.8 8.4a4.9 4.9 0 0 1 9.2-2.4 4.9 4.9 0 0 1 9.2 2.4c0 3.2-2.2 7.2-9.2 12.6z';
const SHIELD = 'M12 2.8l7.6 2.6v6c0 4.8-3.2 8.2-7.6 9.8-4.4-1.6-7.6-5-7.6-9.8v-6z';
const FLASK = 'M9.4 3.4h5.2v3.2c3 1.2 4.8 3.8 4.8 6.9A7.4 7.4 0 0 1 12 21a7.4 7.4 0 0 1-7.4-7.5c0-3.1 1.8-5.7 4.8-6.9z';

export const STAT_ICONS: Record<string, Shape> = {
  p_main: { f: ['M12 2.6l2 2.2v9.2h-4V4.8z', 'M7 14h10v2.2H7z', 'M10.6 16.2h2.8v4.4a1.4 1.4 0 0 1-2.8 0z'], d: ['M12 5.2v8.2'], l: ['M10.9 5.4v7.4'] },
  p_vit: { f: [HEART], d: ['M12 9.6v5.2M9.4 12.2h5.2'], l: ['M6 8.2c.4-1.4 1.4-2.2 2.8-2.4'] },
  p_ms: { f: ['M6.4 5.2h5.2v7.2l5.4 1.8a2.6 2.6 0 0 1 1.6 2.4v1.2H5.2z'], d: ['M6.4 8.6h5.2', 'M2.6 8.4h2M1.8 11h3M3 13.6h1.8'], l: ['M7.4 6.4v4.2'] },
  p_res: { f: [FLASK], d: ['M9.4 6.6h5.2', 'M8.2 14c.2 2 1.6 3.4 3.4 3.8'], l: ['M7.6 11.4a4.6 4.6 0 0 1 2.2-2.6'] },
  p_ias: { f: ['M13.6 2.4L5.2 13.2h5l-1.6 8.4 8.8-11.4h-5.2z'], d: ['M12.8 6.2L9.4 11'], l: ['M7.4 12.4h2.2'] },
  p_cdr: { f: ['M6 3h12v3.4c0 2.4-2.4 3.8-4.2 5.6 1.8 1.8 4.2 3.2 4.2 5.6V21H6v-3.4c0-2.4 2.4-3.8 4.2-5.6C8.4 10.2 6 8.8 6 6.4z'], d: ['M9.6 18.4h4.8M10.2 8h3.6'], l: ['M7.6 4.8v1.6'] },
  p_chc: { f: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z'], d: ['M12 6.4v4M12 13.6v4M6.4 12h4M13.6 12h4', 'M10.6 12a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0'], l: ['M6.2 8.4a6.6 6.6 0 0 1 3.2-2.8'] },
  p_chd: { f: ['M12 2l2.4 5.2 5.6-1.6-2.4 5.2L22 12l-4.4 1.2 2.4 5.2-5.6-1.6L12 22l-2.4-5.2-5.6 1.6 2.4-5.2L2 12l4.4-1.2L4 5.6l5.6 1.6z'], d: ['M12 7.4v9.2M7.4 12h9.2'], l: ['M9.4 5.6l.6 1.6'] },
  p_life: { f: [HEART], d: ['M12 17V9.8M9 12.6l3-3 3 3'], l: ['M6 8.2c.4-1.4 1.4-2.2 2.8-2.4'] },
  p_armor: { f: [SHIELD], d: ['M12 6.4v11.6', 'M7.6 11h8.8'], l: ['M7 7.4v3.4'] },
  p_allres: { f: [SHIELD], d: ['M12 7.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z'], l: ['M7 7.4v3.4'] },
  p_regen: { f: ['M20.4 3.6C11 3.2 4.4 8 4.4 15.2c0 1.6.4 3 1.2 4.2C7 15.8 10 12.8 14 10.8c-3 2.4-5.2 5.4-6.4 9.4 1.2.6 2.4.8 3.6.8 6 0 9.2-6.2 9.2-17.4z'], d: ['M8 18.6C9.6 14.8 12.4 11.8 16 9.6'] },
  p_area: { f: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z'], d: ['M6.4 12a5.6 5.6 0 1 0 11.2 0 5.6 5.6 0 1 0-11.2 0', 'M9.8 12a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0'], l: ['M5.6 9.2a7.2 7.2 0 0 1 3.6-3.6'] },
  p_rcr: { f: [FLASK], d: ['M9.4 6.6h5.2', 'M12 9.4v6.6M9 13.4l3 3 3-3'], l: ['M7.6 11.4a4.6 4.6 0 0 1 2.2-2.6'] },
  p_loh: { f: ['M12 2.6C8 8 5 11.2 5 14.8a7 7 0 0 0 14 0C19 11.2 16 8 12 2.6z'], d: ['M9 15.6a3.2 3.2 0 0 0 3 3'], l: ['M8.8 11.4l1.6-2.6'] },
  p_gf: { f: ['M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4z'], d: ['M12 6.8v10.4', 'M9 9.4c.6-1 1.8-1.4 3-1.4s2.6.6 2.8 1.8c.2 1.4-1.4 1.8-2.8 2.1s-3 .8-2.8 2.2c.2 1.2 1.4 1.8 2.8 1.8s2.4-.4 3-1.4'], l: ['M6.8 9.4a6 6 0 0 1 3-3.2'] },
};

export function StatIcon({ id, size = 26, class: c, style }: { id: string; size?: number; class?: string; style?: JSX.CSSProperties }) {
  const ic = STAT_ICONS[id] ?? STAT_ICONS.p_main;
  return (
    <svg class={c ? `ui-ic ${c}` : 'ui-ic'} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={style}>
      {ic.f.map((d, i) => <path key={`o${i}`} d={d} fill="none" stroke={INK} stroke-width="2.6" stroke-linejoin="round" />)}
      {ic.f.map((d, i) => <path key={`f${i}`} d={d} fill="currentColor" />)}
      {ic.d?.map((d, i) => <path key={`d${i}`} d={d} fill="none" stroke={INK} stroke-opacity="0.72" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />)}
      {ic.l?.map((d, i) => <path key={`l${i}`} d={d} fill="none" stroke="#fff6dd" stroke-opacity="0.55" stroke-width="1.2" stroke-linecap="round" />)}
    </svg>
  );
}
