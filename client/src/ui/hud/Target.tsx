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
      <path d="M120 20H44C34 20 30 12 20 12M120 20H64C56 20 52 28 42 28" fill="none" stroke={`url(#tf-g-${p.side})`} stroke-width="1.6" stroke-linecap="round" />
      <path d="M120 14L108 20L120 26Z" fill="#c9a45c" stroke="#150c07" stroke-width="1" />
      <circle cx="18" cy="12" r="2.2" fill="#e8c680" />
      <circle cx="40" cy="28" r="1.6" fill="#c9a45c" />
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
