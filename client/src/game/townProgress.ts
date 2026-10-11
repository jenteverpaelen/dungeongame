// Town reflects the systems (F-WLD-06; owner unfroze the town 2026-10-11). Per player and client-only: each Reliquary
// operation a hero has unlocked adds one prop at the artisan who performs it, and every bought stash tab adds a
// strongbox beside the stash. Diablo III's artisan shops visibly grow as the artisans are trained [K]; here the step is
// the existing unlock table (shared/src/cube.ts CUBE_FUNCTIONS) and the stash tab count, so nothing new is invented.
// Props are cosmetic: no collision, services and their ids unchanged; positions are offsets from the authored NPC spot.
import { CUBE_FUNCTIONS, type CubeOp } from '@shared/cube';
import { MAX_STASH_TABS, stashTabs } from '@shared/stash';
import type { CharacterSave } from '@shared/types';

export type ProgressRole = 'blacksmith' | 'jeweler' | 'mystic' | 'cube' | 'stash';
export interface TownProgressProp {
  id: string; role: ProgressRole; kind: string;
  /** Offset from the NPC's authored spot (world units); props sit on the shop front, clear of the approach point. */
  dx: number; dy: number; s?: number; v?: number; flip?: boolean;
  /** What it shows (for tests and the log). */
  shows: string;
  on: (save: CharacterSave) => boolean;
}

const unlockOf = (op: CubeOp) => CUBE_FUNCTIONS.find((f) => f.op === op)!.unlock;
const reliquary = (op: CubeOp) => (save: CharacterSave) => (save.cube?.level ?? 1) >= unlockOf(op);
const op = (o: CubeOp) => CUBE_FUNCTIONS.find((f) => f.op === o)!.name;

export const TOWN_PROGRESS: readonly TownProgressProp[] = [
  { id: 'smith-brazier', role: 'blacksmith', kind: 'brazier', dx: -118, dy: -22, shows: op('upgrade'), on: reliquary('upgrade') },
  { id: 'jeweler-table', role: 'jeweler', kind: 'crystal-table', dx: 92, dy: -18, shows: op('fuse'), on: reliquary('fuse') },
  { id: 'jeweler-lantern', role: 'jeweler', kind: 'stone-lantern', dx: 150, dy: -10, shows: op('socket'), on: reliquary('socket') },
  { id: 'glass-lantern', role: 'mystic', kind: 'stone-lantern', dx: -82, dy: -8, shows: op('enchant'), on: reliquary('enchant') },
  // Lanterns frame the rotunda door (a resident stands further west); the brazier sits in the western corner.
  { id: 'reliquary-lantern-w', role: 'cube', kind: 'stone-lantern', dx: -62, dy: -8, shows: op('transmute'), on: reliquary('transmute') },
  { id: 'reliquary-lantern-e', role: 'cube', kind: 'stone-lantern', dx: 96, dy: -8, shows: op('extract'), on: reliquary('extract') },
  { id: 'reliquary-brazier', role: 'cube', kind: 'brazier', dx: -165, dy: -2, shows: op('reforge'), on: reliquary('reforge') },
  // One strongbox per bought tab (tabs II…V), a 2 × 2 cluster west of the stash chest (the vault clerk stands east of it).
  ...([[-60, -16, 'barrels', 1], [-100, -12, 'crates', 1], [-64, 6, 'crates', 0.85], [-102, 8, 'barrels', 0.85]] as const).map(([dx, dy, kind, s], k): TownProgressProp => {
    const tab = k + 2;
    return { id: `vault-${tab}`, role: 'stash', kind, dx, dy, s, shows: `stash tab ${tab}`, on: (save) => stashTabs(save) >= tab };
  }),
];
// MAX_STASH_TABS − 1 strongboxes, one per buyable tab.
if (TOWN_PROGRESS.filter((p) => p.role === 'stash').length !== MAX_STASH_TABS - 1) throw new Error('townProgress: one strongbox per buyable stash tab');

/** Ids of the progress props this save shows. */
export function visibleTownProgress(save: CharacterSave | null): string[] {
  return save ? TOWN_PROGRESS.filter((p) => p.on(save)).map((p) => p.id) : [];
}
