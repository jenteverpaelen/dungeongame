// Drag & drop with pointer events (no HTML5 DnD): a press that moves > 5px starts a drag, a ghost icon
// follows the pointer and the drop target is whatever [data-drop] element is under the pointer on release.

import { useLayoutEffect, useRef } from 'preact/hooks';
import { slotsForKind } from '@shared/items';
import type { Item, Slot } from '@shared/types';
import { ITEM_PROTECTION_REASON } from '@shared/itemProtection';
import { pushNotice, ui } from '../store';
import { invUI, setCubeItem } from './cubestate';
import { GemIcon } from './icons';
import { SkillGlyph } from './skillicons';
import { Local, useLocal } from './state';
import { ItemVisual, setTipBlocked } from './tooltip';
import { run } from './util';
import { SKILLS } from '@shared/data/skills';

export type DragPayload =
  | { kind: 'bag'; index: number; item: Item }
  | { kind: 'eq'; slot: Slot; item: Item }
  | { kind: 'gem'; gem: string; rank: number }
  | { kind: 'skill'; skillId: string };

export const dragStore = new Local<{ drag: DragPayload | null }>({ drag: null });

let suppress = false;
/** True for the click event that immediately follows a drag release (ignore it). */
export const justDragged = () => suppress;

let ghost: HTMLDivElement | null = null;
function moveGhost(x: number, y: number) {
  if (ghost) ghost.style.transform = `translate3d(${x - 24}px, ${y - 24}px, 0) rotate(-4deg)`;
}

export function useDrag(): DragPayload | null {
  return useLocal(dragStore, (s) => s.drag);
}

export function beginDrag(e: PointerEvent, payload: DragPayload) {
  if (e.button !== 0) return;
  const sx = e.clientX, sy = e.clientY;
  let started = false;
  const move = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      started = true;
      setTipBlocked(true);
      dragStore.set({ drag: payload });
      requestAnimationFrame(() => moveGhost(ev.clientX, ev.clientY));
    }
    moveGhost(ev.clientX, ev.clientY);
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
  };
  const up = (ev: PointerEvent) => {
    cleanup();
    if (!started) return;
    setTipBlocked(false);
    suppress = true;
    setTimeout(() => { suppress = false; }, 0);
    const target = dropTargetAt(ev.clientX, ev.clientY);
    dragStore.set({ drag: null });
    if (target) void handleDrop(payload, target);
  };
  const cancel = () => { cleanup(); setTipBlocked(false); dragStore.set({ drag: null }); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}

function dropTargetAt(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const t = (el as HTMLElement).closest?.('[data-drop]') as HTMLElement | null;
    if (t) return t.dataset.drop ?? null;
  }
  return null;
}

/** Can `payload` land on a drop target of this kind? Used to light up valid targets while dragging. */
export function canDropOn(payload: DragPayload | null, target: string): boolean {
  if (!payload) return false;
  const [kind, arg] = target.split(':');
  switch (payload.kind) {
    case 'bag':
      if (kind === 'bag') return Number(arg) !== payload.index;
      if (kind === 'eq') return slotsForKind(payload.item.kind).includes(arg as Slot);
      return kind === 'cube' || kind === 'trash';
    case 'eq':
      return kind === 'bag' || kind === 'cube';
    case 'gem':
      return kind === 'bag' || kind === 'eq';
    case 'skill':
      return kind === 'sslot';
  }
}

async function handleDrop(p: DragPayload, target: string) {
  const [kind, arg] = target.split(':');
  const char = ui.get().char;
  if (!char) return;
  if (p.kind === 'bag') {
    if (kind === 'bag') { const to = Number(arg); if (to !== p.index) await run('swapInv', { from: p.index, to }); }
    else if (kind === 'eq') { if (slotsForKind(p.item.kind).includes(arg as Slot)) await run('equip', { itemId: p.item.id, slot: arg }); }
    else if (kind === 'cube') setCubeItem(p.item.id);
    else if (kind === 'trash') {
      if (p.item.protected) pushNotice(ITEM_PROTECTION_REASON, 'warn');
      else invUI.set({ confirm: { kind: 'destroy', item: p.item } });
    }
  } else if (p.kind === 'eq') {
    if (kind === 'bag') await run('unequip', { slot: p.slot });
    else if (kind === 'cube') setCubeItem(p.item.id);
  } else if (p.kind === 'gem') {
    let target: Item | null | undefined = null;
    if (kind === 'bag') target = char.inventory[Number(arg)];
    else if (kind === 'eq') target = char.equipment[arg as Slot];
    if (target) {
      if (!target.sockets.some((s) => !s)) { pushNotice('That item has no empty socket', 'warn'); return; }
      await run('insertGem', { itemId: target.id, gem: p.gem, rank: p.rank });
    }
  } else if (p.kind === 'skill') {
    if (kind === 'sslot') await run('skillSlot', { slot: Number(arg), skill: p.skillId });
  }
}

/** The floating icon that follows the pointer during a drag. */
export function DragLayer() {
  const drag = useDrag();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { ghost = ref.current; return () => { if (ghost === ref.current) ghost = null; }; }, [drag]);
  if (!drag) return null;
  return (
    <div class="drag-ghost" ref={ref}>
      {drag.kind === 'bag' || drag.kind === 'eq' ? <ItemVisual item={drag.item} size={44} /> : null}
      {drag.kind === 'gem' && <GemIcon gem={drag.gem} size={40} />}
      {drag.kind === 'skill' && <SkillGlyph glyph={SKILLS[drag.skillId].icon.glyph} color={SKILLS[drag.skillId].icon.color} size={44} />}
    </div>
  );
}
