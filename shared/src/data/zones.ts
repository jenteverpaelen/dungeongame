// World layout: a shared hub town, shared open training fields split into channels,
// and instanced Nephalem-style rifts for parties.

export type ZoneKind = 'town' | 'field' | 'rift';
export type Theme = 'town' | 'glade' | 'ashen';

export interface ZoneDef {
  id: string;
  name: string;
  kind: ZoneKind;
  theme: Theme;
  /** Monster level follows the nearest player, clamped to this band (D3 Adventure Mode scaling). */
  levelBand: [number, number];
  size: [number, number]; // tiles
  /** Target number of living packs maintained in a shared field; rifts are pre-populated. */
  packTarget: number;
  respawnSec: number;
  blurb: string;
}

export const ZONES: Record<string, ZoneDef> = {
  hearthmere: {
    id: 'hearthmere', name: 'Hearthmere', kind: 'town', theme: 'town', levelBand: [1, 70], size: [96, 64],
    packTarget: 0, respawnSec: 0,
    blurb: 'The last lit hearth on the frontier. Every hero passes through its square.',
  },
  whispering_glade: {
    id: 'whispering_glade', name: 'The Whispering Glade', kind: 'field', theme: 'glade', levelBand: [1, 70], size: [120, 90],
    packTarget: 34, respawnSec: 18,
    blurb: 'Mossy woods where slimes swarm and the mushrooms walk.',
  },
  ashen_hollow: {
    id: 'ashen_hollow', name: 'Ashen Hollow', kind: 'field', theme: 'ashen', levelBand: [8, 70], size: [120, 90],
    packTarget: 38, respawnSec: 16,
    blurb: 'Cinder-choked ruins of a buried city. Imps nest in the ash.',
  },
  rift: {
    id: 'rift', name: 'Nephalem Rift', kind: 'rift', theme: 'glade', levelBand: [1, 70], size: [110, 110],
    packTarget: 0, respawnSec: 0,
    blurb: 'A tear in the world. Kill enough to draw out its Guardian.',
  },
};

export const FIELD_IDS = ['whispering_glade', 'ashen_hollow'];

/** Rift progress awarded per kill by elite tier (D3: trash ~1 progress orb, elites more). Total to summon guardian = 100. */
export const RIFT_PROGRESS = [0.55, 3, 4.5, 0.6, 0, 0];
