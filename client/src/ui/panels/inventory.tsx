// Inventory (I / B): Diablo 3 style paperdoll over a 10x6 bag grid, character sheet strip, wealth row, gems tab.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CLASSES } from '@shared/data/classes';
import { AFFIX_BY_STAT, GEMS } from '@shared/data/items';
import { BULK_SALVAGE_RARITIES, CUBE_FUNCTIONS, gemName, salvageYield } from '@shared/cube';
import { fmtCompact, fmtInt } from '@shared/format';
import { INVENTORY_COLS, INVENTORY_SIZE } from '@shared/constants';
import { canClassUse } from '@shared/items';
import { compareItem, computeStats } from '@shared/stats';
import type { CharacterSave, Item, Materials, Rarity, Slot } from '@shared/types';
import { pushNotice, ui } from '../store';
import { Check, PanelFrame, Wealth } from './common';
import { cubeUI, invUI, setCubeItem } from './cubestate';
import { beginDrag, canDropOn, justDragged, useDrag } from './dnd';
import { SlotGlyph } from './glyphs';
import { GemIcon, IconDelta, MatIcon, MATERIAL_ORDER, gemColor, lighten } from './icons';
import { useLocal, useU } from './state';
import { hideTip, ItemVisual, itemHover, textTipHandlers } from './tooltip';
import { cls, itemById, rarityClass, run, SLOT_LABEL, targetSlot } from './util';
import { ITEM_PROTECTION_REASON } from '@shared/itemProtection';
import { ProtectionBadge, ProtectionButton, toggleItemProtection } from './itemProtection';

// ───────────────────────────── paperdoll ─────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }
const DOLL_W = 380, DOLL_H = 276;
const RECTS: Record<Slot, Rect> = {
  head: { x: 162, y: 0, w: 56, h: 54 },
  chest: { x: 154, y: 59, w: 72, h: 66 },
  waist: { x: 154, y: 130, w: 72, h: 38 },
  legs: { x: 158, y: 173, w: 64, h: 56 },
  feet: { x: 158, y: 234, w: 64, h: 42 },
  shoulders: { x: 0, y: 2, w: 56, h: 56 },
  hands: { x: 0, y: 64, w: 56, h: 56 },
  ring1: { x: 0, y: 126, w: 56, h: 56 },
  mainhand: { x: 0, y: 188, w: 56, h: 88 },
  neck: { x: 324, y: 2, w: 56, h: 56 },
  wrists: { x: 324, y: 64, w: 56, h: 56 },
  ring2: { x: 324, y: 126, w: 56, h: 56 },
  offhand: { x: 324, y: 188, w: 56, h: 88 },
};
const SLOT_ORDER = Object.keys(RECTS) as Slot[];
/** Icon size per slot (square icons inside non-square slots). */
const ICON_SIZE: Partial<Record<Slot, number>> = { waist: 44, chest: 56, legs: 48, feet: 38, mainhand: 66, offhand: 66 };
const iconSize = (slot: Slot) => ICON_SIZE[slot] ?? 42;

function Mannequin({ tint }: { tint: string }) {
  const half = 'M190 54 L178 54 L178 63 C164 65 150 70 141 82 L127 132 L121 152 L135 154 L147 114 L153 102 L157 144 L155 158 L151 252 L145 270 L149 280 L181 280 L183 174 L190 162 Z';
  return (
    <svg class="doll-fig" width={DOLL_W} height={DOLL_H} viewBox={`0 0 ${DOLL_W} ${DOLL_H}`} aria-hidden="true">
      <defs>
        <radialGradient id="dl-glow" cx=".5" cy=".42" r=".55">
          <stop offset="0" stop-color={tint} stop-opacity=".30" /><stop offset=".6" stop-color={tint} stop-opacity=".08" /><stop offset="1" stop-color={tint} stop-opacity="0" />
        </radialGradient>
        <linearGradient id="dl-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3c2e1c" /><stop offset="1" stop-color="#1a130d" />
        </linearGradient>
      </defs>
      <ellipse cx="190" cy="140" rx="150" ry="146" fill="url(#dl-glow)" />
      <circle cx="190" cy="138" r="122" fill="none" stroke="#c9a45c" stroke-opacity=".16" stroke-width="1" />
      <circle cx="190" cy="138" r="114" fill="none" stroke="#c9a45c" stroke-opacity=".22" stroke-width="1" stroke-dasharray="1.5 7" stroke-linecap="round" />
      <g stroke="#c9a45c" stroke-opacity=".28" stroke-width="1.4" stroke-linecap="round">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <line x1={190 + Math.cos(a) * 122} y1={138 + Math.sin(a) * 122} x2={190 + Math.cos(a) * 130} y2={138 + Math.sin(a) * 130} />;
        })}
      </g>
      <g fill="url(#dl-body)" stroke="#c9a45c" stroke-opacity=".55" stroke-width="1.3" stroke-linejoin="round">
        <path d={half} />
        <path d={half} transform="translate(380 0) scale(-1 1)" />
        <circle cx="190" cy="31" r="22" />
      </g>
      <path d="M170 24 C176 18 190 16 196 20" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}

function badgeOf(item: Item) {
  return item.upgrade > 0 ? <span class="cell-up">+{item.upgrade}</span> : null;
}

function SocketDots({ item }: { item: Item }) {
  if (!item.sockets.length) return null;
  return (
    <span class="sock-dots">
      {item.sockets.map((s) => (
        <i style={s ? { background: `radial-gradient(circle at 35% 30%, #fff, ${lighten(gemColor(s.gem), 0.1)} 40%, ${'#' + (gemColor(s.gem) & 0xffffff).toString(16).padStart(6, '0')})` } : undefined} class={s ? 'on' : ''} />
      ))}
    </span>
  );
}

function usableBy(char: CharacterSave, item: Item): boolean {
  return item.reqLevel <= char.level && canClassUse(char.classId, item);
}

/** Shift + right-click: valuable items ask first, plain gear is broken down immediately. */
function quickSalvage(item: Item) {
  if (item.protected) { pushNotice(ITEM_PROTECTION_REASON, 'warn'); return; }
  const char = ui.get().char;
  if (!char || char.cube.level < (CUBE_FUNCTIONS.find((f) => f.op === 'salvage')?.unlock ?? 1)) { pushNotice('The Cube cannot salvage yet', 'warn'); return; }
  const valuable = item.rarity === 'legendary' || item.rarity === 'set' || item.ancient > 0 || item.upgrade > 0 || item.enchanted !== undefined;
  if (valuable) invUI.set({ confirm: { kind: 'salvage', item } });
  else void run('salvage', { itemId: item.id });
}

function EqSlot({ slot, char }: { slot: Slot; char: CharacterSave }) {
  const protectMode = useLocal(invUI, s => s.protectMode);
  const item = char.equipment[slot] ?? null;
  const drag = useDrag();
  const r = RECTS[slot];
  const cubeOpen = useU((s) => !!s.panels.cube);
  const hover = item
    ? itemHover(() => ui.get().char?.equipment[slot] ?? null)
    : textTipHandlers(() => ({ title: SLOT_LABEL[slot], sub: 'Nothing equipped', note: 'Drag a matching item here, or right-click it in your bag.' }), `slot-${slot}`);
  return (
    <div
      class={cls('eq', `eq-${slot}`, item ? rarityClass(item) : 'empty', canDropOn(drag, `eq:${slot}`) && 'drop-ok', drag && !canDropOn(drag, `eq:${slot}`) && 'drop-no')}
      style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
      data-drop={`eq:${slot}`}
      data-slot={slot}
      role={protectMode && item ? 'button' : undefined} tabIndex={protectMode && item ? 0 : undefined}
      aria-label={protectMode && item ? `${item.protected ? 'Unprotect' : 'Protect'} ${item.name}` : undefined}
      onKeyDown={(e) => { if (protectMode && item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleItemProtection(item); } }}
      onPointerDown={item && !protectMode ? (e) => beginDrag(e as PointerEvent, { kind: 'eq', slot, item }) : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!item || protectMode) return;
        hideTip();
        if ((e as MouseEvent).shiftKey) quickSalvage(item);
        else void run('unequip', { slot });
      }}
      onClick={() => { if (!item || justDragged()) return; if (protectMode) toggleItemProtection(item); else if (cubeOpen) setCubeItem(item.id); }}
      {...hover}
    >
      <div class="eq-in">
        {item ? <ItemVisual item={item} size={iconSize(slot)} /> : <SlotGlyph slot={slot} size={iconSize(slot) - 2} />}
      </div>
      {item && badgeOf(item)}
      {item && <ProtectionBadge item={item} />}
      {item && <SocketDots item={item} />}
    </div>
  );
}

function Paperdoll({ char }: { char: CharacterSave }) {
  const tint = '#' + CLASSES[char.classId].themeColor.toString(16).padStart(6, '0');
  return (
    <div class="doll" style={{ width: DOLL_W, height: DOLL_H }}>
      <Mannequin tint={tint} />
      {SLOT_ORDER.map((s) => <EqSlot slot={s} char={char} key={s} />)}
    </div>
  );
}

// ───────────────────────────── character sheet strip ─────────────────────────────

const MAIN_LABEL = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' } as const;

function big(n: number): string {
  return n >= 1e8 ? fmtCompact(n) : fmtInt(n);
}

function StatsStrip({ char }: { char: CharacterSave }) {
  const given = useU((s) => s.derived);
  const d = useMemo(() => given ?? computeStats(char), [given, char]);
  const mini: [string, string][] = [
    [MAIN_LABEL[d.mainStatId], fmtInt(d.mainStat)],
    ['Vitality', fmtInt(d.vit)],
    ['Life', fmtInt(d.life)],
    ['Armor', fmtInt(d.armor)],
    ['All Resist', fmtInt(d.allRes)],
    ['Crit Chance', `${d.chc.toFixed(1)}%`],
    ['Crit Damage', `${fmtInt(d.chd)}%`],
    ['Attack Speed', `${d.aps.toFixed(2)}`],
    ['Cooldown Red.', `${d.cdr.toFixed(1)}%`],
    ['Area Damage', `${d.area.toFixed(0)}%`],
  ];
  return (
    <div class="sheet">
      <div class="sheet-big">
        <div class="sb dmg" {...textTipHandlers(() => ({ title: 'Damage', sub: 'Sheet damage per second', lines: [`Weapon ${fmtInt(d.weaponMin)}–${fmtInt(d.weaponMax)}, ${d.aps.toFixed(2)} attacks per second, ${d.chc.toFixed(1)}% crit chance for +${fmtInt(d.chd)}% damage.`] }), 'sb-dmg')}>
          <label>Damage</label><b>{big(d.sheetDps)}</b>
        </div>
        <div class="sb tgh" {...textTipHandlers(() => ({ title: 'Toughness', sub: 'Effective life', lines: [`Life ${fmtInt(d.life)} with ${(d.armorDR * 100).toFixed(1)}% armor and ${(d.resDR * 100).toFixed(1)}% resistance damage reduction.`] }), 'sb-tgh')}>
          <label>Toughness</label><b>{big(d.toughness)}</b>
        </div>
        <div class="sb rec" {...textTipHandlers(() => ({ title: 'Recovery', sub: 'Healing per second', lines: [`Life regeneration plus ${fmtInt(d.lifePerHit)} life on hit at ${d.aps.toFixed(2)} attacks per second.`] }), 'sb-rec')}>
          <label>Recovery</label><b>{big(d.recovery)}</b>
        </div>
      </div>
      <div class="sheet-mini">
        {mini.map(([k, v]) => (
          <div class="sh-mini" key={k}><label>{k}</label><b>{v}</b></div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── bag grid ─────────────────────────────

/** Items that would raise Damage or Toughness when equipped get a small green arrow (D3 console style). */
function useUpgradeFlags(char: CharacterSave): boolean[] {
  return useMemo(() => {
    return char.inventory.map((it) => {
      if (!it || !usableBy(char, it)) return false;
      try {
        const c = compareItem(char, it, targetSlot(char, it));
        return (c.damage > 0.4 && c.toughness > -3) || (c.toughness > 0.4 && c.damage > -3 && c.damage + c.toughness > 1);
      } catch { return false; }
    });
  }, [char.inventory, char.equipment, char.level, char.paragon, char.cube]);
}

function BagCell({ index, item, char, flag }: { index: number; item: Item | null; char: CharacterSave; flag: boolean }) {
  const protectMode = useLocal(invUI, s => s.protectMode);
  const drag = useDrag();
  const cubeOpen = useU((s) => !!s.panels.cube);
  const inCube = useLocal(cubeUI, (s) => !!item && s.itemId === item.id);
  const hover = itemHover(() => ui.get().char?.inventory[index] ?? null, { compare: true });
  const ok = canDropOn(drag, `bag:${index}`) && (!item || drag?.kind === 'bag' || drag?.kind === 'eq' || drag?.kind === 'gem');
  const bad = !!item && !usableBy(char, item);
  return (
    <div
      class={cls('cell', item ? rarityClass(item) : 'empty', bad && 'unusable', inCube && 'in-cube', ok && 'drop-ok')}
      data-drop={`bag:${index}`}
      data-idx={index}
      role={protectMode && item ? 'button' : undefined} tabIndex={protectMode && item ? 0 : undefined}
      aria-label={protectMode && item ? `${item.protected ? 'Unprotect' : 'Protect'} ${item.name}` : undefined}
      onKeyDown={(e) => { if (protectMode && item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleItemProtection(item); } }}
      onPointerDown={item && !protectMode ? (e) => beginDrag(e as PointerEvent, { kind: 'bag', index, item }) : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!item || protectMode) return;
        hideTip();
        if ((e as MouseEvent).shiftKey) quickSalvage(item);
        else void run('equip', { itemId: item.id });
      }}
      onClick={() => {
        if (!item || justDragged()) return;
        if (protectMode) toggleItemProtection(item);
        else if (ui.get().panels.stash) void run('stashDeposit', { itemId: item.id });
        else if (cubeOpen) setCubeItem(item.id);
      }}
      {...(item ? hover : {})}
    >
      {item && <ItemVisual item={item} size={32} />}
      {item && <ProtectionBadge item={item} />}
      {item && badgeOf(item)}
      {item && <SocketDots item={item} />}
      {item && flag && <i class="cell-flag"><IconDelta up size={8} /></i>}
    </div>
  );
}

function BagGrid({ char }: { char: CharacterSave }) {
  const flags = useUpgradeFlags(char);
  const cells = [];
  for (let i = 0; i < INVENTORY_SIZE; i++) cells.push(<BagCell key={i} index={i} item={char.inventory[i] ?? null} char={char} flag={flags[i]} />);
  return <div class="bag" style={{ gridTemplateColumns: `repeat(${INVENTORY_COLS}, 1fr)` }}>{cells}</div>;
}

// ───────────────────────────── gems tab ─────────────────────────────

function gemEntries(char: CharacterSave) {
  const order = Object.keys(GEMS);
  return Object.entries(char.gems)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => { const [gem, rank] = k.split(':'); return { gem, rank: Number(rank), n }; })
    .sort((a, b) => order.indexOf(a.gem) - order.indexOf(b.gem) || b.rank - a.rank);
}

export function gemEffectLines(gem: string, rank: number) {
  const def = GEMS[gem];
  return (['weapon', 'head', 'armor'] as const).map((role) => {
    const eff = def[role];
    const v = eff.values[Math.min(eff.values.length - 1, rank - 1)];
    return { role, text: AFFIX_BY_STAT[eff.stat]?.label(v) ?? `${eff.stat} ${v}` };
  });
}

const ROLE_LABEL = { weapon: 'Weapon', head: 'Helm', armor: 'Armor' } as const;

export function GemTipLines(gem: string, rank: number) {
  return gemEffectLines(gem, rank).map((l) => (
    <>
      <b>{ROLE_LABEL[l.role]}</b> {l.text}
    </>
  ));
}

function GemGrid({ char }: { char: CharacterSave }) {
  const list = gemEntries(char);
  const total = list.reduce((a, g) => a + g.n, 0);
  return (
    <div class="gems-tab">
      <div class="gems">
        {list.map((g) => (
          <div
            class="gem-tile"
            key={`${g.gem}:${g.rank}`}
            onPointerDown={(e) => beginDrag(e as PointerEvent, { kind: 'gem', gem: g.gem, rank: g.rank })}
            {...textTipHandlers(() => ({
              title: gemName(g.gem, g.rank), color: '#' + lighten(gemColor(g.gem), 0.3).slice(1), icon: <GemIcon gem={g.gem} size={34} />,
              sub: `Rank ${g.rank} of 6 · you have ${g.n}`, lines: GemTipLines(g.gem, g.rank), note: 'Drag onto an item with an empty socket.',
            }), `gem-${g.gem}-${g.rank}`)}
          >
            <GemIcon gem={g.gem} size={34} />
            <span class="gem-rank">{Array.from({ length: g.rank }, () => <i />)}</span>
            <b class="gem-cnt">{g.n}</b>
          </div>
        ))}
        {list.length === 0 && <div class="empty-note">No gems yet. Gems drop from elites and rift guardians.</div>}
      </div>
      <div class="gems-foot">{total} gems · fuse three of a kind in the Cube</div>
    </div>
  );
}

// ───────────────────────────── salvage ─────────────────────────────

const RARITY_NAME: Record<Rarity, string> = { normal: 'Normal', magic: 'Magic', rare: 'Rare', legendary: 'Legendary', set: 'Set' };

function sumYield(items: Item[]): Partial<Materials> {
  const out: Partial<Materials> = {};
  for (const it of items) for (const [k, v] of Object.entries(salvageYield(it)) as [keyof Materials, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}

function YieldChips({ y }: { y: Partial<Materials> }) {
  const e = MATERIAL_ORDER.filter((m) => (y[m] ?? 0) > 0);
  if (!e.length) return <span class="yield none">nothing</span>;
  return <span class="yield">{e.map((m) => <span key={m}><MatIcon id={m} size={16} /><b>{fmtInt(y[m]!)}</b></span>)}</span>;
}

function SalvageMenu({ char }: { char: CharacterSave }) {
  const sel = useRef<Record<string, boolean>>({ normal: true, magic: true, rare: false });
  const open = useLocal(invUI, (s) => s.salvageMenu);
  const [, rerender] = useForce();
  if (!open) return null;
  const rarities = BULK_SALVAGE_RARITIES.filter((r) => sel.current[r]);
  const items = char.inventory.filter((i): i is Item => !!i && !i.protected && rarities.includes(i.rarity));
  return (
    <div class="menu salvage-menu">
      <div class="menu-t">Salvage All</div>
      {BULK_SALVAGE_RARITIES.map((r) => {
        const n = char.inventory.filter((i) => i && !i.protected && i.rarity === r).length;
        return (
          <div class="menu-row" key={r}>
            <Check on={!!sel.current[r]} onChange={(v) => { sel.current[r] = v; rerender(); }}>
              <span class={`rar-name r-${r}`}>{RARITY_NAME[r]}</span>
            </Check>
            <em>{n}</em>
          </div>
        );
      })}
      <div class="menu-sum">You will receive <YieldChips y={sumYield(items)} /></div>
      <div class="menu-note">Protected, Legendary and Set items are never salvaged in bulk.</div>
      <div class="menu-act">
        <button class="btn sm" onClick={() => invUI.set({ salvageMenu: false })}>Cancel</button>
        <button class="btn sm primary" disabled={!items.length} onClick={() => { invUI.set({ salvageMenu: false }); void run('salvageAll', { rarities }); }}>
          Salvage {items.length}
        </button>
      </div>
    </div>
  );
}

function useForce(): [number, () => void] {
  const [n, set] = useState(0);
  return [n, () => set((x) => x + 1)];
}

function ConfirmDialog({ char }: { char: CharacterSave }) {
  const conf = useLocal(invUI, (s) => s.confirm);
  if (!conf) return null;
  const live = itemById(char, conf.item.id) ?? conf.item;
  const isSalvage = conf.kind === 'salvage';
  const yieldMats = salvageYield(live);
  const close = () => invUI.set({ confirm: null });
  return (
    <div class="confirm-veil" onClick={close}>
      <div class="confirm" onClick={(e) => e.stopPropagation()}>
        <div class={cls('confirm-item', rarityClass(live))}>
          <ItemVisual item={live} size={40} />
        </div>
        <div class="confirm-t">{isSalvage ? 'Salvage' : 'Destroy'} <span class={`rar-name ${rarityClass(live)}`}>{live.name}</span>?</div>
        {isSalvage ? <div class="confirm-s">You will receive <YieldChips y={yieldMats} /></div> : <div class="confirm-s">This cannot be undone.</div>}
        <div class="menu-act">
          <button class="btn sm" onClick={close}>Cancel</button>
          <button
            class="btn sm primary"
            disabled={!!live.protected}
            onClick={() => { close(); void run(isSalvage ? 'salvage' : 'destroy', { itemId: live.id }); }}
          >
            {isSalvage ? 'Salvage' : 'Destroy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── panel ─────────────────────────────

export function InventoryPanel() {
  useEffect(() => () => invUI.set({ protectMode: false }), []);
  const protectMode = useLocal(invUI, s => s.protectMode);
  const char = useU((s) => s.char);
  const tab = useLocal(invUI, (s) => s.tab);
  const menuOpen = useLocal(invUI, (s) => s.salvageMenu);
  const drag = useDrag();
  if (!char) return null;
  const used = char.inventory.filter(Boolean).length;
  return (
    <PanelFrame id="inventory" title="Inventory" width={466} sub={<span class="pn-lv">Level {char.level} {CLASSES[char.classId].name}</span>}>
      <Paperdoll char={char} />
      <StatsStrip char={char} />
      <Wealth char={char} />
      <div class="bag-bar">
        <div class="seg">
          <button class={cls('seg-b', tab === 'items' && 'on')} onClick={() => invUI.set({ tab: 'items' })}>Items <em>{used}/{INVENTORY_SIZE}</em></button>
          <button class={cls('seg-b', tab === 'gems' && 'on')} onClick={() => invUI.set({ tab: 'gems' })}>Gems</button>
        </div>
        <div class="bag-tools">
          <ProtectionButton />
          <button class={cls('btn sm', menuOpen && 'on')} onClick={() => invUI.set({ salvageMenu: !menuOpen })} {...textTipHandlers(() => ({ title: 'Salvage', lines: ['Shift + right-click an item to salvage it.', 'Salvage All breaks down every Normal, Magic or Rare item you tick.'] }), 'salv')}>
            Salvage All
          </button>
          <div class={cls('trash', drag?.kind === 'bag' && 'drop-ok')} data-drop="trash" {...textTipHandlers(() => ({ title: 'Destroy', lines: ['Drag an item here to destroy it.'] }), 'trash')}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 4.6 H12.5 L11.7 14 H4.3 Z M2.4 4.6 H13.6 M6 4.6 V2.8 H10 V4.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />
              <path d="M6.6 7 V12 M9.4 7 V12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
          </div>
        </div>
      </div>
      <div class="bag-wrap">
        {protectMode && <div class="cw-note">Click a bag or worn item to protect or unprotect it. Choose Done to finish.</div>}
        {tab === 'items' ? <BagGrid char={char} /> : <GemGrid char={char} />}
        <SalvageMenu char={char} />
        <ConfirmDialog char={char} />
      </div>
    </PanelFrame>
  );
}

