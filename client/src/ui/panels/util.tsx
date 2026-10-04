// Shared helpers for the panels: labels, number emphasis, item maths, command wrapper.

import type { ComponentChildren } from 'preact';
import { BASES } from '@shared/data/items';
import { affixLabel, RARITY_LABEL, slotsForKind, upgradeMult } from '@shared/items';
import type { CmdOp } from '@shared/protocol';
import type { AffixRoll, CharacterSave, Item, Slot } from '@shared/types';
import { cmd, type CmdResult } from '../../net/api';
import { pushNotice } from '../store';

export const SLOT_LABEL: Record<Slot, string> = {
  head: 'Head', shoulders: 'Shoulders', neck: 'Amulet', chest: 'Chest', hands: 'Hands', wrists: 'Bracers', waist: 'Belt',
  legs: 'Legs', feet: 'Feet', ring1: 'Ring', ring2: 'Ring', mainhand: 'Main Hand', offhand: 'Off Hand',
};

export const rarityKey = (item: Pick<Item, 'rarity'>) => item.rarity;

/** CSS class set describing an item's rarity / ancient state (see panels.css). */
export function rarityClass(item: Pick<Item, 'rarity' | 'ancient'>): string {
  return `r-${item.rarity}${item.ancient ? ` anc-${item.ancient}` : ''}`;
}

export function itemTypeLine(item: Item): string {
  const base = BASES[item.base];
  const rar = RARITY_LABEL[item.rarity];
  let noun = base?.noun ?? item.kind;
  if (base?.weapon && !base.weapon.ranged && ['Sword', 'Axe', 'Mace'].includes(noun)) noun = `${base.weapon.twoHanded ? 'Two-Handed' : 'One-Handed'} ${noun}`;
  return `${rar ? rar + ' ' : ''}${noun}`;
}

export function slotName(item: Item): string {
  const s = slotsForKind(item.kind)[0];
  return SLOT_LABEL[s];
}

/** Affix with the Cube upgrade multiplier applied (values and ranges), as the stat engine uses it. */
export function scaledAffix(a: AffixRoll, item: Item, tier = item.upgrade): AffixRoll {
  const m = 1 + 0.06 * tier;
  return { ...a, value: a.value * m, min: a.min * m, max: a.max * m };
}

export function affixText(a: AffixRoll, item: Item, tier = item.upgrade): string {
  return affixLabel(scaledAffix(a, item, tier));
}

export function weaponStats(item: Item, tier = item.upgrade) {
  if (!item.weapon) return null;
  const m = 1 + 0.06 * tier;
  const min = item.weapon.min * m, max = item.weapon.max * m;
  return { min, max, aps: item.weapon.aps, dps: ((min + max) / 2) * item.weapon.aps };
}

export function armorValue(item: Item, tier = item.upgrade): number | null {
  if (!item.armor) return null;
  return item.armor * (1 + 0.06 * tier);
}

export { upgradeMult };

const NUM_RE = /(\+?-?\d[\d,]*(?:\.\d+)?%?(?:-\d[\d,]*)?)/g;

/** Wraps the numeric tokens of an affix label in <b> so values read stronger than words. */
export function emphasize(text: string): ComponentChildren {
  const parts = text.split(NUM_RE);
  return parts.map((p, i) => (i % 2 === 1 ? <b>{p}</b> : p));
}

export function fmtRange(min: number, max: number): string {
  const f = (v: number) => (max >= 100 ? Math.round(v).toLocaleString('en-US') : (Math.round(v * 10) / 10).toString());
  return `${f(min)} – ${f(max)}`;
}

export function fmtPowerValue(v: number): string {
  if (v >= 10) return Math.round(v).toLocaleString('en-US');
  return (Math.round(v * 100) / 100).toString();
}

export function fmtDeltaPct(p: number): string {
  const a = Math.abs(p);
  return a >= 100 ? `${Math.round(a)}%` : `${a.toFixed(1)}%`;
}

/** Position of a value inside its roll range, 0..1. */
export function rollFraction(a: AffixRoll): number {
  return a.max > a.min ? Math.max(0, Math.min(1, (a.value - a.min) / (a.max - a.min))) : 1;
}

export function itemById(char: CharacterSave | null, id: string | null): Item | null {
  if (!char || !id) return null;
  for (const i of char.inventory) if (i && i.id === id) return i;
  for (const i of Object.values(char.equipment)) if (i && i.id === id) return i;
  return null;
}

export function equippedSlotOf(char: CharacterSave | null, id: string): Slot | null {
  if (!char) return null;
  for (const [s, i] of Object.entries(char.equipment)) if (i && i.id === id) return s as Slot;
  return null;
}

/** The slot an item would go into when equipped (empty ring slot first, as equipItem does). */
export function targetSlot(char: CharacterSave, item: Item): Slot {
  const slots = slotsForKind(item.kind);
  if (item.kind === 'ring') return !char.equipment.ring1 ? 'ring1' : !char.equipment.ring2 ? 'ring2' : 'ring1';
  return slots[0];
}

/** Send a command; failures surface as a warning notice. */
export async function run<T = unknown>(op: CmdOp, args?: Record<string, unknown>): Promise<CmdResult<T>> {
  let r: CmdResult<T>;
  try {
    r = await cmd<T>(op, args);
  } catch (e) {
    r = { ok: false, err: e instanceof Error ? e.message : 'Command failed' };
  }
  if (!r.ok) pushNotice(r.err ?? 'Command failed', 'warn');
  return r;
}

export const cls = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
