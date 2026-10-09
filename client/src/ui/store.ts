// Tiny observable store for the DOM UI (Preact). The game loop writes into it; components read via useUI().

import { useEffect, useState } from 'preact/hooks';
import type { MapData, NpcRole } from '@shared/mapgen';
import type { LootView, MeState, RiftState, WorldInfo, ZoneInfo } from '@shared/protocol';
import type { AffixRoll, CharacterSave, ClassId, DerivedStats, Materials } from '@shared/types';
import type { Artisan } from '@shared/townServices';

export type PanelId = 'inventory' | 'skills' | 'paragon' | 'cube' | 'waypoint' | 'obelisk' | 'help' | 'debug' | 'stash' | 'settings';

export interface ChatLine { id: number; ch: 'zone' | 'world' | 'system'; from?: string; cls?: ClassId; text: string; at: number }
export interface Notice { id: number; text: string; kind: 'rift' | 'boss' | 'info' | 'legendary' | 'warn' | 'level'; at: number }
export interface PickupLine { id: number; lk: LootView['lk']; name: string; rarity?: string; amount?: number; at: number }
export interface AfkReport { ms: number; xp: number; gold: number; kills: number; mats: Partial<Materials>; zone: string; levels: number }

export interface TargetInfo {
  id: number;
  name: string;
  level: number;
  elite: number;
  affixes: string[];
  hpFrac: number;
}

export interface UIState {
  screen: 'select' | 'connecting' | 'game';
  connected: boolean;
  error: string | null;
  char: CharacterSave | null;
  derived: DerivedStats | null;
  me: MeState | null;
  myId: number;
  zone: ZoneInfo | null;
  rift: RiftState | null;
  world: WorldInfo | null;
  panels: Partial<Record<PanelId, boolean>>;
  artisan: Artisan;
  chat: ChatLine[];
  chatOpen: boolean;
  notices: Notice[];
  pickups: PickupLine[];
  afk: AfkReport | null;
  /** Boss or elite currently engaged (top-centre target frame). */
  target: TargetInfo | null;
  /** NPC the player stands next to ("E" to interact). */
  interact: { role: NpcRole; name: string } | null;
  /** Pending enchant choice (D3 Mystic: keep original or pick one of two). */
  enchant: { itemId: string; affix: number; options: AffixRoll[] } | null;
  fps: number;
  ping: number;
  /** Rolling damage per second dealt by the local player (5 s window). */
  dps: number;
}

type Listener = () => void;

class Store<T extends object> {
  private listeners = new Set<Listener>();
  constructor(private state: T) {}
  get(): T { return this.state; }
  set(patch: Partial<T> | ((s: T) => Partial<T>)) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }
  subscribe(l: Listener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
}

export const ui = new Store<UIState>({
  screen: 'select', connected: false, error: null,
  char: null, derived: null, me: null, myId: 0, zone: null, rift: null, world: null,
  panels: {}, artisan: 'cube', chat: [], chatOpen: false, notices: [], pickups: [], afk: null,
  target: null, interact: null, enchant: null, fps: 0, ping: 0, dps: 0,
});

/** Subscribe a component to a slice of UI state. Re-renders only when the selected value changes (shallow). */
export function useUI<R>(select: (s: UIState) => R): R {
  const [val, setVal] = useState(() => select(ui.get()));
  useEffect(() => {
    const sync = () => {
      const next = select(ui.get());
      setVal((prev) => (shallowEqual(prev, next) ? prev : next));
    };
    const unsub = ui.subscribe(sync);
    sync(); // catch changes that landed between the first render and subscribing
    return unsub;
  }, []);
  return val;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

let seq = 1;
export const nextId = () => seq++;

export function togglePanel(id: PanelId, open?: boolean) {
  ui.set((s) => ({ panels: { ...s.panels, [id]: open ?? !s.panels[id] } }));
}

export function closeAllPanels() {
  ui.set({ panels: {} });
}

export function pushNotice(text: string, kind: Notice['kind']) {
  const n: Notice = { id: nextId(), text, kind, at: performance.now() };
  ui.set((s) => ({ notices: [...s.notices.slice(-4), n] }));
}

export function pushChat(line: Omit<ChatLine, 'id' | 'at'>) {
  ui.set((s) => ({ chat: [...s.chat.slice(-80), { ...line, id: nextId(), at: performance.now() }] }));
}

// ─────────────────────────── Non-reactive world access (minimap etc.) ───────────────────────────

export interface MinimapEntity { id: number; k: string; x: number; y: number; el?: number; me?: boolean }

export interface WorldReader {
  map(): MapData | null;
  /** Entities currently known to the client (positions interpolated). */
  entities(): Iterable<MinimapEntity>;
  myPos(): { x: number; y: number } | null;
}

export const worldReader: { current: WorldReader | null } = { current: null };
