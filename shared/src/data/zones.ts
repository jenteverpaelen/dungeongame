// World layout: a shared hub town, shared open training fields split into channels,
// and instanced Nephalem-style rifts for parties.

export type ZoneKind = 'town' | 'field' | 'rift' | 'dungeon';
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
  rillwake_crossing: {
    id: 'rillwake_crossing', name: 'Rillwake Crossing', kind: 'field', theme: 'glade', levelBand: [1,4], size: [64,52],
    packTarget: 5, respawnSec: 18,
    blurb: 'Follow a flooded timber road to a silent mill. An optional adventure begins at the tender’s camp.',
  },
  ashen_hollow: {
    id: 'ashen_hollow', name: 'Ashen Hollow', kind: 'field', theme: 'ashen', levelBand: [8, 70], size: [120, 90],
    packTarget: 38, respawnSec: 16,
    blurb: 'Cinder-choked ruins of a buried city. Imps nest in the ash.',
  },
  bracken_sluice: {
    id:'bracken_sluice',name:'Bracken Sluice',kind:'field',theme:'glade',levelBand:[4,7],size:[56,48],
    packTarget:4,respawnSec:18,
    blurb:'A maintenance causeway above the flood. Follow Orren’s survey to reach the rootbound spillway.',
  },
  reedvault_pumpworks: {
    id:'reedvault_pumpworks',name:'Reedvault Pumpworks',kind:'dungeon',theme:'glade',levelBand:[7,9],size:[40,36],
    packTarget:0,respawnSec:0,
    blurb:'A private descent for you and your party beneath Bracken Sluice. Turn the pressure wheels, clear each chamber, and restart the buried pump. Enter through the hatch in Bracken; unfinished encounters reset when nobody remains in the chamber.',
  },
  cairnspill_terraces: {
    id:'cairnspill_terraces',name:'Cairnspill Terraces',kind:'field',theme:'glade',levelBand:[9,12],size:[56,48],packTarget:4,respawnSec:18,
    blurb:'Climb the old quarry road above the sluice. Fractured benches and an abandoned haulage track lead toward the kiln country.',
  },
  cinderwash_kilns: {
    id:'cinderwash_kilns',name:'Cinderwash Kilns',kind:'field',theme:'ashen',levelBand:[12,16],size:[56,48],packTarget:4,respawnSec:18,
    blurb:'The stone road ends in firing yards that burn without their keepers. Find the draught controls and stop the heat reaching the crown.',
  },
  kilnwatch_crown: {
    id:'kilnwatch_crown',name:'Kilnwatch Crown',kind:'field',theme:'ashen',levelBand:[16,20],size:[48,48],packTarget:3,respawnSec:18,
    blurb:'The last furnace overlooks the water road. Break its guardian, close the cold draw, and bring the surviving watchkeepers home.',
  },
  sablefen_causeway:{id:'sablefen_causeway',name:'Sablefen Causeway',kind:'field',theme:'glade',levelBand:[20,25],size:[56,48],packTarget:4,respawnSec:18,
    blurb:'A split causeway above drowned cargo. Follow the toll writs to the salt road.'},
  saltwind_pans:{id:'saltwind_pans',name:'Saltwind Pans',kind:'field',theme:'glade',levelBand:[25,30],size:[56,48],packTarget:4,respawnSec:18,
    blurb:'Brine lanes and firing yards surround dry accounts. Find where the pressure went.'},
  lockglass_cistern:{id:'lockglass_cistern',name:'Lockglass Cistern',kind:'dungeon',theme:'glade',levelBand:[30,35],size:[40,40],packTarget:0,respawnSec:0,
    blurb:'A private three-chamber descent for you and your party beneath Saltwind. Accept the crew’s work before turning each mechanism; unfinished encounters reset when nobody remains in the chamber.'},
  shiverline_escarpment:{id:'shiverline_escarpment',name:'Shiverline Escarpment',kind:'field',theme:'glade',levelBand:[35,40],size:[56,52],packTarget:4,respawnSec:18,
    blurb:'Wind-bent switchbacks link the ridge signals. A closed station is still answering.'},
  beaconbreak_ward:{id:'beaconbreak_ward',name:'Beaconbreak Ward',kind:'field',theme:'glade',levelBand:[40,45],size:[56,48],packTarget:4,respawnSec:18,
    blurb:'The ward holds its stores and water against a false command. Open its streets and trace the relay.'},
  hollowstar_array:{id:'hollowstar_array',name:'Hollowstar Array',kind:'dungeon',theme:'glade',levelBand:[45,50],size:[48,40],packTarget:0,respawnSec:0,
    blurb:'A private signal station for you and your party with three ordered encounters. Work with the readers to isolate both voices, then confront the Conductor.'},
  rift: {
    id: 'rift', name: 'Nephalem Rift', kind: 'rift', theme: 'glade', levelBand: [1, 70], size: [110, 110],
    packTarget: 0, respawnSec: 0,
    blurb: 'A tear in the world. Kill enough to draw out its Guardian.',
  },
};

export const FIELD_IDS = ['whispering_glade', 'ashen_hollow', 'rillwake_crossing', 'bracken_sluice', 'cairnspill_terraces', 'cinderwash_kilns', 'kilnwatch_crown',
  'sablefen_causeway','saltwind_pans','shiverline_escarpment','beaconbreak_ward'];

/** Rift progress awarded per kill by elite tier (D3: trash ~1 progress orb, elites more). Total to summon guardian = 100. */
export const RIFT_PROGRESS = [0.55, 3, 4.5, 0.6, 0, 0];
