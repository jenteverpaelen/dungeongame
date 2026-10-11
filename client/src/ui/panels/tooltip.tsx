// The item card (Hearthfall's own layout, see docs/rework/TOOLTIP.md), the comparison row, a lightweight text
// tooltip and the cursor-following tooltip layer that every panel hovers into.

import type { ComponentChildren, VNode } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { AFFIX_BY_STAT, GEMS, LEGENDARIES, SETS } from '@shared/data/items';
import { CLASSES } from '@shared/data/classes';
import { SKILLS } from '@shared/data/skills';
import { RARITY_LABEL, canClassUse, slotsForKind } from '@shared/items';
import { gemName, upgradeChance } from '@shared/cube';
import { STAT_LABELS, compareItem, gemSlotRole } from '@shared/stats';
import { fmtInt } from '@shared/format';
import type { CharacterSave, DerivedStats, Element, Item, Slot } from '@shared/types';
import { GemIcon, EmptySocketIcon, IconDelta, IconStar4, gemColor, lighten, hex } from './icons';
import { ItemGlyph } from './glyphs';
import { itemIconUrl } from '../../render/art';
import { gearLook } from '@shared/gearVisual';
import { itemStyle } from '../../render/art/gearStyle';
import { text } from '../../i18n/messages';
import { Local, useLocal, useU } from './state';
import { preferences } from '../../game/preferences';
import {
  affixText, armorValue, cls, emphasize, fmtDeltaPct, fmtPowerValue, fmtRange, itemNoun, rarityClass, rollFraction,
  scaledAffix, slotName, targetSlot, weaponStats,
} from './util';

// ───────────────────────────── item icon ─────────────────────────────

export function ItemVisual({ item, size = 40 }: { item: Pick<Item, 'look' | 'kind'> | Item; size?: number }) {
  // Full items carry their visual identity into the icon (generation, rarity light, Set mark, grade jewels, +N stars);
  // stored looks never do. Lit late pieces breathe in their own light (DESIGN-V2 §6).
  const full = 'ilvl' in item && 'sockets' in item;
  const look = full ? gearLook(item as Item) : item.look;
  const st = full ? itemStyle(look) : null;
  const breathe = !!st && !!st.light && (st.top >= 1 || (st.special && st.gen >= 6));
  const vt = st ? '#' + (st.edgeLight || st.light).toString(16).padStart(6, '0') : '';
  const url = itemIconUrl(look, item.kind, size <= 48 ? 64 : 128);
  if (url) return <img class={`item-img${breathe ? ' vt-hi' : ''}`} style={breathe ? { '--vt': vt } : undefined} src={url} width={size} height={size} draggable={false} alt="" />;
  return <ItemGlyph look={item.look} kind={item.kind} size={size} />;
}

// ───────────────────────────── alt tracking ─────────────────────────────

export const tipStore = new Local<{ content: TipContent | null; alt: boolean }>({ content: null, alt: false });

export function useAlt(): boolean {
  return useLocal(tipStore, (s) => s.alt);
}

/** Alt reveals affix ranges. Installed by PanelsRoot; returns the cleanup. */
export function installAltTracking(): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.key !== 'Alt') return;
    if (tipStore.get().content) e.preventDefault();
    if (!tipStore.get().alt) tipStore.set({ alt: true });
  };
  const up = (e: KeyboardEvent) => { if (e.key === 'Alt' && tipStore.get().alt) tipStore.set({ alt: false }); };
  const blur = () => { if (tipStore.get().alt) tipStore.set({ alt: false }); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

// ───────────────────────────── the card ─────────────────────────────

/** "If equipped" summary: sheet damage and survival change plus the concrete stat changes behind them. */
interface Delta { damage: number; toughness: number; lines: StatLine[]; more: number }
interface StatLine { key: string; text: string; up: boolean }

const ELEMENT_LABEL: Record<Element, string> = {
  physical: 'Physical', fire: 'Fire', cold: 'Cold', lightning: 'Lightning', poison: 'Poison', arcane: 'Arcane', holy: 'Holy',
};
type StatKey = 'mainStat' | 'vit' | 'life' | 'armor' | 'allRes' | 'chc' | 'chd' | 'ias' | 'cdr' | 'rcr' | 'area' | 'dmgPct'
  | 'elite' | 'lifePerHit' | 'lifePerKill' | 'lifeRegen' | 'ms' | 'maxResource' | 'resourceRegen' | 'goldFind' | 'xpPct' | 'thorns';
/** Order = reading priority; `pct` stats print with one decimal and a % sign. */
const DELTA_STATS: { k: StatKey; label: string; pct?: boolean }[] = [
  { k: 'mainStat', label: '' }, { k: 'dmgPct', label: 'Damage', pct: true }, { k: 'chc', label: 'Critical Hit Chance', pct: true },
  { k: 'chd', label: 'Critical Hit Damage', pct: true }, { k: 'ias', label: 'Attack Speed', pct: true },
  { k: 'cdr', label: 'Cooldown Reduction', pct: true }, { k: 'rcr', label: 'Resource Cost Reduction', pct: true },
  { k: 'area', label: 'Area Damage', pct: true }, { k: 'elite', label: 'Damage vs Elites', pct: true },
  { k: 'vit', label: 'Vitality' }, { k: 'life', label: 'Life' }, { k: 'armor', label: 'Armor' }, { k: 'allRes', label: 'All Resistance' },
  { k: 'lifePerHit', label: 'Life per Hit' }, { k: 'lifePerKill', label: 'Life per Kill' }, { k: 'lifeRegen', label: 'Life per Second' },
  { k: 'thorns', label: 'Thorns' }, { k: 'maxResource', label: 'Maximum Resource' }, { k: 'resourceRegen', label: 'Resource per Second' },
  { k: 'ms', label: 'Movement Speed', pct: true }, { k: 'goldFind', label: 'Gold Find', pct: true }, { k: 'xpPct', label: 'Bonus Experience', pct: true },
];
const MAX_DELTA_LINES = 6;

function fmtStatDelta(d: number, pct: boolean): string {
  const sign = d > 0 ? '+' : '−';
  const a = Math.abs(d);
  return pct ? `${sign}${(Math.round(a * 10) / 10).toLocaleString('en-US')}%` : `${sign}${fmtInt(Math.round(a))}`;
}

/** Concrete stat changes between two stat sheets, in reading priority. */
export function statDeltaLines(cur: DerivedStats, next: DerivedStats): { lines: StatLine[]; more: number } {
  const out: StatLine[] = [];
  const push = (key: string, label: string, d: number, pct: boolean) => {
    if (pct ? Math.abs(d) < 0.05 : Math.abs(d) < 0.5) return;
    out.push({ key, text: `${fmtStatDelta(d, pct)} ${label}`, up: d > 0 });
  };
  for (const s of DELTA_STATS) {
    const label = s.k === 'mainStat' ? STAT_LABELS[cur.mainStatId] ?? 'Main stat' : s.label;
    push(s.k, label, next[s.k] - cur[s.k], !!s.pct);
  }
  push('weapon', 'Average Weapon Damage', (next.weaponMin + next.weaponMax) / 2 - (cur.weaponMin + cur.weaponMax) / 2, false);
  for (const el of Object.keys(ELEMENT_LABEL) as Element[]) push(`ele:${el}`, `${ELEMENT_LABEL[el]} Damage`, (next.ele[el] ?? 0) - (cur.ele[el] ?? 0), true);
  const skills = new Set([...Object.keys(cur.skillDmg), ...Object.keys(next.skillDmg)]);
  for (const id of skills) push(`skill:${id}`, `${SKILLS[id]?.name ?? id} Damage`, (next.skillDmg[id] ?? 0) - (cur.skillDmg[id] ?? 0), true);
  return { lines: out.slice(0, MAX_DELTA_LINES), more: Math.max(0, out.length - MAX_DELTA_LINES) };
}

function DeltaPill({ label, v }: { label: string; v: number }) {
  const flat = Math.abs(v) < 0.05;
  const up = v > 0;
  return (
    <span class={cls('dp', flat ? 'flat' : up ? 'up' : 'down')}>
      <span class="dp-k">{label}</span>
      {flat ? <i class="dl-dash" /> : <IconDelta up={up} />}
      <b class="dp-v">{flat ? '0%' : fmtDeltaPct(v)}</b>
    </span>
  );
}

function DeltaBlock({ delta }: { delta: Delta }) {
  return (
    <section class="tt-cmp">
      <div class="cmp-h">
        <span class="cmp-t">If equipped</span>
        <DeltaPill label="Damage" v={delta.damage} />
        <DeltaPill label="Survival" v={delta.toughness} />
      </div>
      {delta.lines.length > 0 && (
        <ul class="cmp-lines">
          {delta.lines.map((l) => <li class={l.up ? 'up' : 'down'} key={l.key}>{emphasize(l.text)}</li>)}
          {delta.more > 0 && <li class="more" key="more">+{delta.more} more change{delta.more > 1 ? 's' : ''}</li>}
        </ul>
      )}
    </section>
  );
}

function AffixRow({ item, i, alt }: { item: Item; i: number; alt: boolean }) {
  const a = item.affixes[i];
  const ench = item.enchanted === i;
  const s = scaledAffix(a, item);
  const frac = rollFraction(a);
  return (
    <li class={cls('af', !a.primary && 'af-minor', ench && 'af-ench', alt && frac >= 0.98 && 'af-max')}>
      {ench ? <IconStar4 class="af-star" size={11} /> : <span class="af-b" />}
      <span class="af-t">{emphasize(affixText(a, item))}</span>
      {alt && (
        <span class="af-rng">
          {fmtRange(s.min, s.max)}
          <i class="af-meter"><u style={{ width: `${Math.round(frac * 100)}%` }} /></i>
        </span>
      )}
      {ench && !alt && <span class="af-etag">Enchanted</span>}
    </li>
  );
}

function SocketRows({ item }: { item: Item }) {
  if (!item.sockets.length) return null;
  const slot = slotsForKind(item.kind)[0];
  const role = gemSlotRole(slot);
  return (
    <ul class="tt-socks">
      {item.sockets.map((s, i) => {
        if (!s) {
          return (
            <li class="af sock empty" key={`s${i}`}>
              <span class="sk"><EmptySocketIcon size={18} /></span>
              <span class="af-t">Empty socket</span>
            </li>
          );
        }
        const def = GEMS[s.gem];
        if (!def) return null;
        const eff = def[role];
        const v = eff.values[Math.min(eff.values.length - 1, s.rank - 1)];
        const label = AFFIX_BY_STAT[eff.stat]?.label(v) ?? `${eff.stat} ${v}`;
        return (
          <li class="af sock" key={`s${i}`}>
            <span class="sk"><GemIcon gem={s.gem} size={18} /></span>
            <span class="af-t">
              <span class="tt-gem-n" style={{ color: lighten(gemColor(s.gem), 0.35) }}>{gemName(s.gem, s.rank)}</span>
              <span class="tt-gem-e">{emphasize(label)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Two or three equal stat tiles: weapon DPS / damage / speed, or armor / sockets. */
function KeyStats({ item }: { item: Item }) {
  const w = weaponStats(item);
  const armor = armorValue(item);
  const tiles: { k: string; v: string; main?: boolean }[] = [];
  if (w) {
    tiles.push({ k: 'DPS', v: fmtInt(w.dps), main: true }, { k: 'Damage', v: `${fmtInt(w.min)}–${fmtInt(w.max)}` }, { k: 'Speed', v: `${w.aps.toFixed(2)}/s` });
  } else if (armor !== null) {
    tiles.push({ k: 'Armor', v: fmtInt(armor), main: true });
    if (item.sockets.length) tiles.push({ k: 'Sockets', v: String(item.sockets.length) });
  }
  if (!tiles.length) return null;
  return (
    <div class={cls('tt-stats', `n${tiles.length}`)}>
      {tiles.map((t) => (
        <div class={cls('tst', t.main && 'main')} key={t.k}>
          <span class="tst-k">{t.k}</span>
          <span class="tst-v">{t.v}</span>
        </div>
      ))}
    </div>
  );
}

export function ItemCard({ item, char, alt, delta, tag }: { item: Item; char: CharacterSave | null; alt: boolean; delta?: Delta | null; tag?: string }) {
  const leg = item.legendary ? LEGENDARIES[item.legendary.power] : null;
  const setDef = item.set ? SETS[item.set] : null;
  // Core properties first, then the minor ones; one list, no section headings.
  const order = item.affixes.map((_, i) => i).sort((x, y) => Number(!item.affixes[x].primary) - Number(!item.affixes[y].primary) || x - y);

  let ownedNames = new Set<string>();
  let setCount = 0;
  if (setDef && char) {
    for (const e of Object.values(char.equipment)) if (e?.set === item.set) { ownedNames.add(e.name); setCount++; }
  }

  const cubeLevel = char?.cube.level ?? 1;
  const showTier = item.rarity !== 'normal' && (item.upgrade > 0 || cubeLevel >= 4);
  const reqBad = !!char && item.reqLevel > char.level;
  const classBad = !!char && !canClassUse(char.classId, item);
  const rar = RARITY_LABEL[item.rarity];

  return (
    <div class={cls('tt', rarityClass(item), item.ancient >= 1 && 'tt-apex', tag && 'tt-equipped')}>
      <i class="tt-rule" />
      {tag && <div class="tt-tagbar"><span>{tag}</span></div>}
      <header class="tt-head">
        <div class="tt-icon">
          <ItemVisual item={item} size={52} />
        </div>
        <div class="tt-titles">
          <div class="tt-name">{item.name}{item.upgrade > 0 && <span class="nm-up">+{item.upgrade}</span>}</div>
          <div class="tt-type">
            {rar && <span class="tt-rar">{rar}</span>}
            {rar && <i class="tt-dot" />}
            <span class="tt-kind">{itemNoun(item)}</span>
          </div>
        </div>
      </header>

      <div class="tt-body">
        <KeyStats item={item} />
        {delta && <DeltaBlock delta={delta} />}

        {order.length > 0 && <ul class="tt-props">{order.map((i) => <AffixRow item={item} i={i} alt={alt} key={i} />)}</ul>}
        <SocketRows item={item} />

        {leg && item.legendary && (
          <section class="tt-power">
            <span class="pw-l">Legendary power</span>
            <p>
              {leg.power.split('{v}').map((part, i, arr) => (
                <>
                  {part}
                  {i < arr.length - 1 && <b class="pw-v">{fmtPowerValue(item.legendary!.value)}</b>}
                </>
              ))}
              {alt && <span class="af-rng"> {fmtPowerValue(item.legendary.min)} – {fmtPowerValue(item.legendary.max)}</span>}
            </p>
          </section>
        )}

        {setDef && (
          <section class="tt-set">
            <div class="set-name">
              <span>{setDef.name}</span>
              <em>{setCount} / {setDef.pieces.length}</em>
            </div>
            <ul class="set-pieces">
              {setDef.pieces.map((p) => <li class={ownedNames.has(p.name) ? 'on' : 'off'} key={p.name}><i />{p.name}</li>)}
            </ul>
            <ul class="set-bonus">
              {setDef.bonuses.map((b) => (
                <li class={setCount >= b.count ? 'on' : 'off'} key={b.count}>
                  <b class="sb-n">{b.count}</b><span>{b.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.flavor && <p class="tt-flavor">{item.flavor}</p>}

        <footer class="tt-foot">
          <div class="req-row">
            <span class="slot">{slotName(item)}</span>
            <span class={reqBad ? 'bad' : ''}>Requires level <b>{item.reqLevel}</b></span>
            <span>Item level <b>{item.ilvl}</b></span>
            {item.bound && <span class="bound">Character bound</span>}
          </div>
          {classBad && char && <div class="bad one">{CLASSES[char.classId].name}s cannot use this item</div>}
          {item.vendorStock && <div class="note one">Merchant stock · cannot be salvaged</div>}
          {item.protected && <div class="note one">Protected · cannot destroy, salvage, transmute, extract, reforge, deliver or sell</div>}
          {showTier && (
            <div class="tier">
              <div class="tier-row">
                <span class="tier-l">Cube Tier</span>
                <span class="pips">{Array.from({ length: 10 }, (_, i) => <i class={i < item.upgrade ? 'on' : ''} key={i} />)}</span>
                <span class="tier-n">+{item.upgrade}</span>
              </div>
              {item.upgrade < 10 && (
                <div class="tier-sub">
                  Empower to <b>+{item.upgrade + 1}</b>: <b>{upgradeChance(item)}%</b> success
                  {item.upgradeFortune > 0 && <span class="fort"> (includes +{item.upgradeFortune}% Fortune)</span>}
                </div>
              )}
              {item.upgrade >= 10 && <div class="tier-sub"><b>Fully empowered</b></div>}
            </div>
          )}
          {delta && <div class="note one">Sheet estimate: conditional powers, set bonuses, enemy defences and uptime change real results.</div>}
        </footer>
      </div>
    </div>
  );
}

// ───────────────────────────── public tooltip component ─────────────────────────────

export interface ItemTooltipProps {
  item: Item;
  /** Show the equipped item(s) of the matching slot(s) next to this one with an "If equipped" summary. */
  compare?: boolean;
  /** Tag this card as the equipped one. */
  equipped?: boolean;
}

export function toDelta(c: ReturnType<typeof compareItem>): Delta {
  const { lines, more } = statDeltaLines(c.cur, c.next);
  return { damage: c.damage, toughness: c.toughness, lines, more };
}

/** Item tooltip. Renders in normal flow; use showItemTooltip()/itemHover() to attach it to the cursor. */
export function ItemTooltip({ item, compare = false, equipped = false }: ItemTooltipProps) {
  const char = useU((s) => s.char);
  const alt = useAlt();
  const eq: Item[] = [];
  let slot: Slot | null = null;
  if (compare && char) {
    for (const s of slotsForKind(item.kind)) { const e = char.equipment[s]; if (e && e.id !== item.id) eq.push(e); }
    slot = targetSlot(char, item);
  }
  const delta = useMemo(() => {
    if (!compare || !char || !slot) return null;
    try { return toDelta(compareItem(char, item, slot)); } catch { return null; }
  }, [char, item, compare, slot]);
  const rings = useMemo(() => {
    if (!compare || !char || item.kind !== 'ring') return null;
    try { return (['ring1', 'ring2'] as const).map((s) => ({ s, d: compareItem(char, item, s) })); } catch { return null; }
  }, [char, item, compare]);
  return (
    <div>
      {rings && (
        <div class="tt tt-lite tt-rings">
          {rings.map(({ s, d }) => (
            <p class="tl" key={s}>
              Replace <b>{s === 'ring1' ? 'left ring' : 'right ring'}</b>: Damage {fmtDeltaPct(d.damage)} · Survival {fmtDeltaPct(d.toughness)}
            </p>
          ))}
        </div>
      )}
      <div class="tt-row">
        <ItemCard item={item} char={char} alt={alt} delta={delta} tag={equipped ? 'Equipped' : undefined} />
        {eq.map((e) => <ItemCard item={e} char={char} alt={alt} tag="Equipped" key={e.id} />)}
      </div>
    </div>
  );
}


// ───────────────────────────── generic text tooltip ─────────────────────────────

export interface TextTipProps {
  title: string;
  color?: string;
  sub?: string;
  icon?: ComponentChildren;
  lines?: ComponentChildren[];
  note?: string;
}

export function TextTip({ title, color, sub, icon, lines, note }: TextTipProps) {
  return (
    <div class="tt tt-lite">
      <i class="tt-rule" />
      <header class="tt-head lite">
        {icon && <div class="tt-icon sm">{icon}</div>}
        <div class="tt-titles">
          <div class="tt-name sm" style={color ? { color } : undefined}>{title}</div>
          {sub && <div class="tt-type"><span class="tt-kind dimk">{sub}</span></div>}
        </div>
      </header>
      {(lines?.length || note) && (
        <div class="tt-body">
          {lines?.map((l) => <p class="tl">{l}</p>)}
          {note && <p class="tl note">{note}</p>}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── cursor-following layer ─────────────────────────────

export interface TipContent {
  key: string;
  node: ComponentChildren;
  /** Re-resolve the content when the character changes (items moved / consumed). Return null to hide. */
  refresh?: () => TipContent | null;
}

let ptr = { x: 0, y: 0 };
let tipBlocked = false;
/** Tooltips are suppressed while dragging (set by the drag layer). */
export function setTipBlocked(b: boolean) { tipBlocked = b; if (b) hideTip(); }
let layerEl: HTMLDivElement | null = null;

function place() {
  const el = layerEl;
  if (!el) return;
  if (!tipStore.get().content) { el.style.visibility = 'hidden'; return; }
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const s = Math.min(preferences.get().values.uiScale, (vw - 16) / w, (vh - 16) / h);
  const sw = w * s, sh = h * s;
  let x = ptr.x + 24;
  if (x + sw > vw - 8) x = ptr.x - 24 - sw;
  x = Math.max(8, Math.min(vw - sw - 8, x));
  let y = ptr.y - 16;
  if (y + sh > vh - 8) y = vh - sh - 8;
  y = Math.max(8, y);
  el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) scale(${s})`;
  el.style.visibility = 'visible';
}

export function showTip(content: TipContent, x?: number, y?: number) {
  if (x !== undefined && y !== undefined) ptr = { x, y };
  const cur = tipStore.get().content;
  if (!cur || cur.key !== content.key || cur.node !== content.node) tipStore.set({ content });
  place();
}

export function hideTip() {
  if (tipStore.get().content) tipStore.set({ content: null });
  if (layerEl) layerEl.style.visibility = 'hidden';
}

export function moveTip(x: number, y: number) {
  ptr = { x, y };
  place();
}

export function TipLayer() {
  const ref = useRef<HTMLDivElement>(null);
  const content = useLocal(tipStore, (s) => s.content);
  const char = useU((s) => s.char);

  useLayoutEffect(() => {
    layerEl = ref.current;
    const el = ref.current;
    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => place()); ro.observe(el); }
    return () => { ro?.disconnect(); if (layerEl === el) layerEl = null; };
  }, []);

  useLayoutEffect(() => { place(); }, [content]);

  // Items can move under a stationary cursor: re-resolve the hovered content on every character update.
  useEffect(() => {
    const c = tipStore.get().content;
    if (!c?.refresh) return;
    const next = c.refresh();
    if (!next) hideTip();
    else tipStore.set({ content: next });
  }, [char]);

  return (
    <div class="tip-layer" ref={ref} style={{ visibility: 'hidden' }}>
      {content?.node}
    </div>
  );
}

// ───────────────────────────── hover wiring ─────────────────────────────

export interface HoverHandlers {
  onPointerEnter: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerLeave: () => void;
}

export function tipHandlers(build: () => TipContent | null, isBlocked?: () => boolean): HoverHandlers {
  return {
    onPointerEnter: (e) => {
      if (tipBlocked || isBlocked?.()) return;
      ptr = { x: e.clientX, y: e.clientY };
      const c = build();
      if (c) showTip(c); else hideTip();
    },
    onPointerMove: (e) => { if (tipStore.get().content) moveTip(e.clientX, e.clientY); },
    onPointerLeave: () => hideTip(),
  };
}

/** Hover handlers for an item that can move: `resolve` is re-evaluated whenever the character changes. */
export function itemHover(resolve: () => Item | null, opts: { compare?: boolean; equipped?: boolean } = {}): HoverHandlers {
  const build = (): TipContent | null => {
    const item = resolve();
    if (!item) return null;
    return {
      key: `item:${item.id}:${item.upgrade}:${item.enchanted ?? -1}:${item.sockets.map((s) => (s ? s.gem + s.rank : '-')).join('')}:${opts.compare ? 1 : 0}`,
      node: <ItemTooltip item={item} compare={opts.compare} equipped={opts.equipped} />,
      refresh: build,
    };
  };
  return tipHandlers(build);
}

/** Imperative API: attach the item tooltip to the cursor position (viewport coordinates). */
export function showItemTooltip(item: Item, x: number, y: number, opts: { compare?: boolean; equipped?: boolean } = {}) {
  showTip({ key: `item:${item.id}`, node: <ItemTooltip item={item} compare={opts.compare} equipped={opts.equipped} /> }, x, y);
}

export const hideItemTooltip = hideTip;
export const moveItemTooltip = moveTip;

export function textTipHandlers(build: () => TextTipProps | null, key: string): HoverHandlers {
  return tipHandlers(() => {
    const p = build();
    return p ? { key: `txt:${key}`, node: <TextTip {...p} /> } : null;
  });
}

export type { VNode };
export { hex };
