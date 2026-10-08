import type { CubeOp } from './cube';
import type { NpcRole } from './mapgen';
import type { CmdOp } from './protocol';

export type Artisan = 'blacksmith' | 'jeweler' | 'mystic' | 'cube';
export const ARTISAN_FUNCTIONS: Record<Artisan, CubeOp[]> = {
  blacksmith: ['salvage', 'upgrade'], jeweler: ['fuse', 'socket'], mystic: ['enchant'], cube: ['transmute', 'extract', 'reforge'],
};
export const ARTISAN_NAMES: Record<Artisan, string> = { blacksmith: 'Blacksmith', jeweler: 'Jeweler', mystic: 'Mystic', cube: "The Ancients' Cube" };
export const SERVICE_ROLE: Partial<Record<CmdOp, NpcRole>> = {
  salvage: 'blacksmith', salvageAll: 'blacksmith', upgrade: 'blacksmith',
  fuseGem: 'jeweler', insertGem: 'jeweler', removeGem: 'jeweler', socket: 'jeweler',
  enchantRoll: 'mystic', enchantPick: 'mystic',
  transmute: 'cube', extract: 'cube', reforge: 'cube', cubeEquip: 'cube',
  stashDeposit: 'stash', stashWithdraw: 'stash', paragon: 'paragon', paragonReset: 'paragon', riftOpen: 'obelisk',
  // travel/riftEnter also accept their actual authored exit/active portal, verified by World.
};
