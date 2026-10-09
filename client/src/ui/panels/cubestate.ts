// Cube workspace state shared by the Cube panel and the inventory (click an item while the Cube is open to load it).

import type { CubeOp } from '@shared/cube';
import { Local } from './state';

export interface CubeResult {
  kind: 'success' | 'fail' | 'info';
  title: string;
  sub?: string;
  at: number;
}

export const cubeUI = new Local<{
  fn: CubeOp;
  itemId: string | null;
  busy: boolean;
  /** Affix index chosen for enchanting. */
  affix: number | null;
  result: CubeResult | null;
}>({ fn: 'salvage', itemId: null, busy: false, affix: null, result: null });

export function setCubeItem(id: string | null) {
  cubeUI.set({ itemId: id, affix: null, result: null });
}

export type InvConfirm = { kind: 'salvage' | 'destroy'; item: import('@shared/types').Item };

/** Inventory-local UI state (tab, confirmation popups, salvage-all menu) shared with the drag layer. */
export const invUI = new Local<{
  tab: 'items' | 'gems';
  confirm: InvConfirm | null;
  salvageMenu: boolean;
  protectMode: boolean;
}>({ tab: 'items', confirm: null, salvageMenu: false, protectMode: false });
