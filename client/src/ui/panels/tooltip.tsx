// The Diablo 3 style item tooltip (with TBH flair), the comparison row, a lightweight text tooltip and
// the cursor-following tooltip layer that every panel hovers into.

import type { ComponentChildren, VNode } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { AFFIX_BY_STAT, GEMS, LEGENDARIES, SETS } from '@shared/data/items';
import { CLASSES } from '@shared/data/classes';
import { canClassUse, slotsForKind } from '@shared/items';
import { gemName, upgradeChance } from '@shared/cube';
import { compareItem, gemSlotRole } from '@shared/stats';
import { fmtInt } from '@shared/format';
import type { CharacterSave, Item, Slot } from '@shared/types';
import { GemIcon, EmptySocketIcon, IconDelta, IconDiamond, IconStar4, gemColor, lighten, hex } from './icons';
import { ItemGlyph } from './glyphs';
import { itemIconUrl } from '../../render/art';
import { Local, useLocal, useU } from './state';
import {
  affixText, armorValue, cls, emphasize, fmtDeltaPct, fmtPowerValue, fmtRange, itemTypeLine, rarityClass, rollFraction,
  scaledAffix, slotName, targetSlot, weaponStats,
} from './util';

// ───────────────────────────── item icon ─────────────────────────────

export function ItemVisual({ item, size = 40 }: { item: Pick<Item, 'look' | 'kind'>; size?: number }) {
  const url = itemIconUrl(item.look, item.kind, size <= 48 ? 64 : 128);
  if (url) return <img class="item-img" src={url} width={size} height={size} draggable={false} alt="" />;
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

interface Delta { damage: number; toughness: number; recovery: number }

function DeltaCell({ label, v }: { label: string; v: number }) {
  const flat = Math.abs(v) < 0.05;
  const up = v > 0;
  return (
    <div class={cls('dl', flat ? 'flat' : up ? 'up' : 'down')}>
      <span class="dl-k">{label}</span>
      <span class="dl-v">
        {flat ? <i class="dl-dash" /> : <IconDelta up={up} />}
        {flat ? '0%' : fmtDeltaPct(v)}
      </span>
    </div>
  );
}

function AffixList({ item, alt, primary }: { item: Item; alt: boolean; primary: boolean }) {
  const rows = item.affixes.map((a, i) => ({ a, i })).filter((r) => r.a.primary === primary);
  return (
    <>
      {rows.map(({ a, i }) => {
        const ench = item.enchanted === i;
        const s = scaledAffix(a, item);
        const frac = rollFraction(a);
        return (
          <li class={cls('af', ench && 'af-ench', alt && frac >= 0.98 && 'af-max')} key={i}>
            {ench ? <IconStar4 class="af-star" size={11} /> : <span class="af-b" />}
            <span class="af-t">{emphasize(affixText(a, item))}</span>
            {alt && (
              <span class="af-rng">
                [{fmtRange(s.min, s.max)}]
                <i class="af-meter"><u style={{ width: `${Math.round(frac * 100)}%` }} /></i>
              </span>
            )}
            {ench && !alt && <span class="af-etag">Enchanted</span>}
          </li>
        );
      })}
    </>
  );
}

function SocketRows({ item }: { item: Item }) {
  if (!item.sockets.length) return null;
  const slot = slotsForKind(item.kind)[0];
  const role = gemSlotRole(slot);
  return (
    <>
      {item.sockets.map((s, i) => {
        if (!s) {
          return (
            <li class="af sock empty" key={`s${i}`}>
              <span class="sk"><EmptySocketIcon size={20} /></span>
              <span class="af-t">Empty Socket</span>
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
            <span class="sk"><GemIcon gem={s.gem} size={20} /></span>
            <span class="af-t">
              <span class="tt-gem-n" style={{ color: lighten(gemColor(s.gem), 0.35) }}>{gemName(s.gem, s.rank)}</span>
              <span class="tt-gem-e">{emphasize(label)}</span>
            </span>
          </li>
        );
      })}
    </>
  );
}

export function ItemCard({ item, char, alt, delta, tag }: { item: Item; char: CharacterSave | null; alt: boolean; delta?: Delta | null; tag?: string }) {
  const w = weaponStats(item);
  const armor = armorValue(item);
  const leg = item.legendary ? LEGENDARIES[item.legendary.power] : null;
  const setDef = item.set ? SETS[item.set] : null;
  const hasPrimary = item.affixes.some((a) => a.primary) || item.sockets.length > 0;
  const hasSecondary = item.affixes.some((a) => !a.primary);

  let ownedNames = new Set<string>();
  let setCount = 0;
  if (setDef && char) {
    for (const e of Object.values(char.equipment)) if (e?.set === item.set) { ownedNames.add(e.name); setCount++; }
  }

  const cubeLevel = char?.cube.level ?? 1;
  const showTier = item.rarity !== 'normal' && (item.upgrade > 0 || cubeLevel >= 4);
  const reqBad = !!char && item.reqLevel > char.level;
  const classBad = !!char && !canClassUse(char.classId, item);

  return (
    <div class={cls('tt', rarityClass(item), tag && 'tt-equipped')}>
      <i class="tt-edge" />
      {tag && <div class="tt-tagbar"><span>{tag}</span></div>}
      <header class="tt-head">
        <div class="tt-icon">
          <ItemVisual item={item} size={56} />
        </div>
        <div class="tt-titles">
          {item.ancient > 0 && (
            <div class="tt-anc">
              <IconDiamond size={7} />
              <span>{item.ancient === 2 ? 'Primal Ancient' : 'Ancient'}</span>
              <IconDiamond size={7} />
            </div>
          )}
          <div class="tt-name">{item.name}{item.upgrade > 0 && <span class="nm-up">+{item.upgrade}</span>}</div>
          <div class="tt-type">
            <span class="tt-kind">{itemTypeLine(item)}</span>
            <span class="tt-slot">{slotName(item)}</span>
          </div>
        </div>
      </header>

      {delta && (
        <div class="tt-delta">
          <DeltaCell label="Damage" v={delta.damage} />
          <DeltaCell label="Toughness" v={delta.toughness} />
          <DeltaCell label="Recovery" v={delta.recovery} />
        </div>
      )}

      <div class="tt-body">
        {w && (
          <div class="tt-big">
            <div class="big-n">{fmtInt(w.dps)}</div>
            <div class="big-l">Damage Per Second</div>
            <div class="big-sub"><b>{fmtInt(w.min)}–{fmtInt(w.max)}</b> Damage</div>
            <div class="big-sub dim"><b>{w.aps.toFixed(2)}</b> Attacks per Second</div>
          </div>
        )}
        {!w && armor !== null && (
          <div class="tt-big">
            <div class="big-n">{fmtInt(armor)}</div>
            <div class="big-l">Armor</div>
          </div>
        )}

        {hasPrimary && (
          <section class="tt-sec">
            <h4>Primary</h4>
            <ul><AffixList item={item} alt={alt} primary /><SocketRows item={item} /></ul>
          </section>
        )}
        {hasSecondary && (
          <section class="tt-sec sec2">
            <h4>Secondary</h4>
            <ul><AffixList item={item} alt={alt} primary={false} /></ul>
          </section>
        )}

        {leg && item.legendary && (
          <div class="tt-power">
            <IconDiamond class="pw-b" size={9} />
            <p>
              {leg.power.split('{v}').map((part, i, arr) => (
                <>
                  {part}
                  {i < arr.length - 1 && <b class="pw-v">{fmtPowerValue(item.legendary!.value)}</b>}
                </>
              ))}
              {alt && <span class="af-rng"> [{fmtPowerValue(item.legendary.min)} – {fmtPowerValue(item.legendary.max)}]</span>}
            </p>
          </div>
        )}

        {setDef && (
          <div class="tt-set">
            <div class="set-name">
              <span>{setDef.name}</span>
              <em>{setCount} / {setDef.pieces.length}</em>
            </div>
            <ul class="set-pieces">
              {setDef.pieces.map((p) => (
                <li class={ownedNames.has(p.name) ? 'on' : 'off'} key={p.name}>
                  <IconDiamond size={6} />{p.name}
                </li>
              ))}
            </ul>
            <ul class="set-bonus">
              {setDef.bonuses.map((b) => (
                <li class={setCount >= b.count ? 'on' : 'off'} key={b.count}>
                  <b class="sb-n">({b.count})</b> <span>Set:</span> {b.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.flavor && <p class="tt-flavor">{item.flavor}</p>}

        <footer class="tt-foot">
          <div class="req-row">
            <span class={reqBad ? 'bad' : ''}>Required Level <b>{item.reqLevel}</b></span>
            <span>Item Level <b>{item.ilvl}</b></span>
          </div>
          {classBad && char && <div class="bad one">{CLASSES[char.classId].name}s cannot use this item</div>}
          {item.bound && <div class="bound one">Account Bound</div>}
          {item.protected && <div class="bound one">Protected · cannot destroy, salvage, transmute, extract or reforge</div>}
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
        </footer>
      </div>
    </div>
  );
}

// ───────────────────────────── public tooltip component ─────────────────────────────

export interface ItemTooltipProps {
  item: Item;
  /** Show the equipped item(s) of the matching slot(s) next to this one with a Damage / Toughness / Recovery delta. */
  compare?: boolean;
  /** Tag this card as the equipped one. */
  equipped?: boolean;
}

/** Diablo 3 item tooltip. Renders in normal flow; use showItemTooltip()/itemHover() to attach it to the cursor. */
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
    try { const c = compareItem(char, item, slot); return { damage: c.damage, toughness: c.toughness, recovery: c.recovery }; } catch { return null; }
  }, [char, item, compare, slot]);
  return (
    <div class="tt-row">
      <ItemCard item={item} char={char} alt={alt} delta={delta} tag={equipped ? 'Equipped' : undefined} />
      {eq.map((e) => <ItemCard item={e} char={char} alt={alt} tag="Equipped" key={e.id} />)}
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
      <i class="tt-edge" />
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
  const s = Math.min(1, (vw - 16) / w, (vh - 16) / h);
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
