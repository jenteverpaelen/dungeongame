// Health and resource globes: glass orbs with an animated liquid surface.
// Layers (back to front): socket shadow, liquid SVG (waves + bubbles, CSS-animated), glass grain, static glass SVG
// (specular, inner shadow, rim light) and the bronze bezel. Only the liquid level reacts to state, via a CSS transition.

import { useUI } from '../store';
import { fmtCompact, fmtInt } from '@shared/format';
import { LIFE_STYLE, RESOURCE_STYLES, clamp01, type ResourceStyle } from './util';

const R = 84; // liquid radius inside the 200-unit viewBox

/** Quadratic-bezier sine: alternating Q / T segments, `reps` half-periods wide. */
function waveTop(period: number, amp: number, halfPeriods: number): string {
  const h = period / 2;
  let d = `M0 0Q${period / 4} ${-amp} ${h} 0`;
  for (let i = 2; i <= halfPeriods; i++) d += `T${h * i} 0`;
  return d;
}
const WAVE_F = waveTop(100, 9, 8);
const WAVE_B = waveTop(140, 11, 6);

const BUBBLES: { x: number; y: number; r: number; dur: number; delay: number; rise: number }[] = [
  { x: 62, y: 150, r: 2.4, dur: 6.5, delay: -1, rise: 46 },
  { x: 88, y: 120, r: 1.6, dur: 5.2, delay: -3.2, rise: 38 },
  { x: 118, y: 160, r: 2.9, dur: 7.8, delay: -5, rise: 58 },
  { x: 140, y: 110, r: 1.5, dur: 4.6, delay: -2, rise: 30 },
  { x: 100, y: 170, r: 2, dur: 8.4, delay: -6.4, rise: 64 },
  { x: 74, y: 96, r: 1.3, dur: 5.8, delay: -0.4, rise: 28 },
  { x: 128, y: 140, r: 1.8, dur: 6.9, delay: -4.2, rise: 44 },
];

export interface GlobeProps {
  kind: 'life' | 'res';
  cur: number;
  max: number;
  style: ResourceStyle;
  label: string;
}

export function Globe(p: GlobeProps) {
  const frac = p.max > 0 ? clamp01(p.cur / p.max) : 0;
  // 0 -> well below the sphere, 1 -> surface above the top (waves never reveal a gap at full)
  const y = 206 - frac * 202;
  const id = `g-${p.kind}`;
  const low = p.kind === 'life' && frac > 0 && frac < 0.25;
  const s = p.style;
  return (
    <div class={`globe globe-${p.kind}${low ? ' low' : ''}${frac <= 0 ? ' empty' : ''}`} style={{ '--glow': s.glow, '--liq-hi': s.hi, '--liq-mid': s.mid, '--liq-lo': s.lo }}>
      <div class="globe-socket" />
      <svg class="globe-liquid" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-clip`}><circle cx="100" cy="100" r={R} /></clipPath>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color={s.hi} />
            <stop offset="0.07" stop-color={s.mid} />
            <stop offset="0.5" stop-color={s.mid} />
            <stop offset="0.82" stop-color={s.lo} />
            <stop offset="1" stop-color={s.lo} />
          </linearGradient>
          <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color={s.hi} stop-opacity=".9" />
            <stop offset="1" stop-color={s.mid} stop-opacity=".6" />
          </linearGradient>
          <radialGradient id={`${id}-glass`} cx="50%" cy="42%" r="62%">
            <stop offset="0" stop-color="#1a0c0c" />
            <stop offset="1" stop-color="#040203" />
          </radialGradient>
          <radialGradient id={`${id}-depth`} cx="50%" cy="46%" r="52%">
            <stop offset="0.52" stop-color="#000" stop-opacity="0" />
            <stop offset="0.86" stop-color="#000" stop-opacity=".34" />
            <stop offset="1" stop-color="#000" stop-opacity=".82" />
          </radialGradient>
          <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.5" stop-color="#000" stop-opacity="0" />
            <stop offset="1" stop-color="#000" stop-opacity=".55" />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color={s.hi} stop-opacity=".45" />
            <stop offset="1" stop-color={s.hi} stop-opacity="0" />
          </radialGradient>
        </defs>
        <g clip-path={`url(#${id}-clip)`}>
          <circle cx="100" cy="100" r={R + 2} fill={`url(#${id}-glass)`} />
          <g class="liquid" style={{ transform: `translateY(${y.toFixed(2)}px)` }}>
            <g class="liquid-bob">
              <g class="wave wave-b"><path d={`${WAVE_B}V300H0Z`} fill={`url(#${id}-back)`} /></g>
              <g class="wave wave-f">
                <path d={`${WAVE_F}V300H0Z`} fill={`url(#${id}-body)`} />
                <path d={WAVE_F} fill="none" stroke={s.hi} stroke-width="2.4" stroke-linecap="round" stroke-opacity=".9" />
                <path d={WAVE_F} fill="none" stroke="#fff" stroke-width=".9" stroke-opacity=".55" transform="translate(0 -1)" />
              </g>
              <ellipse cx="100" cy="14" rx="86" ry="22" fill={`url(#${id}-glow)`} />
              {BUBBLES.map((b) => (
                <circle class="bubble" cx={b.x} cy={b.y} r={b.r} fill="#fff" style={{ animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, '--rise': `${-b.rise}px` }} />
              ))}
            </g>
          </g>
          <rect x="0" y="0" width="200" height="200" fill={`url(#${id}-floor)`} />
          <circle cx="100" cy="100" r={R + 2} fill={`url(#${id}-depth)`} />
        </g>
      </svg>
      <div class="globe-grain" />
      <svg class="globe-glass" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}-spec`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="#fff" stop-opacity=".62" />
            <stop offset="0.55" stop-color="#fff" stop-opacity=".16" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color={s.hi} stop-opacity="0" />
            <stop offset="1" stop-color={s.hi} stop-opacity=".8" />
          </linearGradient>
          <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" /></filter>
        </defs>
        {/* big soft sheen */}
        <ellipse cx="72" cy="56" rx="46" ry="27" transform="rotate(-32 72 56)" fill={`url(#${id}-spec)`} />
        {/* crisp specular crescent */}
        <path d="M46 78C50 56 68 40 90 36C74 44 60 58 56 80C54 84 48 84 46 78Z" fill="#fff" fill-opacity=".62" filter={`url(#${id}-blur)`} />
        <ellipse cx="62" cy="48" rx="6.5" ry="3.2" transform="rotate(-38 62 48)" fill="#fff" fill-opacity=".95" />
        <circle cx="52" cy="62" r="2" fill="#fff" fill-opacity=".8" />
        {/* lower rim light */}
        <path d="M136 164C152 152 162 136 164 118" fill="none" stroke={`url(#${id}-rim)`} stroke-width="5" stroke-linecap="round" filter={`url(#${id}-blur)`} />
        <path d="M118 172C128 170 136 166 142 162" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round" />
        {/* glass edge */}
        <circle cx="100" cy="100" r={R - 0.5} fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.4" />
        <circle cx="100" cy="100" r={R + 1.5} fill="none" stroke="#000" stroke-opacity=".9" stroke-width="3" />
      </svg>
      <div class="globe-bezel" />
      <i class="globe-stud s1" /><i class="globe-stud s2" /><i class="globe-stud s3" /><i class="globe-stud s4" />
      <div class="globe-crest" />
      <div class="globe-num interactive">
        <span class="gn-short">{fmtCompact(p.cur)}</span>
        <span class="gn-full"><b>{p.label}</b>{fmtInt(p.cur)} / {fmtInt(p.max)}</span>
      </div>
    </div>
  );
}

export function HealthGlobe() {
  const v = useUI((s) => (s.me ? { hp: s.me.hp, mhp: s.me.mhp } : null));
  return <Globe kind="life" cur={v?.hp ?? 0} max={v?.mhp ?? 1} style={LIFE_STYLE} label="Life" />;
}

export function ResourceGlobe() {
  const v = useUI((s) => (s.me && s.char ? { res: s.me.res, mres: s.me.mres, cls: s.char.classId } : null));
  const st = RESOURCE_STYLES[v?.cls ?? 'warrior'];
  return <Globe kind="res" cur={v?.res ?? 0} max={v?.mres ?? 1} style={st} label={st.name} />;
}
