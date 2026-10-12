// Field shrines (docs/rework/worlds/DESIGN.md §1): D3-style two-minute combat buffs (docs/rework/worlds/REFERENCES W1).
// One source for the server buff, the pickup notice, the buff icon name and the label over the shrine.

export const SHRINES = {
  empowered: { name: 'Hearthfire Altar', effect: '+25% damage', buff: { dmg: 25 } },
  frenzied: { name: 'Quickening Altar', effect: '+25% attack speed', buff: { ias: 25 } },
  keen: { name: 'Keen Altar', effect: '+10% critical chance', buff: { chc: 10 } },
} as const;
export type ShrineKind = keyof typeof SHRINES;

export const SHRINE_BUFF_MS = 120_000;
/** Per character, zone and shrine (wall clock), shared by every channel of the zone. */
export const SHRINE_COOLDOWN_MS = 180_000;

/** The notice when a shrine is used, e.g. "Hearthfire Altar: +25% damage for 2 minutes". */
export const shrineNotice = (kind: ShrineKind) => `${SHRINES[kind].name}: ${SHRINES[kind].effect} for ${SHRINE_BUFF_MS / 60_000} minutes`;
