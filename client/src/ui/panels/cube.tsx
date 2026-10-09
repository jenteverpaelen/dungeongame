// The Cube (U / E at the cube): Task Bar Hero style levelling Hero-dric Cube carrying the Kanai / Mystic /
// Jeweler recipes. Cube level + XP, function tabs locked by level, an item chamber, costs, result feedback.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  CUBE_FUNCTIONS, CUBE_XP, FORTUNE_PER_FAIL, UPGRADE_CHANCE, canAfford, canEnchantAffix, cubeXpToNext, enchantCost, extractCost, fuseCost,
  gemName, gemRemoveCost, maxSockets, reforgeCost, salvageXp, salvageYield, socketCost, transmuteCost, upgradeChance, upgradeCost,
  type Cost, type CubeOp,
} from '@shared/cube';
import { AFFIX_BY_STAT, GEMS, GEM_RANKS, LEGENDARIES } from '@shared/data/items';
import { fmtInt } from '@shared/format';
import { KIND_LABEL } from '@shared/items';
import type { AffixRoll, CharacterSave, Item, Materials } from '@shared/types';
import { ARTISAN_FUNCTIONS, ARTISAN_NAMES } from '@shared/townServices';
import { ui } from '../store';
import { Bar, CostList, PanelFrame } from './common';
import { cubeUI, setCubeItem } from './cubestate';
import { canDropOn, useDrag } from './dnd';
import { CubeEmblem, GemIcon, IconArrowRight, IconCheck, IconChevron, IconDelta, IconLock, IconStar4, MatIcon, MATERIAL_ORDER, gemColor, lighten } from './icons';
import { CubeFnIcon } from './skillicons';
import { useLocal, useU } from './state';
import { ItemVisual, itemHover } from './tooltip';
import {
  affixText, armorValue, cls, emphasize, fmtPowerValue, fmtRange, itemById, itemTypeLine, rarityClass, rollFraction, run, scaledAffix, weaponStats,
} from './util';

// ───────────────────────────── helpers ─────────────────────────────

function flash(kind: 'success' | 'fail' | 'info', title: string, sub?: string) {
  const at = performance.now();
  cubeUI.set({ result: { kind, title, sub, at } });
  setTimeout(() => { if (cubeUI.get().result?.at === at) cubeUI.set({ result: null }); }, 3000);
}

function YieldChips({ y }: { y: Partial<Materials> }) {
  const e = MATERIAL_ORDER.filter((m) => (y[m] ?? 0) > 0);
  return <span class="yield">{e.map((m) => <span key={m}><MatIcon id={m} size={20} /><b>{fmtInt(y[m]!)}</b></span>)}</span>;
}

/** Why the placed item cannot be used for this function (null = fine). */
function invalidReason(fn: CubeOp, item: Item | null): string | null {
  if (fn === 'fuse') return null;
  if (!item) return 'Place an item in the Cube.';
  switch (fn) {
    case 'enchant': return item.rarity === 'normal' ? 'Normal items have no properties to enchant.' : null;
    case 'upgrade': return item.upgrade >= 10 ? 'This item is already at the maximum tier.' : null;
    case 'transmute': return item.rarity !== 'rare' ? 'Only Rare items can be transmuted.' : null;
    case 'extract': return item.rarity !== 'legendary' ? 'Only Legendary items carry an extractable power.' : null;
    case 'reforge': return item.rarity !== 'legendary' && item.rarity !== 'set' ? 'Only Legendary and Set items can be reforged.' : null;
    case 'socket': return item.sockets.length >= maxSockets(item) ? 'This item cannot hold any more sockets.' : null;
    default: return null;
  }
}

function useConfirmBtn(): [boolean, (go: () => void) => void] {
  const [armed, setArmed] = useState(false);
  const t = useRef<number>();
  useEffect(() => () => clearTimeout(t.current), []);
  return [armed, (go) => {
    if (armed) { clearTimeout(t.current); setArmed(false); go(); }
    else { setArmed(true); t.current = window.setTimeout(() => setArmed(false), 2800); }
  }];
}

// ───────────────────────────── chamber ─────────────────────────────

function Chamber({ item, gems }: { item: Item | null; gems?: { gem: string; rank: number } | null }) {
  const drag = useDrag();
  const result = useLocal(cubeUI, (s) => s.result);
  const hover = item ? itemHover(() => itemById(ui.get().char, item.id)) : null;
  return (
    <div class={cls('chamber', result && `res-${result.kind}`)} key={result?.at ?? 0}>
      <div class="ch-halo" />
      <div class="ch-ring r1" />
      <div class="ch-ring r2" />
      <CubeEmblem size={150} glow={false} class="ch-cube" />
      <div class="ch-motes">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <i key={i} style={{ '--i': i }} />)}</div>
      {!gems && (
        <div class={cls('ch-slot', item ? rarityClass(item) : 'empty', canDropOn(drag, 'cube') && 'drop-ok')} data-drop="cube" {...(hover ?? {})}>
          {item ? <ItemVisual item={item} size={62} /> : <span class="ch-hint">Drop an<br />item here</span>}
          {item && item.upgrade > 0 && <span class="cell-up">+{item.upgrade}</span>}
          {item && <button class="ch-clear" aria-label="Remove item" onClick={() => setCubeItem(null)}>×</button>}
        </div>
      )}
      {gems && (
        <div class="ch-gems">
          <div class="cg-in"><GemIcon gem={gems.gem} size={30} /><GemIcon gem={gems.gem} size={30} /><GemIcon gem={gems.gem} size={30} /></div>
          <IconChevron dir="down" size={14} />
          <div class="cg-out"><GemIcon gem={gems.gem} size={50} /></div>
        </div>
      )}
      <div class="ch-name">
        {item ? (
          <>
            <b class={rarityClass(item)}>{item.name}</b>
            <span>{itemTypeLine(item)}</span>
          </>
        ) : gems ? (
          <>
            <b class="cg-n" style={{ color: lighten(gemColor(gems.gem), 0.35) }}>{gems.rank < 6 ? gemName(gems.gem, gems.rank + 1) : 'Royal'}</b>
            <span>3 × {gemName(gems.gem, gems.rank)}</span>
          </>
        ) : (
          <span class="pn-dim">Click an item in your bag, or drag one in</span>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── per-function content ─────────────────────────────

function Hint({ children }: { children: ComponentChildren }) {
  return <div class="cw-hint">{children}</div>;
}

function Note({ children, tone }: { children: ComponentChildren; tone?: 'warn' }) {
  return <div class={cls('cw-note', tone)}>{children}</div>;
}

function SalvageView({ item }: { item: Item | null }) {
  if (!item) return <Hint>Place an item to see what it breaks down into.</Hint>;
  return (
    <div class="cv">
      <div class="cv-row"><label>You will receive</label><YieldChips y={salvageYield(item)} /></div>
      <div class="cv-row"><label>Cube experience</label><b class="xpv">+{salvageXp(item)} XP</b></div>
      {(item.rarity === 'legendary' || item.rarity === 'set') && <Note tone="warn">Legendary and Set items are destroyed. Extract their power first if you want to keep it.</Note>}
      <Note>Shift + right-click an item in your bag to salvage it while beside the Blacksmith.</Note>
    </div>
  );
}

function FuseView({ char, sel, onSel }: { char: CharacterSave; sel: string | null; onSel: (k: string) => void }) {
  const order = Object.keys(GEMS);
  const list = Object.entries(char.gems)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => { const [gem, rank] = k.split(':'); return { k, gem, rank: Number(rank), n }; })
    .sort((a, b) => order.indexOf(a.gem) - order.indexOf(b.gem) || a.rank - b.rank);
  if (!list.length) return <Hint>You have no gems. Gems drop from elites and rift guardians.</Hint>;
  return (
    <div class="fuse-list scroll">
      {list.map((g) => {
        const can = g.n >= 3 && g.rank < 6;
        return (
          <button key={g.k} class={cls('fuse-row', sel === g.k && 'on', !can && 'pn-dim')} onClick={() => onSel(g.k)}>
            <GemIcon gem={g.gem} size={28} />
            <span class="fr-n"><b style={{ color: lighten(gemColor(g.gem), 0.3) }}>{gemName(g.gem, g.rank)}</b><em>{g.rank >= 6 ? 'Highest rank' : g.n >= 3 ? `Fuse into ${GEM_RANKS[g.rank]}` : `Need ${3 - g.n} more`}</em></span>
            <span class="fr-c">×{g.n}</span>
          </button>
        );
      })}
    </div>
  );
}

function EnchantView({ item, char }: { item: Item | null; char: CharacterSave }) {
  const affix = useLocal(cubeUI, (s) => s.affix);
  const pending = useU((s) => s.enchant);
  if (!item) return <Hint>Place a Magic, Rare, Legendary or Set item to reroll one of its properties.</Hint>;
  if (item.rarity === 'normal') return <Hint>Normal items have no properties to enchant.</Hint>;
  if (pending && pending.itemId === item.id) return <EnchantChoice item={item} pending={pending} />;
  const hasEnchant = item.enchanted !== undefined;
  return (
    <div class="cv">
      <div class="cv-label">Choose a property to reroll</div>
      <div class="ench-list">
        {item.affixes.map((a, i) => {
          const ok = canEnchantAffix(item, i);
          const on = affix === i;
          return (
            <button key={i} class={cls('ench-row', on && 'on', !ok && 'locked', !a.primary && 'sec', item.enchanted === i && 'enchanted')} disabled={!ok} onClick={() => cubeUI.set({ affix: i })}>
              <span class="radio">{on && <i />}</span>
              <span class="er-t">{emphasize(affixText(a, item))}</span>
              {item.enchanted === i && <em class="er-tag">Enchanted</em>}
              {!ok && <span class="er-lock"><IconLock size={11} /></span>}
            </button>
          );
        })}
      </div>
      <Note>{hasEnchant ? 'Only one property per item may ever be enchanted. You can reroll the enchanted one again.' : 'Pay to roll two new options, then keep the original or take one of them.'}</Note>
    </div>
  );
}

function EnchantChoice({ item, pending }: { item: Item; pending: { itemId: string; affix: number; options: AffixRoll[] } }) {
  const original = item.affixes[pending.affix];
  const cards: { label: string; roll: AffixRoll; idx: number }[] = [
    { label: 'Original', roll: original, idx: 0 },
    ...pending.options.map((r, i) => ({ label: `Option ${i + 1}`, roll: r, idx: i + 1 })),
  ];
  const [busy, setBusy] = useState(false);
  const pick = async (c: number) => {
    if (busy) return;
    setBusy(true);
    const r = await run('enchantPick', { itemId: item.id, choice: c });
    setBusy(false);
    if (!r.ok) return;
    ui.set({ enchant: null });
    cubeUI.set({ affix: null });
    flash(c === 0 ? 'info' : 'success', c === 0 ? 'Original Kept' : 'Enchanted!', c === 0 ? 'The property was not changed.' : 'The new property is now locked in.');
  };
  return (
    <div class="cv">
      <div class="cv-label">Choose one</div>
      <div class="ench-cards">
        {cards.map((c) => {
          const frac = rollFraction(scaledAffix(c.roll, item));
          return (
            <button key={c.idx} class={cls('ench-card', c.idx === 0 && 'orig')} disabled={busy} onClick={() => void pick(c.idx)}>
              <span class="ec-l">{c.label}</span>
              <span class="ec-t">{emphasize(affixText(c.roll, item))}</span>
              <span class="ec-r">[{fmtRange(scaledAffix(c.roll, item).min, scaledAffix(c.roll, item).max)}]</span>
              <i class="ec-m"><u style={{ width: `${Math.round(frac * 100)}%` }} /></i>
              <span class="ec-go">{c.idx === 0 ? 'Keep' : 'Take this'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Gauge({ pct, fortune }: { pct: number; fortune: number }) {
  const r = 38, c = 2 * Math.PI * r;
  const base = Math.max(0, pct - fortune);
  const tone = pct >= 85 ? '#46e07a' : pct >= 50 ? '#f2d58c' : pct >= 30 ? '#f0a040' : '#f0594a';
  return (
    <div class="gauge">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="#0a0705" stroke-width="10" />
        <circle cx="52" cy="52" r={r} fill="none" stroke="#2a2016" stroke-width="8" />
        <circle cx="52" cy="52" r={r} fill="none" stroke={tone} stroke-width="8" stroke-linecap="round" stroke-dasharray={`${(base / 100) * c} ${c}`} transform="rotate(-90 52 52)" style={{ filter: `drop-shadow(0 0 4px ${tone}88)` }} />
        {fortune > 0 && <circle cx="52" cy="52" r={r} fill="none" stroke="#8ad89a" stroke-width="8" stroke-linecap="butt" stroke-dasharray={`${(fortune / 100) * c} ${c}`} stroke-dashoffset={-(base / 100) * c} transform="rotate(-90 52 52)" />}
        <circle cx="52" cy="52" r="29" fill="none" stroke="rgba(201,164,92,.25)" stroke-width="1" />
      </svg>
      <div class="gauge-in">
        <b class={pct >= 100 ? 'tri' : ''} style={{ color: tone }}>{pct}<small>%</small></b>
        <span>success</span>
      </div>
    </div>
  );
}

function Delta({ cur, next, pct }: { cur: number; next: number; pct?: boolean }) {
  const d = next - cur;
  return <span class="pv-d"><IconDelta up size={8} />{pct ? `+${(Math.round(d * 10) / 10).toFixed(1)}` : `+${fmtInt(d)}`}</span>;
}

function UpgradeView({ item }: { item: Item | null }) {
  if (!item) return <Hint>Place an item to empower it. Each tier adds 6% to all of its properties.</Hint>;
  const t = item.upgrade;
  const maxed = t >= 10;
  const w = weaponStats(item), wn = weaponStats(item, t + 1);
  const ar = armorValue(item), an = armorValue(item, t + 1);
  const pct = upgradeChance(item);
  return (
    <div class="cv upg">
      <div class="upg-top">
        {!maxed ? <Gauge pct={pct} fortune={item.upgradeFortune} /> : <div class="gauge maxed"><b>MAX</b></div>}
        <div class="upg-side">
          <div class="upg-tier">
            <span>Tier</span><b>+{t}</b>
            {!maxed && <><IconArrowRight size={14} /><b class="nx">+{t + 1}</b></>}
          </div>
          <div class="fortune">
            <span class="f-l">Fortune</span>
            <b class={item.upgradeFortune > 0 ? 'on' : ''}>+{item.upgradeFortune}%</b>
            <span class="f-s">Each failure adds {FORTUNE_PER_FAIL}% to your next attempt. It resets on success.</span>
          </div>
        </div>
      </div>
      <div class="ladder10">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} class={cls('lad', i < t && 'done', i === t && 'next')}>
            <i />
            <span>+{i + 1}</span>
            <small>{UPGRADE_CHANCE[i]}%</small>
          </div>
        ))}
      </div>
      {!maxed && (
        <div class="preview">
          <div class="pv-head"><span>Now <b>+{t}</b></span><IconArrowRight size={14} /><span class="after">After <b>+{t + 1}</b></span></div>
          {w && wn && <div class="pv-big"><label>Damage Per Second</label><span class="pv-a">{fmtInt(w.dps)}</span><IconArrowRight size={12} /><span class="pv-b">{fmtInt(wn.dps)}</span><Delta cur={w.dps} next={wn.dps} /></div>}
          {!w && ar !== null && an !== null && <div class="pv-big"><label>Armor</label><span class="pv-a">{fmtInt(ar)}</span><IconArrowRight size={12} /><span class="pv-b">{fmtInt(an)}</span><Delta cur={ar} next={an} /></div>}
          <div class="pv-list">
            {item.affixes.filter((a) => a.primary).slice(0, 5).map((a, i) => {
              const cur = scaledAffix(a, item, t), nx = scaledAffix(a, item, t + 1);
              const isPct = AFFIX_BY_STAT[a.stat]?.scale === 'pct';
              return (
                <div class="pv-row" key={i}>
                  <span class="pv-t">{emphasize(affixText(a, item, t + 1))}</span>
                  <Delta cur={cur.value} next={nx.value} pct={isPct} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TransmuteView({ item }: { item: Item | null }) {
  return (
    <div class="cv">
      <div class="trans">
        <div class="tr-box in"><label>Input</label><b>{item ? itemTypeLine(item) : 'A Rare item'}</b></div>
        <IconArrowRight size={20} />
        <div class="tr-box out"><label>Output</label><b class="r-legendary">{item ? `Legendary ${KIND_LABEL[item.kind]}` : 'A random Legendary'}</b></div>
      </div>
      <Note>The Rare item is consumed and replaced by a random Legendary of the same type. It may roll as Ancient.</Note>
      {item && item.upgrade > 0 && <Note tone="warn">The +{item.upgrade} upgrade tier will be lost.</Note>}
    </div>
  );
}

const SLOT_NAMES = ['Weapon', 'Armor', 'Jewelry'] as const;
const CUBE_SLOTS = ['weapon', 'armor', 'jewelry'] as const;

function powerText(id: string): string {
  const d = LEGENDARIES[id];
  return d ? d.power.replace('{v}', fmtPowerValue(d.range[1])) : '';
}

function KanaiSlots({ char }: { char: CharacterSave }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div class="kanai">
      {CUBE_SLOTS.map((slot, i) => {
        const p = char.cube.equipped[i];
        const def = p ? LEGENDARIES[p] : null;
        const options = char.cube.learned.filter((id) => LEGENDARIES[id]?.cubeSlot === slot);
        return (
          <div class={cls('kslot', def && 'on', open === i && 'open')} key={slot}>
            <button class="ks-btn" onClick={() => setOpen(open === i ? null : i)}>
              <span class="ks-k">{SLOT_NAMES[i]}</span>
              {def ? (
                <>
                  <b>{def.name}</b>
                  <em>{powerText(p!)}</em>
                </>
              ) : <span class="ks-empty">Empty. {options.length ? 'Choose a learned power.' : 'Extract one first.'}</span>}
              <IconChevron size={10} dir={open === i ? 'up' : 'down'} />
            </button>
            {open === i && (
              <div class="ks-menu">
                <button class="ks-opt none" onClick={() => { setOpen(null); void run('cubeEquip', { slot: i, power: null }); }}>None</button>
                {options.map((id) => (
                  <button key={id} class={cls('ks-opt', p === id && 'cur')} onClick={() => { setOpen(null); void run('cubeEquip', { slot: i, power: id }); }}>
                    <b>{LEGENDARIES[id].name}</b>
                    <em>{powerText(id)}</em>
                  </button>
                ))}
                {options.length === 0 && <div class="ks-none">No learned {slot} powers.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExtractView({ item, char }: { item: Item | null; char: CharacterSave }) {
  const learned = item?.legendary ? char.cube.learned.includes(item.legendary.power) : false;
  return (
    <div class="cv">
      {item?.legendary && (
        <div class="cv-row">
          <label>Teaches</label>
          <span class="teach"><b class="r-legendary">{LEGENDARIES[item.legendary.power].name}</b>{learned ? <em class="have"><IconCheck size={10} /> Already learned</em> : <em class="new">New power</em>}</span>
        </div>
      )}
      <div class="cv-label">Ancient power slots <span>({char.cube.learned.length} powers learned, always at their best roll)</span></div>
      <KanaiSlots char={char} />
    </div>
  );
}

function SocketView({ item, char }: { item: Item | null; char: CharacterSave }) {
  const [pick, setPick] = useState<number | null>(null);
  if (!item) return <Hint>Place an item to add sockets or to insert and remove gems.</Hint>;
  const max = maxSockets(item);
  const gems = Object.entries(char.gems).filter(([, n]) => n > 0).map(([k]) => { const [gem, rank] = k.split(':'); return { gem, rank: Number(rank), n: char.gems[k] }; });
  return (
    <div class="cv">
      <div class="cv-label">Sockets <span>{item.sockets.length} / {max}</span></div>
      {max === 0 && <Hint>This kind of item cannot be socketed.</Hint>}
      <div class="sock-list">
        {item.sockets.map((s, i) => (
          <div class={cls('sock-row', s && 'full')} key={i}>
            <span class="sr-ic">{s ? <GemIcon gem={s.gem} size={26} /> : <i class="sr-hole" />}</span>
            <span class="sr-t">{s ? <b style={{ color: lighten(gemColor(s.gem), 0.3) }}>{gemName(s.gem, s.rank)}</b> : <b class="pn-dim">Empty socket</b>}</span>
            {s ? (
              <button class={cls('btn sm', char.gold < gemRemoveCost(s.rank) && 'short')} disabled={char.gold < gemRemoveCost(s.rank)} onClick={() => void run('removeGem', { itemId: item.id, idx: i })}>
                Remove <span class={cls('pn-inl', char.gold < gemRemoveCost(s.rank) && 'short')}>{fmtInt(gemRemoveCost(s.rank))}</span>
              </button>
            ) : (
              <button class="btn sm" disabled={!gems.length} onClick={() => setPick(pick === i ? null : i)}>Insert gem</button>
            )}
            {pick === i && !s && (
              <div class="gem-pick">
                {gems.map((g) => (
                  <button key={`${g.gem}:${g.rank}`} onClick={() => { setPick(null); void run('insertGem', { itemId: item.id, gem: g.gem, rank: g.rank }); }}>
                    <GemIcon gem={g.gem} size={22} />
                    <b>{gemName(g.gem, g.rank)}</b>
                    <em>×{g.n}</em>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {item.sockets.length < max && <div class="sock-row add"><span class="sr-ic"><i class="sr-hole plus" /></span><span class="sr-t"><b class="pn-dim">New socket available</b></span></div>}
      </div>
    </div>
  );
}

function ReforgeView({ item }: { item: Item | null }) {
  return (
    <div class="cv">
      <Note>Every property is rerolled as if the item had just dropped. The power and look stay the same, it may become Ancient, and its upgrade tier and enchantment reset.</Note>
      {item && <div class="cv-row"><label>Current</label><span class="cur-line"><b class={rarityClass(item)}>{item.name}</b><em>{item.ancient ? (item.ancient === 2 ? 'Primal Ancient' : 'Ancient') : 'Normal roll'}{item.upgrade ? ` · +${item.upgrade}` : ''}</em></span></div>}
    </div>
  );
}

// ───────────────────────────── panel ─────────────────────────────

const ACTION_LABEL: Record<CubeOp, string> = {
  salvage: 'Salvage', fuse: 'Fuse 3 into 1', enchant: 'Enchant', upgrade: 'Empower', transmute: 'Transmute', extract: 'Extract Power', reforge: 'Reforge', socket: 'Add Socket',
};

function costFor(fn: CubeOp, item: Item | null, fuseRank: number | null): Cost | null {
  switch (fn) {
    case 'salvage': return { gold: 0, mats: {} };
    case 'fuse': return fuseRank ? fuseCost(fuseRank) : null;
    case 'enchant': return item ? enchantCost(item) : null;
    case 'upgrade': return item ? upgradeCost(item) : null;
    case 'transmute': return transmuteCost();
    case 'extract': return extractCost();
    case 'reforge': return reforgeCost();
    case 'socket': return item ? socketCost(item) : null;
  }
}

export function CubePanel() {
  const char = useU((s) => s.char);
  const artisan = useU((s) => s.artisan);
  const available = ARTISAN_FUNCTIONS[artisan];
  const { fn, itemId, busy, affix, result } = useLocal(cubeUI, (s) => s);
  useEffect(() => { if (!available.includes(fn)) cubeUI.set({ fn: available[0], affix: null }); }, [artisan, fn]);
  const pending = useU((s) => s.enchant);
  const [fuseSel, setFuseSel] = useState<string | null>(null);
  const [armed, arm] = useConfirmBtn();
  const lastLevel = useRef<number | null>(null);

  const level = char?.cube.level ?? 1;
  useEffect(() => {
    if (lastLevel.current !== null && level > lastLevel.current) {
      const unlocked = CUBE_FUNCTIONS.filter((f) => f.unlock === level).map((f) => f.name);
      flash('success', `Cube Level ${level}`, unlocked.length ? `Unlocked: ${unlocked.join(', ')}` : undefined);
    }
    lastLevel.current = level;
  }, [level]);

  // Drop a stale item selection (salvaged, transmuted away...).
  const item = itemById(char, itemId);
  useEffect(() => { if (itemId && char && !item) cubeUI.set({ itemId: null, affix: null }); }, [itemId, !!item]);

  if (!char) return null;
  const def = CUBE_FUNCTIONS.find((f) => f.op === fn)!;
  const locked = level < def.unlock;
  const need = cubeXpToNext(level);

  // Default gem stack for fusion.
  const gemKeys = Object.entries(char.gems).filter(([, n]) => n > 0).map(([k]) => k);
  const fuseKey = fuseSel && char.gems[fuseSel] > 0 ? fuseSel : gemKeys.find((k) => char.gems[k] >= 3 && Number(k.split(':')[1]) < 6) ?? gemKeys[0] ?? null;
  const fuseGem = fuseKey ? { gem: fuseKey.split(':')[0], rank: Number(fuseKey.split(':')[1]) } : null;

  const reason = invalidReason(fn, item)
    ?? (fn === 'reforge' && item && pending?.itemId === item.id
      ? 'Choose your pending enchantment at the Mystic before reforging this item.' : null);
  const cost = costFor(fn, item, fuseGem?.rank ?? null);
  const afford = cost ? canAfford(char, cost) : false;
  let canAct = !locked && !busy && !!cost && afford && !reason;
  if (fn === 'enchant') canAct = canAct && affix !== null && item !== null && canEnchantAffix(item, affix) && !(pending && pending.itemId === item.id);
  if (fn === 'fuse') canAct = !locked && !busy && !!fuseGem && char.gems[fuseKey!] >= 3 && fuseGem.rank < 6 && afford;
  if (fn === 'upgrade' && item && item.upgrade >= 10) canAct = false;

  const act = async () => {
    if (!canAct) return;
    cubeUI.set({ busy: true });
    try {
      switch (fn) {
        case 'salvage': {
          const it = item!;
          const r = await run('salvage', { itemId: it.id });
          if (r.ok) { setCubeItem(null); flash('success', 'Salvaged', `+${salvageXp(it)} Cube XP`); }
          break;
        }
        case 'fuse': {
          const g = fuseGem!;
          const r = await run('fuseGem', { gem: g.gem, rank: g.rank });
          if (r.ok) flash('success', 'Fused!', gemName(g.gem, g.rank + 1));
          break;
        }
        case 'enchant': {
          const r = await run<{ options: AffixRoll[] }>('enchantRoll', { itemId: item!.id, affix });
          if (r.ok && r.data?.options) ui.set({ enchant: { itemId: item!.id, affix: affix!, options: r.data.options } });
          break;
        }
        case 'upgrade': {
          const it = item!;
          const r = await run<{ success: boolean }>('upgrade', { itemId: it.id });
          if (r.ok) {
            if (r.data?.success) flash('success', `Empowered to +${it.upgrade + 1}`, 'All properties increased by 6%');
            else flash('fail', 'Empowerment Failed', `Fortune +${FORTUNE_PER_FAIL}% on the next attempt`);
          }
          break;
        }
        case 'transmute': {
          const r = await run('transmute', { itemId: item!.id });
          if (r.ok) { flash('success', 'Transmuted!', 'A new Legendary awaits in your bag'); setCubeItem(null); }
          break;
        }
        case 'extract': {
          const it = item!;
          const r = await run('extract', { itemId: it.id });
          if (r.ok) { flash('success', 'Power Learned', LEGENDARIES[it.legendary!.power].name); setCubeItem(null); }
          break;
        }
        case 'reforge': {
          const r = await run('reforge', { itemId: item!.id });
          if (r.ok) flash('success', 'Reforged!', 'Every property has been rerolled');
          break;
        }
        case 'socket': {
          const r = await run('socket', { itemId: item!.id });
          if (r.ok) flash('success', 'Socket Added');
          break;
        }
      }
    } finally {
      cubeUI.set({ busy: false });
    }
  };

  const dangerous = fn === 'salvage' && !!item && (item.rarity === 'legendary' || item.rarity === 'set' || item.ancient > 0 || item.upgrade > 0);
  const choosing = fn === 'enchant' && !!pending && !!item && pending.itemId === item.id;

  return (
    <PanelFrame id="cube" title={ARTISAN_NAMES[artisan]} width={840} icon={<CubeEmblem size={22} glow={false} />}>
      <div class="cube-top">
        <div class="cube-lv">
          <CubeEmblem size={54} class="cube-em" />
          <div class="cl-t"><span>Cube Level</span><b>{level}</b></div>
        </div>
        <div class="cube-xp">
          <Bar frac={char.cube.xp / need} text={`${fmtInt(char.cube.xp)} / ${fmtInt(need)} XP`} height={18} />
          <small>Artisan and Cube operations share Cube experience and unlock levels.</small>
        </div>
      </div>
      <div class="cube-main">
        <nav class="cube-nav">
          {CUBE_FUNCTIONS.filter(f => available.includes(f.op)).map((f) => {
            const lk = level < f.unlock;
            return (
              <button key={f.op} class={cls('cn', fn === f.op && 'on', lk && 'locked')} onClick={() => cubeUI.set({ fn: f.op, affix: null })}>
                <span class="cn-ic"><CubeFnIcon op={f.op} size={20} /></span>
                <span class="cn-n">{f.name}</span>
                {lk ? <span class="cn-lock"><IconLock size={10} />Lv {f.unlock}</span> : <span class="cn-xp">+{CUBE_XP[f.op]}</span>}
              </button>
            );
          })}
        </nav>
        <div class="cube-work">
          <header class="cw-head">
            <span class="cw-ic"><CubeFnIcon op={def.op} size={26} /></span>
            <div class="cw-t">
              <h3>{def.name}</h3>
              <p>{def.desc}</p>
            </div>
          </header>
          <div class="cw-stage">
            <Chamber item={fn === 'fuse' ? null : item} gems={fn === 'fuse' ? fuseGem : null} />
            <div class="cw-content">
              {locked && <Hint><IconLock size={14} /> Reach Cube level <b>{def.unlock}</b> to unlock {def.name}.</Hint>}
              {(!locked || fn === 'socket') && (
                <>
                  {fn === 'salvage' && <SalvageView item={item} />}
                  {fn === 'fuse' && <FuseView char={char} sel={fuseKey} onSel={setFuseSel} />}
                  {fn === 'enchant' && <EnchantView item={item} char={char} />}
                  {fn === 'upgrade' && <UpgradeView item={item} />}
                  {fn === 'transmute' && <TransmuteView item={item} />}
                  {fn === 'extract' && <ExtractView item={item} char={char} />}
                  {fn === 'reforge' && <ReforgeView item={item} />}
                  {fn === 'socket' && <SocketView item={item} char={char} />}
                  {reason && item && fn !== 'upgrade' && <div class="cw-warn">{reason}</div>}
                </>
              )}
            </div>
          </div>
          <footer class="cw-foot">
            <div class="cw-cost">
              <label>Cost</label>
              {cost && !locked ? <CostList cost={cost} char={char} /> : <span class="cost free">-</span>}
            </div>
            {!choosing && (
              <button
                class={cls('btn primary act', busy && 'busy', dangerous && armed && 'arm')}
                disabled={!canAct}
                onClick={() => (dangerous ? arm(() => void act()) : void act())}
              >
                {dangerous && armed ? 'Click again to confirm' : busy ? 'Working...' : ACTION_LABEL[fn]}
              </button>
            )}
            {choosing && <span class="cw-choosing">Pick an option above</span>}
          </footer>
          {result && (
            <div class={cls('banner', result.kind)} key={result.at}>
              <i class="b-glow" />
              <b>{result.title}</b>
              {result.sub && <span>{result.sub}</span>}
              {result.kind === 'success' && <IconStar4 size={22} class="b-star" />}
            </div>
          )}
        </div>
      </div>
    </PanelFrame>
  );
}

