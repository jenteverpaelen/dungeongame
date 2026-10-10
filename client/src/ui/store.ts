// Tiny observable store for the DOM UI (Preact). The game loop writes into it; components read via useUI().

import { introduced } from '@shared/onboarding';
import { text } from '../i18n/messages';
import { useEffect, useState } from 'preact/hooks';
import type { MapData, NpcRole } from '@shared/mapgen';
import type { AccountMode, AuthCharacter, FieldEventState, DungeonState, LootView, MeState, RiftState, WorldInfo, ZoneInfo } from '@shared/protocol';
import type { AffixRoll, CharacterSave, ClassId, DerivedStats, Materials } from '@shared/types';
import type { Artisan } from '@shared/townServices';
import type { RunSummary } from '../game/runSummary';

export type PanelId = 'inventory' | 'skills' | 'paragon' | 'cube' | 'waypoint' | 'obelisk' | 'help' | 'debug' | 'stash' | 'settings' | 'adventure' | 'worldmap' | 'runSummary' | 'character' | 'merchant' | 'party' | 'social' | 'inspect' | 'community' | 'collection' | 'dialogue';

export interface ChatLine { id: number; ch: import('@shared/social').ChatChannel | 'system'; from?: string; to?:string; cls?: ClassId; text: string; at: number;messageId?:string; item?:import('@shared/types').Item }
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

/** Account screens (select screen only). `mode` is what the server enforces; `off` hides everything. */
export interface AccountView {
  mode: AccountMode;
  username: string | null;
  characters: AuthCharacter[];
  busy: boolean;
  error: string | null;
  /** One-time recovery codes waiting to be acknowledged (after registering or asking for new ones). */
  codes: string[] | null;
  /** Account dialog visible. Forced open by the screen while a required login is missing. */
  open: boolean;
  /** Hero the player chose from their account; the select screen copies it into the name and class fields. */
  picked: AuthCharacter | null;
}

export interface UIState {
  helpTab:'controls'|'guide'|'intro'|'faq'|'timings';
  adventureTarget: string | null;
  adventureZone: string | null;
  journalQuest: string | null;
  screen: 'select' | 'connecting' | 'game';
  account: AccountView;
  connected: boolean;
  error: string | null;
  char: CharacterSave | null;
  derived: DerivedStats | null;
  me: MeState | null;
  myId: number;
  zone: ZoneInfo | null;
  rift: RiftState | null;
  dungeon: DungeonState | null;
  fieldEvents: FieldEventState[];
  lastRun: RunSummary | null;
  world: WorldInfo | null;
  party: import('@shared/party').PartyView|null;
  social: import('@shared/social').SocialView|null;
  inspectionName:string;
  reportContext:{name:string;message:string}|null;
  chatChannel:import('@shared/social').ChatChannel;
  chatTarget:string;
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
  /** Person the dialogue window is talking to (opened by E on a quest contact). */
  dialogue: { zone: string; target: string; name: string; role: string } | null;
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
  helpTab:'controls',
  adventureTarget: null, adventureZone:null, journalQuest:null,
  screen: 'select', connected: false, error: null,
  account: { mode: 'off', username: null, characters: [], busy: false, error: null, codes: null, open: false, picked: null },
  char: null, derived: null, me: null, myId: 0, zone: null, rift: null, dungeon:null, fieldEvents:[], lastRun:null, world: null,party:null,social:null,inspectionName:'',reportContext:null,chatChannel:'zone',chatTarget:'',
  panels: {}, artisan: 'cube', chat: [], chatOpen: false, notices: [], pickups: [], afk: null,
  target: null, interact: null, dialogue: null, enchant: null, fps: 0, ping: 0, dps: 0,
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

/** First-open guidance for a panel during onboarding (shown as a card inside the panel, never as a screen banner). */
export function panelIntro(id: PanelId): string | null {
  const current=ui.get();
  if(introduced(current.char,id))return null;
  const key=id==='inventory'||id==='character'?'intro.faq.loot.body':id==='skills'?'intro.faq.points.body':id==='adventure'?'intro.faq.map.body':undefined;
  return key?text(key):null;
}

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
