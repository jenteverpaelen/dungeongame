// Health and resource globes: glass orbs with an animated liquid surface.
// Layers (back to front): drop shadow, socket, the interior canvas (static glass and tint, liquid level, bob, two waves,
// glow, bubbles, static floor / light / depth shading, glass grain and swirl — orbCanvas.ts), the static glass SVG
// (specular, inner shadow, rim light) and the bronze bezel. The interior was 11 continuously animated compositor layers
// per globe plus blend passes over moving content every frame (docs/rework/PERF.md §4.1); one canvas per globe now
// draws the same layers. On the Low preset and with reduced motion the interior holds still; level changes still move.

import { useEffect, useRef } from 'preact/hooks';
import { useUI } from '../store';
import { fmtCompact, fmtInt } from '@shared/format';
import { motionReduced, preferences } from '../../game/preferences';
import { LIFE_STYLE, RESOURCE_STYLES, clamp01, type ResourceStyle } from './util';
import { OrbCanvas, R } from './orbCanvas';

export interface GlobeProps {
  kind: 'life' | 'res';
  cur: number;
  max: number;
  style: ResourceStyle;
  label: string;
}

// ───────────────────────── one shared draw loop for both globes ─────────────────────────

interface Live { orb: OrbCanvas; size: number; dirty: boolean }
const live = new Set<Live>();
let raf = 0, lastDraw = -1e9;
/** Idle motion off: Low preset or reduced motion (the DOM version stopped the same animations for reduced motion). */
const still = () => { const p = preferences.get().values; return p.graphicsPreset === 'low' || motionReduced(p); };
/** Tests pin the animation clock (s) through window.__orbClock; otherwise it is page time. */
const clock = (now: number) => { const c = (globalThis as { __orbClock?: number }).__orbClock; return typeof c === 'number' ? c : now / 1000; };
function frame(now: number) {
  raf = live.size ? requestAnimationFrame(frame) : 0;
  const isStill = still(), pinned = typeof (globalThis as { __orbClock?: number }).__orbClock === 'number';
  // Idle motion redraws 30 times a second: the liquid moves under a pixel per redraw (front wave 0.7 px at 1080p,
  // bubbles 0.2 px) and is resampled smoothly; the display rate cost a tenth more GPU-process time for no visible
  // difference. A level change (up to ~25 px in its first 33 ms) redraws at up to 60 a second.
  let moving = false; for (const l of live) if (l.orb.transitioning(now)) moving = true;
  if (!pinned && now - lastDraw < 1000 / (moving ? 61 : 31)) return;
  lastDraw = now;
  const dpr = window.devicePixelRatio || 1;
  for (const l of live) {
    if (isStill && !l.dirty && !l.orb.transitioning(now) && !pinned) continue;
    if (l.orb.draw(l.size, dpr, clock(now), now, isStill)) l.dirty = false;
    const c = l.orb.canvas, w = c.width / dpr;
    if (c.style.width !== `${w}px`) { c.style.width = `${w}px`; c.style.height = `${w}px`; }
  }
}
function track(l: Live) { live.add(l); if (!raf) raf = requestAnimationFrame(frame); }
preferences.subscribe(() => { for (const l of live) l.dirty = true; });

function GlobeInterior({ style, y, empty }: { style: ResourceStyle; y: number; empty: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<Live | null>(null);
  useEffect(() => {
    const canvas = ref.current!, host = canvas.parentElement!;
    const l: Live = { orb: new OrbCanvas(canvas, style), size: host.getBoundingClientRect().width, dirty: true };
    state.current = l;
    const ro = new ResizeObserver(() => { l.size = host.getBoundingClientRect().width; l.dirty = true; });
    ro.observe(host);
    track(l);
    return () => { ro.disconnect(); live.delete(l); state.current = null; };
  }, []);
  // .liquid { transition: transform 0.7s cubic-bezier(.25,.85,.3,1) }, 0.3 s into empty; also on Low and with reduced
  // motion (lead decision, PERF.md §4.1: still orbs there, but the level keeps easing)
  useEffect(() => { const s = state.current; if (s) { s.orb.setStyle(style); s.orb.setLevel(y, performance.now(), empty ? 300 : 700); s.dirty = true; } }, [y, style, empty]);
  return <canvas class="globe-canvas" ref={ref} aria-hidden="true" />;
}

export function Globe(p: GlobeProps) {
  const frac = p.max > 0 ? clamp01(p.cur / p.max) : 0;
  // surface height follows the sphere's visual height; at (nearly) full the surface rides above the top so waves never reveal a gap
  const y = frac <= 0 ? 214 : frac >= 0.985 ? -2 : 188 - Math.pow(frac, 0.85) * 176;
  const id = `g-${p.kind}`;
  const low = p.kind === 'life' && frac > 0 && frac < 0.25;
  const s = p.style;
  return (
    <div class={`globe globe-${p.kind}${low ? ' low' : ''}${frac <= 0 ? ' empty' : ''}`} style={{ '--glow': s.glow, '--liq-hi': s.hi, '--liq-mid': s.mid, '--liq-lo': s.lo }}>
      <div class="globe-shadow" />
      <div class="globe-socket" />
      <GlobeInterior style={s} y={y} empty={frac <= 0} />
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
      {low && <i class="globe-alarm" />}
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
