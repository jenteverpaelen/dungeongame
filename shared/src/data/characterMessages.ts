/** Existing character rules explained with original, stable English message keys. */
export const CHARACTER_MESSAGES={
  title:'Character details',open:'Details',overview:'Overview',offense:'Offense',defense:'Defense',utility:'Utility',powers:'Powers',
  scope:'Your equipped build and Paragon bonuses. Temporary buffs, targets and conditional combat effects can change what happens in a fight.',
  damage:'Damage estimate',toughness:'Toughness estimate',recovery:'Recovery estimate',
  damageNote:'Damage combines average adjusted weapon damage × attacks per second × main attribute multiplier × average critical multiplier × general damage multiplier. Skill coefficients, elemental/skill bonuses and conditional effects are separate.',
  toughnessNote:'Toughness is life divided by the damage remaining after armor and resistance against an enemy of your level. Elite reduction and conditional defenses are separate.',
  recoveryNote:'Recovery is life regeneration plus life on hit × weapon attacks per second. Actual healing depends on successful hits and their trigger rules; it is not guaranteed healing each second.',
  str:'Strength',dex:'Dexterity',int:'Intelligence',vit:'Vitality',life:'Maximum life',weapon:'Adjusted weapon damage',weaponElement:'Weapon element',
  aps:'Attacks per second',ias:'Attack speed bonus',chc:'Critical hit chance',chd:'Critical hit damage bonus',dmgPct:'General damage bonus',
  elite:'Damage against elites',area:'Area damage',thorns:'Thorns',elements:'Elemental damage bonuses',skills:'Skill damage bonuses',none:'None',
  physical:'Physical',fire:'Fire',cold:'Cold',lightning:'Lightning',arcane:'Arcane',poison:'Poison',holy:'Holy',
  armor:'Armor',allRes:'All resistance',armorDR:'Armor reduction',resDR:'Resistance reduction',eliteDR:'Elite reduction (after cap)',
  lifeRegen:'Life regenerated per second',lifePerHit:'Life per hit',lifePerKill:'Life per kill',defenseNote:'Armor and resistance percentages shown against an enemy at level',
  cdr:'Cooldown reduction',rcr:'Resource cost reduction',ms:'Movement speed bonus (after cap)',pickup:'Extra pickup radius',goldFind:'Gold find bonus',xpPct:'Experience bonus',
  resourceMax:'Maximum resource',resourceRegen:'Passive resource per second',resourceNote:'Resource gained from attacks, summons and temporary effects is separate. Some resources also decay when out of combat.',
  reductionNote:'Cooldown and resource cost reductions combine multiplicatively across sources. They do not add directly.',
  legendary:'Configured legendary powers',gear:'Equipped gear',cube:'Cube',sets:'Equipped sets',active:'Active',inactive:'Inactive',
  powerNote:'The listed power values come from your current configuration. Their descriptions may require a particular skill, target or combat state.',
} as const;
export type CharacterMessageKey=keyof typeof CHARACTER_MESSAGES;
export const characterText=(key:CharacterMessageKey):string=>CHARACTER_MESSAGES[key];
