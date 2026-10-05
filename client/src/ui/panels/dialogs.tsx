// NPC dialogs: the Waypoint (zones + channel populations) and the Rift Obelisk (difficulty ladder).
// Plus the F2 "Prototype tools" panel.

import { useState } from 'preact/hooks';
import { FIELD_CHANNEL_CAP, TOWN_CHANNEL_CAP } from '@shared/constants';
import { ZONES, type ZoneDef } from '@shared/data/zones';
import { fmtInt } from '@shared/format';
import { DIFFICULTIES } from '@shared/progression';
import { togglePanel } from '../store';
import { Bar, PanelFrame } from './common';
import { IconLock, IconStar4, IconSkull, Svg } from './icons';
import { useU } from './state';
import { cls, run } from './util';

// ───────────────────────────── zone glyphs ─────────────────────────────

function ZoneGlyph({ zone }: { zone: ZoneDef }) {
  const t = zone.theme;
  return (
    <div class={cls('zglyph', `z-${t}`)}>
      <Svg size={52} vb={52}>
        <defs>
          <linearGradient id="zg-sky-town" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3350" /><stop offset="1" stop-color="#c98a52" /></linearGradient>
          <linearGradient id="zg-sky-glade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3a3a" /><stop offset="1" stop-color="#6aa05a" /></linearGradient>
          <linearGradient id="zg-sky-ashen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1612" /><stop offset="1" stop-color="#b8431e" /></linearGradient>
        </defs>
        <rect width="52" height="52" fill={`url(#zg-sky-${t})`} />
        {t === 'town' && (
          <>
            <circle cx="38" cy="14" r="4" fill="#ffe6a0" opacity=".9" />
            <path d="M6 44 V28 L18 18 L30 28 V44 Z" fill="#3a2a1e" stroke="#120a06" stroke-width="1.2" />
            <path d="M3 29 L18 16 L33 29" fill="#7a3a22" stroke="#120a06" stroke-width="1.2" stroke-linejoin="round" />
            <rect x="26" y="14" width="4" height="9" fill="#4a3226" stroke="#120a06" stroke-width="1" />
            <rect x="14" y="32" width="8" height="12" fill="#1a0f08" /><rect x="9" y="30" width="4" height="5" fill="#ffc860" /><rect x="23" y="30" width="4" height="5" fill="#ffc860" />
            <path d="M30 44 V34 L40 27 L49 34 V44 Z" fill="#4a3a2a" stroke="#120a06" stroke-width="1.2" /><path d="M28 35 L40 25 L51 35" fill="#5a2a1a" stroke="#120a06" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M0 44 H52 V52 H0 Z" fill="#2a2016" />
          </>
        )}
        {t === 'glade' && (
          <>
            <path d="M-2 40 C10 30 20 36 30 30 C40 25 46 30 54 28 V52 H-2 Z" fill="#2c5a34" />
            <path d="M16 38 L16 24 M10 30 L16 14 L22 30 Z" stroke="#0e2012" stroke-width="1.2" fill="#3d8a4a" stroke-linejoin="round" />
            <path d="M16 38 V26" stroke="#3a2412" stroke-width="3" />
            <path d="M8 34 L16 12 L24 34 Z" fill="#3d8a4a" stroke="#0e2012" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M32 40 V30" stroke="#3a2412" stroke-width="3" /><path d="M26 36 L34 16 L42 36 Z" fill="#4a9a52" stroke="#0e2012" stroke-width="1.2" stroke-linejoin="round" />
            <circle cx="42" cy="44" r="3" fill="#e8d8c8" stroke="#2a1a10" stroke-width=".8" /><circle cx="44.6" cy="42.6" r="1.4" fill="#e04848" />
            <path d="M0 46 H52 V52 H0 Z" fill="#1c3a22" />
          </>
        )}
        {t === 'ashen' && (
          <>
            <path d="M-2 40 L10 26 L16 34 L26 18 L34 32 L42 22 L54 38 V52 H-2 Z" fill="#2a1a16" stroke="#0c0604" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M24 22 L26 18 L28 24 L25 26 Z" fill="#ff8a3a" />
            <path d="M12 44 H40 L38 36 L34 40 L30 30 L26 40 L22 34 L18 40 Z" fill="#120a08" />
            <path d="M18 46 L24 42 L28 46 L34 41" stroke="#ff7a2a" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="14" cy="14" r="1.2" fill="#ffb060" /><circle cx="40" cy="12" r="1" fill="#ffb060" /><circle cx="30" cy="8" r=".8" fill="#ffd090" />
            <path d="M0 46 H52 V52 H0 Z" fill="#1a0e0a" />
          </>
        )}
      </Svg>
    </div>
  );
}

// ───────────────────────────── waypoint ─────────────────────────────

export function WaypointPanel() {
  const zone = useU((s) => s.zone);
  const world = useU((s) => s.world);
  const char = useU((s) => s.char);
  const [busy, setBusy] = useState<string | null>(null);
  const zones = Object.values(ZONES).filter((z) => z.kind !== 'rift');
  const travel = async (id: string) => {
    setBusy(id);
    const r = await run('travel', { zone: id });
    setBusy(null);
    if (r.ok) togglePanel('waypoint', false);
  };
  return (
    <PanelFrame id="waypoint" title="Waypoint" width={560} sub={<span class="pn-lv">{world ? `${fmtInt(world.online)} heroes online` : ''}</span>}>
      <div class="wp-list">
        {zones.map((z) => {
          const chans = (world?.channels ?? []).filter((c) => c.zone === z.id).sort((a, b) => a.channel - b.channel);
          const cap = z.kind === 'town' ? TOWN_CHANNEL_CAP : FIELD_CHANNEL_CAP;
          const total = chans.reduce((a, c) => a + c.players, 0);
          const here = zone?.zone === z.id;
          const lowest = Math.max(1, z.levelBand[0]);
          const tooLow = !!char && char.level < lowest;
          return (
            <div class={cls('wp-card', here && 'here', z.kind)} key={z.id}>
              <ZoneGlyph zone={z} />
              <div class="wp-info">
                <div class="wp-top">
                  <h3>{z.name}</h3>
                  <span class="wp-tag">{z.kind === 'town' ? 'Safe haven' : `Level ${z.levelBand[0]}-${z.levelBand[1]}`}</span>
                </div>
                <p>{z.blurb}</p>
                <div class="wp-pop">
                  <span class="wp-total"><IconStar4 size={10} />{fmtInt(total)} {total === 1 ? 'hero' : 'heroes'}</span>
                  <div class="wp-chans">
                    {chans.length === 0 && <span class="wp-ch idle">No active channels</span>}
                    {chans.map((c) => {
                      const f = c.players / cap;
                      const mine = here && zone?.channel === c.channel;
                      const full = c.players >= cap;
                      return (
                        <button
                          key={c.channel}
                          class={cls('wp-ch', mine && 'mine', full && 'full', f > 0.7 && !full && 'busy')}
                          disabled={!here || mine}
                          onClick={() => void run('channel', { n: c.channel })}
                          title={here ? (mine ? 'Your channel' : `Switch to channel ${c.channel}`) : undefined}
                        >
                          <span class="ch-l">Ch. {c.channel}</span>
                          <span class="ch-bar"><i style={{ width: `${Math.min(100, f * 100)}%` }} /></span>
                          <span class="ch-n">{c.players}/{cap}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div class="wp-go">
                {here ? <span class="wp-here">You are here</span> : (
                  <button class="btn primary" disabled={busy !== null || tooLow} onClick={() => void travel(z.id)}>
                    {busy === z.id ? 'Travelling...' : tooLow ? `Lv ${lowest}` : 'Travel'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div class="wp-foot">Fields place you in the least crowded channel. At a waypoint you can also hop between channels of your current zone.</div>
    </PanelFrame>
  );
}

// ───────────────────────────── rift obelisk ─────────────────────────────

export function ObeliskPanel() {
  const char = useU((s) => s.char);
  const world = useU((s) => s.world);
  const [sel, setSel] = useState<number>(() => Math.min(char?.difficulty ?? 0, DIFFICULTIES.length - 1));
  const [busy, setBusy] = useState(false);
  if (!char) return null;
  const d = DIFFICULTIES[sel];
  const lockedSel = char.level < d.minLevel;
  const act = async (op: 'riftOpen' | 'riftEnter') => {
    setBusy(true);
    const r = await run(op, op === 'riftOpen' ? { difficulty: sel } : undefined);
    setBusy(false);
    if (r.ok) togglePanel('obelisk', false);
  };
  return (
    <PanelFrame id="obelisk" title="Nephalem Obelisk" width={600} sub={<span class="pn-lv">Level {char.level}</span>}>
      <div class="ob-intro">
        <div class="ob-sigil"><IconSkull size={26} /></div>
        <p>Open a rift to hunt through an endless wilderness. Slay enough monsters to draw out the Rift Guardian, then claim his spoils. Higher difficulties bring more experience, gold and legendaries.</p>
      </div>
      <div class="ob-head"><span>Difficulty</span><span>Experience</span><span>Gold</span><span>Legendaries</span></div>
      <div class="ob-list scroll">
        {DIFFICULTIES.map((x, i) => {
          const lk = char.level < x.minLevel;
          return (
            <button key={x.name} class={cls('ob-row', sel === i && 'on', lk && 'locked', x.name.startsWith('Torment') && 'torment')} onClick={() => setSel(i)}>
              <span class="ob-n">
                {lk ? <IconLock size={11} /> : <i class="ob-pip" />}
                <b>{x.name}</b>
                {lk && <em>Level {x.minLevel}</em>}
              </span>
              <span class="ob-v">{x.xpBonus > 0 ? `+${x.xpBonus}%` : '-'}</span>
              <span class="ob-v">{x.goldBonus > 0 ? `+${x.goldBonus}%` : '-'}</span>
              <span class="ob-v leg">{i > 0 ? `+${i * 30}%` : '-'}</span>
            </button>
          );
        })}
      </div>
      <div class="ob-sum">
        <div class="ob-sum-l">
          <b>{d.name}</b>
          <span>Monsters have {d.hp}× life and deal {d.dmg.toFixed(1)}× damage.</span>
        </div>
        <Bar tone="life" frac={Math.min(1, Math.log2(d.hp + 1) / 14)} height={8} />
      </div>
      <div class="ob-actions">
        <div class={cls('ob-state', world?.riftOpen && 'open')}>
          <i /> {world?.riftOpen ? 'A rift is open in this channel' : 'No rift is open in this channel'}
        </div>
        <button class="btn" disabled={busy || !world?.riftOpen} onClick={() => void act('riftEnter')}>Enter Open Rift</button>
        <button class="btn primary" disabled={busy || lockedSel} onClick={() => void act('riftOpen')}>Open Rift</button>
      </div>
    </PanelFrame>
  );
}

// ───────────────────────────── debug ─────────────────────────────

const TOOLS: { label: string; hint: string; op: string; n?: number }[] = [
  { label: 'Level +10', hint: 'Grant ten levels', op: 'level', n: 10 },
  { label: 'Paragon +50', hint: 'Fifty paragon levels', op: 'paragon', n: 50 },
  { label: 'Gold', hint: 'Fill your purse', op: 'gold' },
  { label: 'Materials', hint: 'All crafting materials', op: 'mats' },
  { label: 'Legendaries', hint: 'A handful of class legendaries', op: 'legendaries' },
  { label: 'Full Set', hint: 'Class set + legendaries at item level 70', op: 'set' },
  { label: 'Spawn Goblin', hint: 'Treasure goblin nearby', op: 'goblin' },
  { label: 'Spawn Elite', hint: 'A rare pack nearby', op: 'elite' },
  { label: 'Heal', hint: 'Full life and resource', op: 'heal' },
  { label: 'Unlimited Resource', hint: 'Toggle: Fury / Hatred / Arcane Power stay full', op: 'infres' },
];

export function DebugPanel() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <PanelFrame id="debug" title="Prototype tools" width={320} class="dev" sub={<span class="pn-lv dev">F2</span>}>
      <div class="dbg-note">Development helpers. They run on the server and change your save.</div>
      <div class="dbg-grid">
        {TOOLS.map((t) => (
          <button
            key={t.op}
            class={cls('dbg-btn', last === t.op && 'ok')}
            title={t.hint}
            onClick={async () => { const r = await run('debug', t.n ? { op: t.op, n: t.n } : { op: t.op }); if (r.ok) { setLast(t.op); setTimeout(() => setLast((l) => (l === t.op ? null : l)), 900); } }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </PanelFrame>
  );
}
