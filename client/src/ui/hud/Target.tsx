// Top-centre target frame for elites and bosses, with a trailing "recent damage" segment on the life bar.

import { useEffect, useState } from 'preact/hooks';
import { useUI, type TargetInfo } from '../store';
import { ELITE_AFFIXES } from '@shared/data/monsters';
import { hex, clamp01 } from './util';

const TIER = ['normal', 'champion', 'rare', 'minion', 'boss', 'goblin'] as const;

function Flourish(p: { side: 'l' | 'r' }) {
  return (
    <svg class={`tf-flourish ${p.side}`} viewBox="0 0 120 40" aria-hidden="true" preserveAspectRatio="xMaxYMid meet">
      <defs>
        <linearGradient id={`tf-g-${p.side}`} x1="1" x2="0">
          <stop offset="0" stop-color="#e8c680" />
          <stop offset="1" stop-color="#7a5a2a" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="M120 20H44C34 20 30 10 18 10M120 20H70C60 20 56 30 44 30M96 20C90 14 80 14 74 8" fill="none" stroke={`url(#tf-g-${p.side})`} stroke-width="2.2" stroke-linecap="round" />
      <path d="M120 12L106 20L120 28Z" fill="#c9a45c" stroke="#150c07" stroke-width="1.2" />
      <path d="M116 16.5L110 20L116 23.5Z" fill="#f2d58c" />
      <circle cx="16" cy="10" r="2.6" fill="#e8c680" stroke="#150c07" stroke-width=".8" />
      <circle cx="42" cy="30" r="2" fill="#c9a45c" stroke="#150c07" stroke-width=".8" />
      <circle cx="72" cy="7" r="1.8" fill="#c9a45c" />
    </svg>
  );
}

function TargetBody({ t }: { t: TargetInfo }) {
  const hp = clamp01(t.hpFrac);
  const [trail, setTrail] = useState(hp);
  useEffect(() => {
    if (hp >= trail) { setTrail(hp); return; }
    const id = setTimeout(() => setTrail(hp), 380);
    return () => clearTimeout(id);
  }, [hp]);

  const tier = TIER[t.elite] ?? 'normal';
  const boss = t.elite === 4;
  const affixes = t.affixes.map((id) => ELITE_AFFIXES[id]).filter(Boolean);
  return (
    <div class={`hud-target tier-${tier}${boss ? ' is-boss' : ''}`}>
      {boss && <><Flourish side="l" /><Flourish side="r" /></>}
      <div class="tf-nameline">
        {!boss && t.elite > 0 && <i class="tf-pip" />}
        <span class="tf-name">{t.name}</span>
        <span class="tf-lv">Lv {t.level}</span>
        {!boss && t.elite > 0 && <i class="tf-pip" />}
      </div>
      {affixes.length > 0 && (
        <div class="tf-affixes">
          {affixes.map((a, i) => (
            <span key={a.id} style={{ color: a.color === 0xffffff ? undefined : hex(a.color) }}>{i > 0 && <em>·</em>}{a.name}</span>
          ))}
        </div>
      )}
      <div class="tf-bar">
        <div class="tf-trail" style={{ width: `${(trail * 100).toFixed(2)}%` }} />
        <div class="tf-fill" style={{ width: `${(hp * 100).toFixed(2)}%` }}><i /></div>
        <div class="tf-ticks" />
        {boss && <span class="tf-pct">{Math.ceil(hp * 100)}%</span>}
      </div>
    </div>
  );
}

export function TargetFrame() {
  const t = useUI((s) => s.target);
  if (!t) return null;
  return <TargetBody key={t.id} t={t} />;
}
