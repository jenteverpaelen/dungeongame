// Core data model shared by server (authority) and client (presentation).

export type ClassId = 'warrior' | 'ranger' | 'mage';
export type Element = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'arcane' | 'holy';
export const ELEMENTS: Element[] = ['physical', 'fire', 'cold', 'lightning', 'poison', 'arcane', 'holy'];

/** Diablo 3 Loot 2.0 rarities. Ancient / Primal are a separate flag on legendary & set items. */
export type Rarity = 'normal' | 'magic' | 'rare' | 'legendary' | 'set';
export type AncientTier = 0 | 1 | 2; // 0 = none, 1 = Ancient, 2 = Primal Ancient

export type Slot =
  | 'head' | 'shoulders' | 'chest' | 'hands' | 'wrists' | 'waist' | 'legs' | 'feet'
  | 'mainhand' | 'offhand' | 'neck' | 'ring1' | 'ring2';
export const SLOTS: Slot[] = ['head', 'shoulders', 'neck', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet', 'ring1', 'ring2', 'mainhand', 'offhand'];

/** The kind of slot an item fits. Rings fit ring1 / ring2. */
export type ItemKind =
  | 'head' | 'shoulders' | 'chest' | 'hands' | 'wrists' | 'waist' | 'legs' | 'feet'
  | 'weapon1h' | 'weapon2h' | 'offhand' | 'neck' | 'ring';

/** Stats that affixes, paragon, gems and buffs can grant. Percentages are stored as whole numbers (5 = 5%). */
export type StatId =
  | 'str' | 'dex' | 'int' | 'vit'
  | 'chc' | 'chd' | 'ias' | 'cdr' | 'rcr' | 'area'
  | 'eleFire' | 'eleCold' | 'eleLightning' | 'elePhysical' | 'elePoison' | 'eleArcane'
  | 'skillDmg' // param = skill id
  | 'elite' | 'eliteDR'
  | 'lifePct' | 'armor' | 'allRes' | 'lifePerHit' | 'lifeRegen' | 'lifePerKill'
  | 'ms' | 'pickup' | 'goldFind' | 'xpPct' | 'thorns' | 'maxResource' | 'resourceRegen'
  | 'dmgPct' | 'flatMin' | 'flatMax' | 'weaponDmgPct' | 'sockets';

/** Visual description of an item, used for paper-doll rendering on characters and for icons. */
export interface ItemLook {
  shape: string;     // e.g. 'helm_horned', 'robe', 'sword2h'
  primary: number;   // 0xRRGGBB main material colour
  secondary: number; // trim / accent colour
  glow: number;      // 0 = none; legendary/set items get an aura colour
  variant: number;   // small deterministic variation (0-3)
}

export interface AffixRoll {
  stat: StatId;
  value: number;
  /** Roll range at this item level, for tooltip "[min - max]" display. */
  min: number;
  max: number;
  primary: boolean;
  param?: string; // skill id for skillDmg
}

export interface GemSocket { gem: string; rank: number }

export interface Item {
  id: string;
  base: string;          // base item type id (see data/items.ts)
  kind: ItemKind;
  name: string;
  rarity: Rarity;
  ancient: AncientTier;
  ilvl: number;
  reqLevel: number;
  affixes: AffixRoll[];
  legendary?: { power: string; value: number; min: number; max: number };
  set?: string;
  weapon?: { min: number; max: number; aps: number; element: Element };
  armor?: number;
  sockets: (GemSocket | null)[];
  /** Cube upgrade tier (+0 .. +10). Each tier multiplies affix values, weapon damage and armor. */
  upgrade: number;
  /** Pity bonus (percentage points) added to the next upgrade attempt after failures. */
  upgradeFortune: number;
  /** Index of the affix locked in by Enchanting (D3 Mystic rule: only one affix may ever be enchanted). */
  enchanted?: number;
  enchantCount: number;
  bound: boolean;
  /** Player-selected protection from destruction, consumption and full reforge. */
  protected?: boolean;
  /** Purchased basic equipment: sale/buyback allowed, salvage must never create materials or Cube XP. */
  vendorStock?: boolean;
  look: ItemLook;
  flavor?: string;
}

export type MaterialId = 'scrap' | 'dust' | 'crystal' | 'soul' | 'deathsBreath';

export interface Materials {
  scrap: number;        // from salvaging normal items (D3 "Reusable Parts")
  dust: number;         // from magic items (D3 "Arcane Dust")
  crystal: number;      // from rare items (D3 "Veiled Crystal")
  soul: number;         // from legendary/set items (D3 "Forgotten Soul")
  deathsBreath: number; // elite drop (D3 "Death's Breath")
}

export interface SkillLoadout {
  /** Skill id in each of the 4 auto-cast slots (null = empty). Primary attack is separate. */
  slots: (string | null)[];
  /** Optional in legacy saves. Conditions belong to slot positions, not skill IDs. */
  autoCast?: import('./autoCast').AutoCastMode[];
  /** Optional in legacy saves. Applies to fresh single-target acquisition. */
  targetPriority?: import('./targetPriority').TargetPriority;
  /** Automatic-only conditions belonging to positions. Null uses the original authored rule. */
  autoRules?: (import('./autoCastRules').AutoCastRule | null)[];
  /** Chosen rune per skill id. */
  runes: Record<string, string | null>;
  /** Purchased upgrade tiers (0..3) per skill id. */
  tiers: Record<string, number>;
  /** Primary (auto-attack) skill id. */
  primary: string;
}

export type ParagonCategory = 'core' | 'offense' | 'defense' | 'utility';

export interface ParagonState {
  level: number;
  xp: number; // progress towards next paragon level
  /** Points spent per paragon stat id. */
  spent: Record<string, number>;
}

export interface CubeState {
  level: number;
  xp: number;
  /** Extracted legendary powers (Kanai's Cube style "learned" powers). */
  learned: string[];
  /** Equipped extracted powers: [weapon, armor, jewelry]. */
  equipped: (string | null)[];
}

/** Persistent character save (server-side authority, replicated to the owning client). */
export interface CharacterSave {
  commands?: import('./commandState').CommandState;
  economy?: import('./economy').EconomyState;
  bestiary?: import('./bestiary').BestiaryState;
  merchant?: import('./merchant').MerchantState;
  appearance?: import('./appearance').HeroAppearance;
  onboarding?: import('./onboarding').IntroState;
  /** Optional adventure state; old saves require no rewrite to participate. */
  rillwake?: import('./adventureTypes').RillwakeQuest;
  quests?: Record<string, import('./questTypes').QuestState>;
  trackedQuest?: string;
  /** Absent only in legacy saves; normalized by the server before use. */
  version?: number;
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  gold: number;
  materials: Materials;
  gems: Record<string, number>; // "ruby:3" -> count
  equipment: Partial<Record<Slot, Item>>;
  inventory: (Item | null)[];
  stash: (Item | null)[];
  skills: SkillLoadout;
  skillPoints: number;
  paragon: ParagonState;
  cube: CubeState;
  difficulty: number;
  lastZone: string;
  lastSeen: number;
  stats: { kills: number; elites: number; legendaries: number; rifts: number; playMs: number; deaths: number };
}

/** Character sheet derived from save (computed in shared/stats.ts). */
export interface DerivedStats {
  mainStat: number;
  mainStatId: 'str' | 'dex' | 'int';
  vit: number;
  life: number;
  armor: number;
  allRes: number;
  chc: number;      // %
  chd: number;      // %
  aps: number;      // weapon attacks per second after IAS
  ias: number;      // %
  cdr: number;      // % (multiplicative stacking)
  rcr: number;      // %
  area: number;     // %
  ele: Record<Element, number>; // % bonus per element
  skillDmg: Record<string, number>;
  elite: number;
  eliteDR: number;
  lifePerHit: number;
  lifeRegen: number;
  lifePerKill: number;
  ms: number;       // %
  pickup: number;   // extra units
  goldFind: number;
  xpPct: number;
  thorns: number;
  maxResource: number;
  resourceRegen: number;
  dmgPct: number;
  weaponMin: number;
  weaponMax: number;
  weaponElement: Element;
  /** Sheet DPS estimate for the primary attack (D3 character-sheet "Damage"). */
  sheetDps: number;
  toughness: number;
  recovery: number;
  /** Damage reduction fractions vs a monster of the character's level. */
  armorDR: number;
  resDR: number;
  /** Active legendary powers (from equipped items and cube) -> rolled value. */
  powers: Record<string, number>;
  /** Equipped set piece counts. */
  sets: Record<string, number>;
}
